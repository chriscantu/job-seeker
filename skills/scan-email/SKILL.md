---
name: scan-email
description: >
  Scan Apple Mail inbox for job alert emails from Indeed, LinkedIn, Glassdoor,
  and other sources. Extracts role URLs, deduplicates against seen-postings,
  verifies via ATS APIs, and presents new roles for confirmation. Read-only —
  never modifies emails. Output appended to seen-postings and preferences.
  Triggers: "scan my email", "check mail for jobs", "any job emails", "scan inbox"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Scan Email

Scans an Apple Mail inbox for job alert emails, extracts role URLs, verifies
them via ATS APIs, and presents new roles for the user to confirm before
adding to seen-postings.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and
   show the error
2. Read `PRINCIPLES.md` — quality standards and privacy constraints
3. Read `config/candidate.md` — candidate name
4. Read `config/search.md` — target role titles, comp floor, location
   constraints, companies to skip, title exclusions, staffing/aggregator
   exclusions
5. Read `references/email-patterns.md` — sender domains, title keywords,
   skip rules, URL extraction patterns
6. Check `integrations/config/mail-config.md` exists. If not, stop:
   > "Apple Mail is not configured. Copy `integrations/config/mail-config.md.example`
   > to `mail-config.md` and update the account name and inbox. See the setup
   > skill for guidance."
7. Read `integrations/config/mail-config.md` to get `account_name` and
   `inbox_name`
8. Determine `plugin_root`: if `integrations/config/notes-config.md` exists,
   read `plugin_root` from it. Otherwise use the current working directory.
9. Glob `output/*-seen-postings.md`, sort descending, read the most recent
   file. Build a dedup set of all known URLs and (company_name_lowercase,
   role_title_lowercase) pairs. If no file exists, treat as empty.
10. Glob `output/*-preferences.md`, sort descending, read the most recent
    file (if exists) for source effectiveness context.

---

## Phase 1 — Verify Apple Mail

Before scanning, confirm Apple Mail is accessible.

### Step 1a: Check if Apple Mail is running

```bash
osascript -e 'tell application "System Events" to (name of processes) contains "Mail"'
```

If this returns `false`, warn the user:
> "Apple Mail is not currently running. Running the scan will auto-launch it,
> which may take a moment. Proceed?"

If the user declines, stop.

### Step 1b: Verify account and mailbox

Run a 1-message scan to verify connectivity:

```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" 1 1
```

| Result | Action |
|--------|--------|
| Valid record | Proceed to Phase 2 |
| `ACCOUNT_NOT_FOUND` | Stop: "Could not find a mail account matching '{account_name}'. Check `integrations/config/mail-config.md`." |
| `MAILBOX_NOT_FOUND` | Stop: "Could not find mailbox '{inbox_name}' in the '{account_name}' account. Check Apple Mail for the correct inbox name." |
| `error: ...` | Stop: show the error |

---

## Phase 2 — Batch Metadata Scan

Scan the inbox in sequential batches of 10 messages. After each batch,
classify messages before fetching the next batch.

### Batches

Scan up to 5 batches sequentially:
- Batch 1: messages 1–10
- Batch 2: messages 11–20
- Batch 3: messages 21–30
- Batch 4: messages 31–40
- Batch 5: messages 41–50

For each batch:

```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" {start} {end}
```

If the script returns `NO_MESSAGES`, stop scanning (all messages processed).

### Classification

For each record returned (parsed as subject, sender, date_received,
message_index):

**Step 2a: Sender match** — Check if the sender's email domain matches any
job alert sender pattern from `references/email-patterns.md` → Job Alert
Senders table. If no match, skip. **Note**: `@google.com` is a conditional
match — only classify as a job alert if the subject also contains "Google
Alert" (otherwise it's a regular Google notification).

**Step 2b: Subject pre-filter** — Check if the subject contains at least
one title keyword from `references/email-patterns.md` → Title Keywords
section (cross-referenced with `config/search.md` Target Role Titles). If
no title keyword, skip.

**Step 2c: Skip rules** — Apply each skip rule from `references/email-patterns.md`:
- Newsletter/digest summaries (subject contains "weekly digest", etc.)
- Marketing/promotional emails
- Emails older than 7 days (compare date_received to today)
- Company already in seen-postings dedup set (fuzzy match on company name
  extracted from subject)

**Step 2d: Company skip** — If a company name can be extracted from the
subject, check against `config/search.md` Companies to Skip list.

Messages that pass all filters become **candidates** for body fetch.

**Early stop**: If 20+ candidates have been identified, stop scanning
remaining batches.

---

## Phase 3 — Body Fetch

