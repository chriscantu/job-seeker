---
name: scan-email
description: >
  Scan Apple Mail and/or Gmail for job alert emails from Indeed, LinkedIn,
  Glassdoor, and other sources. Extracts role URLs, deduplicates against
  seen-postings (and cross-deduplicates between sources), verifies via ATS
  APIs, and presents new roles for confirmation. Processed alerts are trashed
  from both Apple Mail and Gmail.
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

Read `skills/scan-email/classification-rules.md` and execute BOTH paths for each record:

1. **Job Alert Path**: the existing 4-step flow. If it classifies as a candidate, tag with `type: job-alert` and continue to body fetch.
2. **Status Change Path**: if the sender matches an ATS notification domain, run `bun scripts/classify-status-email.js` and tag the result with `type: status-change`. Status emails are always body-fetched (the classifier needs the body to extract URLs and signals).

A single message matches at most one path because the sender sets are disjoint. Skip messages that match neither.

## Phase 2G — Gmail Metadata Scan (skip if `gmail_enabled = false`)

Build search queries from sender domains in `references/email-patterns.md`:

- Job Alert Senders table → job alert query
- Application Status Patterns → ATS Notification Senders → status query

The two sets of senders are disjoint. Combine them into a single Gmail search:

    from:(indeed.com OR indeedmail.com OR linkedin.com OR e.linkedin.com OR glassdoor.com OR mail.glassdoor.com OR remotehunter.com OR wellfound.com OR angel.co OR google.com OR otta.com OR ziprecruiter.com OR builtin.com OR hired.com OR greenhouse.io OR greenhouse-mail.io OR lever.co OR ashbyhq.com) newer_than:{lookback_days}d

Execute via `[gmail_search_messages]`. Paginate if needed.

Read `skills/scan-email/classification-rules.md` and execute BOTH paths for each record:

1. **Job Alert Path**: the existing 4-step flow. If it classifies as a candidate, tag with `type: job-alert` and continue to body fetch.
2. **Status Change Path**: if the sender matches an ATS notification domain, run `bun scripts/classify-status-email.js` and tag the result with `type: status-change`. Status emails are always body-fetched (the classifier needs the body to extract URLs and signals).

A single message matches at most one path because the sender sets are disjoint. Skip messages that match neither.

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

The cached payload must include a `type` field per entry (`"job-alert"` or `"status-change"`) so resumption after interruption does not need to re-classify.

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

Two sequential gates. Gate 2 only appears if there are any status-change candidates.

### Gate 1 — Role adds (unchanged)

Show the confirmation table for job-alert candidates:

| # | Company | Role | Source | Location | Comp | Link | Status |
|---|---------|------|--------|----------|------|------|--------|
| 1 | TrueML | VP of Software Engineering | Indeed (Gmail) | Remote | $225K-$325K | [View](url) | Verified ✓ |

Source column: `(Mail)`, `(Gmail)`, or `(both)`.

Show skipped counts, errors, sources scanned, then ask:

> Add these N roles to seen-postings? [y/N/edit]

### Gate 2 — Status changes (only if any HIGH or MEDIUM classifications exist)

Partition status-change candidates by tier. LOW tier never appears in this gate — those go directly to Flagged for Review in Phase 6.

Render the gate:

    ⚠️  STATUS CHANGES DETECTED — review each carefully before accepting

    [1] HIGH  ✓
        Atlassian — VP Engineering
        Current:   {entry.stage} ({entry.applied}, {days-since} days ago)
        Detected:  {classifier.status}
        Signal:    "{classifier.signal}"
        Sender:    {email.sender}
        Match:     URL ({matched-url})
        Message:   {classifier.msgId}

    [2] MEDIUM ⚠  name-only match — verify before accepting
        Discord — Director of Engineering
        Current:   Applied (2026-04-05, 8 days ago)
        Detected:  Rejected
        Signal:    "unfortunately"
        Sender:    no-reply@greenhouse-mail.io
        Match:     name
        Message:   <fixture-discord-001@mail.gmail.com>

    Apply status changes?
      HIGH tier ([1]): accept all high-confidence? [y/N]
      MEDIUM tier ([2]): select by number or N to skip all: _

**Rules for Gate 2:**

1. HIGH and MEDIUM are always prompted as **two separate questions**. Never combine them.
2. HIGH tier accepts via `y/N` — a single keystroke accepts all HIGH entries.
3. MEDIUM tier requires typing a number or comma-separated list (`1,3`) or `N` to skip all. There is no "accept all" for MEDIUM.
4. If the user cancels Gate 2 (Ctrl-C or `N` to both), nothing is written. Since message-IDs are not yet in applications.md history, the next scan will re-detect these same emails.
5. Gate 2 runs AFTER Gate 1 so the user processes the less-risky operation (appending roles) before the more-risky one (mutating pipeline state).

