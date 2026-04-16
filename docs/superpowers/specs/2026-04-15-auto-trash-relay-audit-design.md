# Auto-Trash Relay Variant Derivation + Pattern Audit

**Date**: 2026-04-15
**Issue**: #93
**Branch**: `feature/auto-trash-relay-audit`
**Status**: Design

## Problem

Auto-trash sender patterns silently fail when emails arrive via iCloud's
"Hide My Email" relay, which rewrites `user@domain.com` to
`user_at_domain_com_{random}@icloud.com`. 14 of 20 configured patterns
contain a `.` and are affected. Additionally, new users have no way to
discover which senders are hitting their inbox but aren't covered by the
configured patterns — they must manually find and add every sender through
trial and error.

## Scope

This spec covers two phases from issue #93:

- **Phase 1**: Auto-derive iCloud relay variants at runtime in
  `extractAllTrashSubstrings()` so users only configure the natural domain
  and the relay form is generated automatically.
- **Phase 2**: A config audit command that scans the Gmail inbox for
  uncovered senders, classifies them with heuristics, and outputs structured
  JSON for the scan-email skill to present interactively.

### Non-goals

- Apple Mail audit path (Gmail first; Apple Mail later)
- Persistent `0/0` tracking across scans
- First-run onboarding integration into the setup skill (Phase 3)
- Cross-provider pattern validation (Phase 4)

## Phase 1: iCloud Relay Variant Auto-Derivation

### Location

`scripts/lib/trash-tables.js`

### New exported function

```js
deriveRelayVariants(substrings)
```

Pure function. Takes the raw substring array from the three tables and
returns an expanded, deduplicated array:

1. For patterns containing `.` but no `@` (e.g. `topresume.com`):
   add variant with `.` replaced by `_` (produces `topresume_com`)
2. For patterns containing `@` (e.g. `invitations@linkedin.com`):
   add variant with `@` replaced by `_at_` and `.` replaced by `_`
   (produces `invitations_at_linkedin_com`)
3. Patterns with neither `.` nor `@` (e.g. `hackajob`): no variant
4. Deduplicate the final list (user may have manually added relay variants)
5. Originals appear before their derived variants in the output

### Integration

`extractAllTrashSubstrings()` calls `deriveRelayVariants()` on the
concatenated raw list before returning. Both CLI callers
(`auto_trash_inbox.js`, `auto_trash_gmail.js`) pass `plan.substrings.length`
as `expectedPatternCount` — since `substrings` comes from the now-expanded
`extractAllTrashSubstrings()`, the count naturally matches. No changes
needed in the CLIs or `trash-output.js`.

### Edge cases

- Manually added relay variant (e.g. `topresume_com` row in search.md):
  dedup removes the duplicate. No double-matching.
- Patterns that are already underscore-only (`hackajob`, `echojobs`):
  no `.` or `@`, no variant derived. Correct.

## Phase 2: Config Audit Command

### New file: `scripts/audit_trash_patterns.js`

CLI that discovers Gmail inbox senders not covered by any configured trash
pattern.

#### Flow

1. Read `config/search.md` via `extractAllTrashSubstrings()` (expanded list)
2. Shell out to `gmail.js search "in:inbox newer_than:30d" --max 500`
3. Parse `from` header of each message, extract sender domain
4. Group messages by sender domain, count per domain
5. Check each domain against the configured pattern list (substring match)
6. For uncovered domains: run the heuristic classifier
7. Output structured JSON to stdout

#### CLI interface

```
bun scripts/audit_trash_patterns.js                    # Full audit
bun scripts/audit_trash_patterns.js --newer-than 7d    # Narrow window
bun scripts/audit_trash_patterns.js --uncovered-only   # Skip covered
```

#### Credentials

Reuses the same credential check pattern as `auto_trash_gmail.js`:
expects `credentials/gmail-client-secret.json` and
`credentials/gmail-tokens.json`. Supports `JOB_SEEKER_GMAIL_CREDS` and
`JOB_SEEKER_SKIP_CRED_CHECK` env overrides for tests.

#### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Config error (missing search.md, missing credentials) |
| 4 | Gmail API error |

#### Output shape

```json
{
  "coveredCount": 15,
  "uncoveredSenders": [
    {
      "domain": "glassdoor.com",
      "fromAddresses": ["noreply@glassdoor.com"],
      "messageCount": 6,
      "suggestedCategory": "job-alert",
      "suggestedPattern": "glassdoor.com",
      "sampleSubjects": ["6 new VP Engineering jobs in Austin"],
      "confidence": "high"
    }
  ],
  "coveredSenders": [
    {
      "domain": "linkedin.com",
      "messageCount": 12,
      "matchedPatterns": ["jobalerts-noreply@linkedin.com"]
    }
  ]
}
```