**Issue ALL body fetch calls in a single message** (batching protocol —
never one at a time).

For each candidate from Phase 2, use the `message_index` captured during
the metadata scan. **Do NOT re-derive the index** — always use the stored
value from Phase 2. Message indices can shift if new mail arrives between
phases.

```bash
osascript {plugin_root}/scripts/apple_mail_read.applescript "{account_name}" "{inbox_name}" {message_index}
```

### Parsing the response

**If response starts with `HTML:`** — extract URLs from the HTML source:
1. Find all `href="..."` attribute values using regex
2. Filter for known ATS URL patterns (see `references/email-patterns.md` →
   URL Extraction Patterns)
3. If URLs are tracking redirects (Indeed `rc/clk/`, LinkedIn `/comm/`,
   etc.), note them for redirect resolution in Phase 4

**If response starts with `TEXT:`** — extract URLs from plaintext:
1. Find all URLs matching `https?://[^\s<>"]+` pattern
2. Filter for known ATS URL patterns

**If response starts with `BODY_UNAVAILABLE:`** — classification failed
for this message. Add it to the results table with a note: "body unavailable
— classified on subject/sender only".

**If response is `ACCOUNT_NOT_FOUND` or `MAILBOX_NOT_FOUND`** — the mail
account became unavailable mid-scan. Stop all remaining body fetches and
report the error to the user.

**If response is `MESSAGE_NOT_FOUND`** — the message was deleted or moved
between the scan and body fetch phases. Skip this message and note
"message moved/deleted since scan" in the results.

**If response starts with `error:`** — an unexpected error occurred. Log
the error, skip this message, and continue with remaining fetches.

If some calls in the batch fail while others succeed, process successful
results normally and handle failures per the rules above.

### URL extraction

For each email, extract:
- **Job URL(s)** — direct ATS posting URLs or career page URLs
- **Company name** — from the email subject, body content, or URL domain
- **Role title** — from the email subject or body content
- **Location** — if mentioned in the body
- **Comp range** — if mentioned in the body

If no job URL is found in the body despite matching sender/subject patterns,
flag the role for **WebSearch fallback** in Phase 4.

---

## Phase 4 — Dedup, Filter, and Verify

### Step 4a: Resolve tracking redirects

For any tracking redirect URLs identified in Phase 3, attempt to resolve
them. Issue all redirect resolution calls in a single batched message:

```
[WebFetch: {tracking_url_1}] [WebFetch: {tracking_url_2}] ...
```

Use the resolved URL (final destination) for dedup and verification.

### Step 4b: Dedup against seen-postings

For each extracted role:
1. Normalize the URL (strip query params, trailing slashes)
2. Check against the dedup set built in Before You Start step 8
3. If the URL or (company, title) pair already exists, skip

### Step 4c: Apply search filters

For surviving roles, apply filters from `config/search.md`:
- Title exclusions (VP of Reliability, Sales Engineering, etc.)
- Location constraints (reject 100% in-office outside Austin, relocation)
- Staffing/aggregator company exclusions
- Company skip list (if not already caught in Phase 2)

### Step 4d: Verify URLs via ATS APIs

**Issue ALL verification calls in a single message** (batching protocol).

Route each URL through the ATS API verification logic from
`integrations/adapters/ats-apis.md`:

| URL pattern | Method |
|-------------|--------|
| `boards.greenhouse.io/{company}/jobs/{id}` or `job-boards.greenhouse.io/{company}/jobs/{id}` | `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` |
| `jobs.lever.co/{company}/{id}` | `GET https://api.lever.co/v0/postings/{company}/{id}` |
| `jobs.ashbyhq.com/{company}` | `GET https://api.ashbyhq.com/posting-api/job-board/{company}` (match by title) |
| Anything else | WebFetch (check for 404 or "no longer accepting" text) |

**Interpreting results:**
- 200 + job data → open, include in results
- 404 → closed, exclude
- API error → fall back to WebFetch for that URL

Extract `posted:YYYY-MM-DD` from ATS API responses where available (see
`references/email-patterns.md` → URL Extraction Patterns and the daily-digest
skill Phase 2 for field mapping).

### Step 4e: WebSearch fallback

For roles where no URL was extracted from the email body (flagged in
Phase 3), attempt to find a direct posting:

```
[WebSearch: {company} {role_title} careers site:greenhouse.io OR site:lever.co OR site:ashbyhq.com]
```

If found, verify the URL using Step 4d. If not found, include the role in
results with a note: "No direct link found — check manually".

---

## Phase 5 — Present Results

Show a confirmation table with all verified roles:

