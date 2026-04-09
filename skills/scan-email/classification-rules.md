# Scan Email — Classification Rules

Rules for classifying email messages as job alerts vs non-job-related email.
Applied to both Apple Mail and Gmail messages.

## Classification Pipeline

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