## Phase 6 — State Updates

After user confirmation:

Read `skills/_shared/state-io.md` and execute the append pattern for:
- `seen-postings` — confirmed roles with `source:email-{source_label}` tags
- `preferences` — per-source effectiveness counts

### Apple Notes sync (optional)
Read `skills/_shared/apple-notes.md` and execute the update operation for
the Seen Postings note.

### Trash Apple Mail alerts
Skip if `apple_mail_enabled = false`.

**Step 1: Trash aggregator + marketing senders by sender pattern (atomic).**

Read both auto-trash tables from `config/search.md`:
- **"Staffing/Aggregator Company Exclusions"** — the "Trash Sender Substring" column
- **"Marketing / Non-Job-Search Senders to Auto-Trash"** — the "Trash Sender Substring" column

Concatenate every substring from both tables into a comma-separated list, then
issue a single trash-by-sender call. Substrings must NOT contain commas — the
script splits the input on commas to build the pattern list.

```bash
osascript {plugin_root}/scripts/apple_mail_trash_by_sender.applescript \
  "{account_name}" "{inbox_name}" "{comma_separated_substrings}"
```

The script uses Mail's `whose sender contains` query so matching is by sender
substring, NOT by index — immune to mid-sequence shifts when new mail arrives.

**Output format:** `trashed: pattern1=moved/matched pattern2=moved/matched ...`
For example: `trashed: lensa.com=3/3 ladders.com=0/0 topresume.com=2/2`. If a
move fails, the affected pattern gets an `(errors: ...)` suffix listing the
last error message.

**Surface every line of output to the user**, including patterns with 0 matches —
a `pattern=0/0` row may be a quiet run OR a typo in `config/search.md`. Don't
hide them. If any pattern reports `moved < matched`, surface the error string
explicitly so the user knows messages were left behind.

These messages should never accumulate in the inbox regardless of whether they
were body-fetched. If the user reports a new sender that "shouldn't be there,"
add it to one of the two `config/search.md` tables — do not handle ad-hoc.

**Step 2: Trash body-fetched candidate alerts by message-ID.**

For each Apple Mail message that was body-fetched as a legitimate candidate
(whether ultimately confirmed or excluded post-classification), use the
`message_id` field captured during Phase 2 scan and pass it via `--by-id`:

```bash
osascript {plugin_root}/scripts/apple_mail_trash.applescript "{account_name}" "{inbox_name}" --by-id "{message_id}"
```

The script uses Mail's `whose message id is` query — also immune to index shifts.

⚠️ **Do NOT trash by index.** Indices shift when new mail arrives between scan
and trash, which causes silent wrong-message trashes. The legacy by-index mode
of `apple_mail_trash.applescript` still exists for backward compatibility but
should never be used in this skill. Always pass `--by-id "{message_id}"` from
the scan output's 5th field.

**Output handling per return value:**

| Return | Action |
|--------|--------|
| `trashed-by-id: {id}` | Success, continue |
| `trashed-by-id-ambiguous: {id} (matched N, trashed first)` | **Surface to user.** N>1 messages share the same Message-ID (rare: resends, IMAP dupes). The script trashed the first match, but the user should know they may have a duplicate sitting in the inbox. |
| `MESSAGE_NOT_FOUND` | Skip silently if the message_id was `MSGID_UNAVAILABLE` (the scan script couldn't read its Message-ID — this is a known limitation). Otherwise log: "Expected to trash {subject}, but the message-id was not found in the inbox — was it already moved?" |
| `TRASH_NOT_FOUND` | **Stop all trash calls.** Trash mailbox is missing — surface to user, do not continue. |
| `error: {message}` | **Stop all trash calls** for this run and surface the error to the user. Unknown failures should not be silently retried. |

### Trash Gmail alerts
Skip if `gmail_enabled = false` or no Gmail candidates body-fetched.

Collect all `messageId`s from Gmail candidates that were body-fetched AND
presented in the Phase 5 confirmation table.

**Check credentials first:**
```bash
test -f {plugin_root}/credentials/gmail-client-secret.json && test -f {plugin_root}/credentials/gmail-tokens.json && echo "ready" || echo "not-configured"
```

If `not-configured`, fall back to manual cleanup report:
> "Gmail trash not configured. Run `bun scripts/gmail.js auth` to enable
> automatic cleanup. Processed Gmail messages for manual review:
> {list messageIds}"

If `ready`, trash in one call:
```bash
bun {plugin_root}/scripts/gmail.js trash {id1} {id2} ...
```

Parse output: count `trashed:` lines for success, surface any `error:` lines.
Report: "Trashed {N} Gmail messages." or "Trashed {N}/{total} Gmail messages
({errors} failed — check manually)."

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
- Apple Mail: read + trash; Gmail: read + trash (via scripts/gmail.js)
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