```
| # | Company | Role | Source | Location | Comp | Link | Status |
|---|---------|------|--------|----------|------|------|--------|
| 1 | TrueML | VP of Software Engineering | Indeed | Remote | $225K-$325K | [View](url) | Verified ✓ |
| 2 | Acme Corp | Head of Engineering | LinkedIn | Austin | — | [View](url) | Verified ✓ |
| 3 | Beta Inc | VP Engineering | Glassdoor | Remote | — | — | No link found |
```

Below the table, show:
- **Skipped**: N roles already in seen-postings, M excluded by filters,
  K postings closed
- **Errors**: Any messages that failed body fetch (classified on subject only)

If no new roles found:
> "No new job-related emails found in {account_name}/{inbox_name}."

If roles were found, ask:
> "Should I add these {N} roles to your seen-postings? Let me know if any
> need adjusting."

---

## Phase 6 — State Updates

After user confirmation, write state updates.

### Seen Postings

Glob `output/*-seen-postings.md`, sort descending, read the most recent file.
Append confirmed roles under a new date section:

```
## YYYY-MM-DD (email scan)
- {Company} | {Title} | {URL} | posted:YYYY-MM-DD | source:email-{source_label}
```

Use `posted:YYYY-MM-DD` if the ATS API returned a posting date during
verification. Otherwise use `discovered:YYYY-MM-DD` (today's date).

The `source:email-{source_label}` tag uses the source label from
`references/email-patterns.md` (e.g., `source:email-indeed`,
`source:email-linkedin`).

If no seen-postings file exists, create `output/YYYY-MM-DD-seen-postings.md`.

### Preferences

Glob `output/*-preferences.md`, sort descending, read the most recent file.
Append source effectiveness:

```
## YYYY-MM-DD
### Email Scan
- Apple Mail ({account_name}): {N} new roles found, {M} already seen, {K} excluded
- Sources: Indeed ({n1}), LinkedIn ({n2}), Glassdoor ({n3}), Other ({n4})
```

If no preferences file exists, create `output/YYYY-MM-DD-preferences.md`.

### Apple Notes (optional)

If `integrations/config/notes-config.md` exists, sync the updated
seen-postings note using the update script:

```bash
osascript {plugin_root}/scripts/apple_notes_update.applescript "{prefix} - Seen Postings" "{html_body}" "{default_folder}"
```

Where `{prefix}` is the Apple Notes Prefix from `config/search.md`.
Apple Notes sync errors are non-blocking — the output/ files are the
source of truth.

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| `mail-config.md` missing | Stop: show config guidance |
| Apple Mail not running | Warn, ask to proceed (auto-launch) or stop |
| Account not found | Stop: "Could not find account '{account_name}'" |
| Mailbox not found | Stop: "Could not find mailbox '{inbox_name}'" |
| Individual body fetch fails (`BODY_UNAVAILABLE`) | Classify on subject/sender only, note in results |
| Message moved/deleted since scan (`MESSAGE_NOT_FOUND`) | Skip message, note "message moved/deleted since scan" in results |
| Account/mailbox lost mid-scan | Stop remaining fetches, report error |
| ATS verification fails | WebFetch fallback per standard adapter |
| Tracking redirect resolution fails | Use original URL, note "unresolved redirect" |
| osascript timeout on batch | Reduce remaining batches to 5 messages, note slowdown |
| No job-related emails found | Report: "No new job-related emails in {account}/{inbox}" |
| Seen-postings file doesn't exist | Create `output/YYYY-MM-DD-seen-postings.md` |

---

## Key Constraints

- **Read-only** — never marks emails as read, moves, deletes, or modifies
- **10-message batches** — osascript times out on larger loops
- **50-message cap** — at most 50 messages scanned per session
- **User confirmation required** — state is only written after user approves
- **Never fabricate roles** — only extract what the email actually contains
- **Batching protocol** — all body fetches in one message, all verifications
  in one message (never one at a time)

---

## Future Enhancements

> Not implemented in v1. Documented for when the need arises.

### Application Status Detection (v2)

Detect emails from Greenhouse, Lever, and Ashby that indicate application
status changes (received, interview scheduled, rejected). Update
`output/*-applications.md` accordingly. Patterns documented in
`references/email-patterns.md` → Future: Application Status Patterns.

### Recruiter Outreach Surfacing (v2)

Detect cold emails from recruiters or hiring managers that match title
keywords. Present in a separate "Recruiter Outreach" section for manual
review. Patterns documented in `references/email-patterns.md` → Future:
Recruiter Outreach Patterns.

### Gmail Cross-Reference (v2)

Dedup extracted roles against Gmail MCP scan results to avoid processing
the same alert from both iCloud and Gmail accounts.
