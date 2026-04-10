---
name: scan-email
description: >
  Scan Apple Mail and/or Gmail for job alert emails from Indeed, LinkedIn,
  Glassdoor, and other sources. Extracts role URLs, deduplicates against
  seen-postings (and cross-deduplicates between sources), verifies via ATS
  APIs, and presents new roles for confirmation. Processed Apple Mail alerts
  are trashed; Gmail alerts are reported for manual cleanup (MCP limitation).
  Output appended to seen-postings and preferences.
  Triggers: "scan my email", "check mail for jobs", "any job emails", "scan inbox"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Scan Email

Scans Apple Mail and/or Gmail for job alert emails, extracts role URLs,
verifies them via ATS APIs, and presents new roles for the user to confirm
before adding to seen-postings. At least one source (Apple Mail or Gmail)
must be configured.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Read `skills/_shared/batching.md` for reference — all phases follow the
batching protocol.

Additionally:
- Read `references/email-patterns.md` — sender domains, title keywords,
  skip rules, URL extraction patterns

## Phase 0a — Source Configuration

Determine available sources:
- **Apple Mail**: Check if `integrations/config/mail-config.md` exists.
  If yes, read `account_name` and `inbox_name`. Set `apple_mail_enabled = true`.
- **Gmail**: Check if `integrations/config/gmail-config.md` exists and
  `enabled: true`. If yes, read `email`, `max_results`, `lookback_days`.
  Set `gmail_enabled = true`.
- If neither source is configured, stop:
  > "No email sources configured. Set up at least one:
  > - Apple Mail: copy `integrations/config/mail-config.md.example` to `mail-config.md`
  > - Gmail: copy `integrations/config/gmail-config.md.example` to `gmail-config.md`
  > See the setup skill for guidance."

Determine `plugin_root`: if `integrations/config/notes-config.md` exists,
read `plugin_root`. Otherwise use the current working directory.

## Phase 0b — State

Read `skills/_shared/state-io.md` and execute the read pattern for:
- `seen-postings` — build dedup set of all known URLs
- `preferences` — for source effectiveness context

Additionally, build dedup tuples of `(company_name_lowercase,
role_title_lowercase)` pairs from seen-postings for fuzzy matching.

Report which sources are active:
> "Scanning: {Apple Mail (account_name/inbox_name) | Gmail (email) | both}"

### Phase Cache Check

Before starting email scan, check for cached results from a prior interrupted run.
See `skills/_shared/phase-cache.md` for the full caching convention.

1. Run `bun scripts/cache.js read scan-email body-fetch`
   - If exit 0: Body fetch results are cached. Display: "Body fetch cached at {cached_at} — {N} roles extracted. Resume from dedup/verification?" If user confirms, skip to Phase 4 using the cached data. If user says "fresh", proceed normally.

2. If not cached, proceed with Phase 1 normally.

## Phase 1 — Verify Sources

### Phase 1A: Verify Apple Mail (skip if `apple_mail_enabled = false`)

**Step 1Aa**: Check if Apple Mail is running:
```bash
osascript -e 'tell application "System Events" to (name of processes) contains "Mail"'
```
If `false`, warn and ask to proceed (auto-launch) or skip to Gmail.

**Step 1Ab**: Verify account and mailbox — scan 1 message:
```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" 1 1
```
Handle: valid record (ready), `ACCOUNT_NOT_FOUND`, `MAILBOX_NOT_FOUND`, `error:`.

### Phase 1G: Verify Gmail (skip if `gmail_enabled = false`)

Test connection: `[gmail_get_profile]`. Handle: success (ready), MCP error (skip).

If both sources fail, stop.

## Phase 2 — Apple Mail Metadata Scan (skip if `apple_mail_enabled = false`)

Scan inbox in sequential batches of 10 messages (up to 5 batches = 50 messages):

```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" {start} {end}
```

If `NO_MESSAGES`, stop scanning.

Read `skills/scan-email/classification-rules.md` and execute for each record.

## Phase 2G — Gmail Metadata Scan (skip if `gmail_enabled = false`)

Build search queries from sender domains in `references/email-patterns.md`.
Execute via `[gmail_search_messages]`. Paginate if needed.

Read `skills/scan-email/classification-rules.md` and execute for each result.