### New file: `scripts/lib/sender-classifier.js`

Heuristic classifier for uncovered sender domains.

#### Exported interface

```js
classifySender({ domain, fromAddresses, messageCount, subjects })
// Returns: {
//   suggestedCategory: "staffing"|"marketing"|"job-alert"|"unknown",
//   confidence: "high"|"medium"|"low"
// }
```

#### Classification logic (ordered by specificity)

1. **Known domain lists** (high confidence):
   - Aggregator/staffing: `glassdoor.com`, `indeed.com`,
     `ziprecruiter.com`, `wellfound.com`, `remotehunter.com`,
     `builtin.com`, `otta.com`, `dice.com`, etc.
   - Marketing: `topresume.com`, `resumegenius.com`, etc.
   - Job alerts: `noreply@`, `jobalerts@`, `jobs-` local parts from
     known job platforms

2. **Heuristic signals** (medium confidence):
   - High message count (5+ in 30 days) from a single domain
   - Templated subjects (common prefix/pattern across messages)
   - `noreply@` or `notifications@` local part

3. **Fallback** (low confidence):
   - Unrecognized domain, low message count, no signals → `"unknown"`

The known domain list is intentionally small and conservative. The skill
presents low-confidence suggestions differently from high-confidence ones.

### Config writer: `appendToTrashTable()`

New function in `scripts/lib/trash-tables.js`:

```js
appendToTrashTable(searchMdPath, heading, entries)
// entries: [{ name: "Glassdoor", pattern: "glassdoor.com" }]
```

Appends rows to the specified table in search.md:
1. Reads the file
2. Finds the target table by heading
3. Appends new rows before the next heading (or EOF)
4. Writes back

Single ownership — config reading and writing live in the same module.

### Skill integration

The scan-email skill calls `audit_trash_patterns.js`, reads the JSON, and
presents findings conversationally:

- **High confidence**: "Glassdoor (6 messages, job alerts) — add to
  auto-trash?"
- **Medium confidence**: "notifications@someplatform.com (3 messages,
  looks automated) — add to auto-trash?"
- **Low confidence**: "mail@unfamiliar.com (1 message) — not sure about
  this one. Trash, keep, or skip?"

The human approves/rejects each. The skill writes approved entries into
`config/search.md` via `appendToTrashTable()`.

## Testing Strategy

### Phase 1 tests (in `tests/auto-trash-tables.test.js`)

- `deriveRelayVariants` pure function tests:
  - `.`-only patterns: `topresume.com` → includes `topresume_com`
  - `@`-containing patterns: `invitations@linkedin.com` →
    includes `invitations_at_linkedin_com`
  - No-dot patterns: `hackajob` → no variant added
  - Dedup: `["topresume.com", "topresume_com"]` → no duplicate
  - Order: originals before derived variants
- `extractAllTrashSubstrings` existing tests updated for expanded count
- Existing `search.md.example` contract tests still pass

### Phase 2 tests (new `tests/audit-trash-patterns.test.js`)

- Mock `gmail.js search` via `JOB_SEEKER_GMAIL_BIN` env override
- Stub returns canned JSON with covered + uncovered senders
- Assert structured output shape, uncovered detection, covered counting
- Exit codes: config error, Gmail API error

### Classifier tests (new `tests/sender-classifier.test.js`)

- Known domains: `glassdoor.com` → `job-alert` / high
- Heuristic: `noreply@unknown.com` with 8 messages → medium
- Fallback: `random@personal.com` with 1 message → `unknown` / low
- Edge: `notglassdoor.com` should NOT match `glassdoor.com`

### Config writer tests (in `tests/auto-trash-tables.test.js`)

- `appendToTrashTable` appends to correct table
- Preserves other tables unchanged
- Handles EOF edge case (last table in file)

## Files changed

### Modified
- `scripts/lib/trash-tables.js` — add `deriveRelayVariants()`,
  `appendToTrashTable()`, call relay derivation in
  `extractAllTrashSubstrings()`
- `tests/auto-trash-tables.test.js` — new tests for relay variants,
  config writer; update count expectations

### New
- `scripts/audit_trash_patterns.js` — audit CLI
- `scripts/lib/sender-classifier.js` — heuristic classifier
- `tests/audit-trash-patterns.test.js` — audit CLI tests
- `tests/sender-classifier.test.js` — classifier tests
