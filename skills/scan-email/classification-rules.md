# Scan Email — Classification Rules

Rules for classifying email messages as job alerts vs non-job-related email.
Applied to both Apple Mail and Gmail messages. Each message is evaluated against both paths; the two are disjoint by sender so a single message can only match one.

## Job Alert Path

For each message (using subject, sender email, date_received):

### Step 1: Sender Match

Check if the sender's email domain matches any job alert sender pattern
from `references/email-patterns.md` → Job Alert Senders table.

**Special case:** `@google.com` is a conditional match — only classify as
a job alert if the subject also contains "Google Alert" (otherwise it's a
regular Google notification).

If no sender match → skip this message.

### Step 2: Subject Pre-Filter

Check if the subject contains at least one title keyword from
`references/email-patterns.md` → Title Keywords section (cross-referenced
with `config/search.md` Target Role Titles).

Read `skills/_shared/url-quality.md` for title normalization rules.
Normalize abbreviations before matching (e.g., "Sr." → "Senior").

If no title keyword after normalization → skip this message.

### Step 3: Skip Rules

Apply each skip rule from `references/email-patterns.md`:
- Newsletter/digest summaries (subject contains "weekly digest", etc.)
- Marketing/promotional emails
- Emails older than 7 days (compare date_received to today)
- Company already in seen-postings dedup set (fuzzy match on company name
  extracted from subject)

### Step 4: Company Skip

If a company name can be extracted from the subject, check against
`config/search.md` Companies to Skip list.

## Candidate Tagging

Messages that pass all four steps become **candidates** for body fetch.
Tag each candidate with its source:
- Apple Mail candidates: `source: apple-mail`
- Gmail candidates: `source: gmail`

Store the `message_index` (Apple Mail) or `messageId` and `threadId` (Gmail)
for use in body fetch.

## Early Stop

If 20+ candidates have been identified across all batches, stop scanning
remaining batches. This prevents excessive processing when the inbox has
many matching emails.

## Gmail-Specific Notes

- Gmail `internalDate` is a Unix timestamp in milliseconds — convert to a
  date for the 7-day age comparison
- Gmail search queries are constructed from sender domains in
  `references/email-patterns.md`:
  ```
  from:(indeed.com OR indeedmail.com OR linkedin.com OR ...) newer_than:{lookback_days}d
  ```
- Google Alerts use a separate query:
  ```
  from:google.com subject:"Google Alert" newer_than:{lookback_days}d
  ```

## Status Change Path

Runs in parallel to the Job Alert Path. A message either matches this path (ATS status email) or the Job Alert Path (job posting alert) — never both, because the sender sets are disjoint.

### Step 1: ATS Sender Match

Check the sender domain against ATS Notification Senders in `references/email-patterns.md` → Application Status Patterns. Currently recognized:

- `@greenhouse.io`, `@greenhouse-mail.io`, `no-reply@greenhouse.io`
- `@lever.co`, `notifications@lever.co`
- `@ashbyhq.com`

No match → skip (may still be classified by the Job Alert Path).

### Step 2: Invoke the Classifier Script

For each ATS-sender match, run:

```bash
bun scripts/classify-status-email.js --email {email.json} --applications-dir {plugin_root}/output
```

The script returns one JSON object per call:

```json
{
  "tier": "HIGH" | "MEDIUM" | "LOW",
  "status": "Applied" | "Interview" | "Rejected" | "Offer" | null,
  "matchMethod": "url" | "name" | "none",
  "signal": "...",
  "atsSender": "greenhouse" | "lever" | "ashby",
  "matchedEntry": {
    "company": "...",
    "title": "...",
    "url": "..." | null,
    "stage": "...",
    "section": "active" | "closed"
  } | null,
  "msgId": "<...>"
}
```

Or `null` if the sender did not match an ATS domain (should not happen after Step 1, but the CLI is defensive).

The classifier matches against `active` and `closed` entries only — flagged entries are excluded so status signals don't silently collide with unresolved previous flags. The `section` field on `matchedEntry` is REQUIRED by `markStatusChanged` — it uses it to decide whether to mutate the entry (active) or silently skip (closed, already-handled application). Callers must pass the full `matchedEntry` verbatim through to `markStatusChanged`.

### Step 3: Persist Candidate Records

Tag each classified record with `type: status-change` and the full JSON result. These records flow into Phase 5 Gate 2 (HIGH/MEDIUM) or Phase 6 Flagged for Review append (LOW).

Candidates from the Status Change Path are NOT subject to the same early-stop rule as job alerts — process all ATS matches in the batch.