## Phase 3 — Body Fetch (Apple Mail)

Skip if no Apple Mail candidates.

Read `skills/scan-email/body-extraction.md` and execute for Apple Mail candidates.

## Phase 3G — Body Fetch (Gmail)

Skip if no Gmail candidates.

Read `skills/scan-email/body-extraction.md` and execute for Gmail candidates.

#### Cache Body Fetch Results

After body fetch completes, cache extracted roles for resumption:
`bun scripts/cache.js write scan-email body-fetch '<json>'`
— include all extracted roles with URLs, company names, and source labels.

## Phase 4 — Dedup, Filter, and Verify

### Step 4a: Cross-source dedup
Deduplicate across Apple Mail and Gmail. Same URL or same company+title → keep
the entry with more extracted data. Tag survivors with `source: both`.

### Step 4b: Resolve tracking redirects
Read `skills/_shared/url-quality.md` for tracking redirect guidance.
Issue all resolution calls in a single batched message.

### Step 4c: Dedup against seen-postings
Normalize URLs (strip query params, trailing slashes). Check against dedup set.

### Step 4d: Apply search filters
Read `skills/_shared/url-quality.md` and execute title normalization.
Apply filters from `config/search.md`: title exclusions, location constraints,
staffing/aggregator exclusions, company skip list.

### Step 4e: Verify URLs via ATS APIs
Read `skills/_shared/ats-verification.md` and execute.

### Step 4f: WebSearch fallback
For roles with no URL from body extraction:
```
[WebSearch: {company} {role_title} careers site:greenhouse.io OR site:lever.co OR site:ashbyhq.com]
```

## Phase 5 — Present Results

Show a confirmation table:

```
| # | Company | Role | Source | Location | Comp | Link | Status |
|---|---------|------|--------|----------|------|------|--------|
| 1 | TrueML | VP of Software Engineering | Indeed (Gmail) | Remote | $225K-$325K | [View](url) | Verified ✓ |
```

Source column: alert source with email channel in parentheses: `(Mail)`,
`(Gmail)`, or `(both)`.

Show: skipped counts, errors, sources scanned.

Ask for confirmation before writing state.

## Phase 6 — State Updates

After user confirmation:

Read `skills/_shared/state-io.md` and execute the append pattern for:
- `seen-postings` — confirmed roles with `source:email-{source_label}` tags
- `preferences` — per-source effectiveness counts

### Apple Notes sync (optional)
Read `skills/_shared/apple-notes.md` and execute the update operation for
the Seen Postings note.

### Trash Apple Mail alerts
Skip if `apple_mail_enabled = false` or no Apple Mail candidates body-fetched.

Trash in **descending index order** (highest first to prevent index shifting):
```bash
osascript {plugin_root}/scripts/apple_mail_trash.applescript "{account_name}" "{inbox_name}" {index}
```

Handle: `MESSAGE_NOT_FOUND` (skip), `TRASH_NOT_FOUND` (stop all trash calls).

### Gmail cleanup report
Skip if `gmail_enabled = false` or no Gmail candidates body-fetched.

Report processed messages for manual cleanup (Gmail MCP cannot trash).

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Neither source configured | Stop: show config guidance |
| Source config missing | Skip that source, continue with other |
| Apple Mail not running | Warn, ask to proceed or skip |
| Account/mailbox not found | Skip source, continue with other |
| Gmail MCP error | Skip Gmail, continue with Apple Mail |
| Body fetch fails | Classify on subject/sender only |
| Message moved/deleted | Skip, note in results |
| ATS verification fails | WebFetch fallback |
| Redirect resolution fails | Use original URL |
| osascript timeout | Reduce batch size, note slowdown |
| No job emails found | Report per source |

## Key Constraints

- At least one source required
- Apple Mail: read + trash; Gmail: read only
- Cross-source dedup — same role counted once
- 10-message batches (Apple Mail osascript limit)
- 50-message cap per source
- User confirmation required before state writes
- Never fabricate roles
- Graceful degradation between sources

## Future Enhancements

> Not implemented. Documented for when the need arises.

- Application status detection (Greenhouse/Lever/Ashby status change emails)
- Recruiter outreach surfacing
- Gmail trash support (when MCP adds message modification)
