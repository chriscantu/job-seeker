# scan-email: Application Status Detection

**Issue**: [#18](https://github.com/chriscantu/job-seeker/issues/18)
**Date**: 2026-04-13
**Status**: Design approved, ready for implementation plan
**Related follow-ups**: #62 (match reliability), #63 (unknown-company handling), #64 (non-ATS rejections), #65 (classify-vs-trash ordering)

---

## Problem

`scan-email` walks past ATS status emails (rejections, interview invites, screen requests) without updating `output/*-applications.md`. Status changes are discovered manually, days later, or not at all. Atlassian and Schwab rejections were both missed in real runs. With an urgent post-Procore search and 5+ active apps, stale "Applied" entries waste `/follow-up` cycles and distort `/pipeline` signal.

## Goals

1. Detect ATS status change emails during the existing `scan-email` flow with no extra scan passes.
2. Update `applications.md` state for high-confidence matches after explicit user confirmation.
3. Flag lower-confidence and ambiguous cases to a reviewable section rather than auto-applying or silently dropping them.
4. Never destroy pipeline state or artifact directories without user action.

## Non-goals (deferred to follow-ups)

- Non-ATS rejection detection from recruiter personal emails (#64)
- Auto-creating `applications.md` entries for companies not already in the pipeline (#63 — v1 routes these to Flagged for Review)
- A `/review-flagged` slash command to resolve Flagged for Review entries
- Rescanning already-closed applications
- Detecting status changes from aggregator digests (LinkedIn, Indeed)

## Design summary

A second classification pipeline — **Status Change Path** — runs in parallel to the existing Job Alert Path inside `scan-email` Phase 2/2G. Messages match one path or the other based on sender (disjoint sender sets). Status matches are scored into three confidence tiers that drive different UX:

- **HIGH**: URL-matched → single confirmation keystroke
- **MEDIUM**: name-matched → must individually select each entry to apply
- **LOW**: ambiguous or unmatched → appended to a new `## Flagged for Review` section of `applications.md` for manual resolution

State mutations go through a second confirmation gate distinct from the existing role-add confirmation gate — you cannot rubber-stamp both with a single keystroke. Rejection cleanup prints `rm -rf` suggestions but never executes them.

## Architecture

### Files touched

| File | Change |
|---|---|
| `skills/scan-email/SKILL.md` | Phase 2/2G dispatches to both classification paths; Phase 5 adds Gate 2; Phase 6 writes status changes to applications.md |
| `skills/scan-email/classification-rules.md` | New "Status Change Path" section parallel to existing "Job Alert Path" |
| `references/email-patterns.md` | Promote "Future: Application Status Patterns (v2)" to active section with expanded signal table |
| `output/*-applications.md` schema | New `## Flagged for Review` section; frontmatter gains `flagged_count:`; History entries gain `msg-id:` suffix |
| `skills/scan-email/test-fixtures/status/` | New directory with fixture emails and applications.md fixture |
| `scripts/test-status-classifier.js` | New bun test runner (manual/CI invocation, not preflight) |

### Gmail query

```
from:(indeed.com OR indeedmail.com OR linkedin.com OR ... OR greenhouse.io OR greenhouse-mail.io OR lever.co OR ashbyhq.com) newer_than:7d
```

Apple Mail scan is unchanged — it reads every message in the inbox regardless.

### Interaction with existing trash flow

Status emails are trashed **after** user confirmation in Phase 6, via the same message-id-based path as job alerts. They are **not** caught by the bulk-trash-by-sender step because ATS domains are not in the staffing/aggregator auto-trash list. Resolves the ordering question raised in #65.

### Interaction with Phase Cache

The body-fetch cache payload is extended to carry a `classified_as` field (`job-alert` | `status-change`) so resumption after interruption does not re-classify from scratch.

## Status Change Path (classification pipeline)

Parallel to the Job Alert Path in `classification-rules.md`. Four steps:

### Step 1: ATS sender match

Sender domain matches one of:
- `@greenhouse.io`, `@greenhouse-mail.io`, `no-reply@greenhouse.io`
- `@lever.co`, `notifications@lever.co`
- `@ashbyhq.com`

No match → skip (message falls through to Job Alert Path).

### Step 2: Status signal extraction

Scan subject + body for signal phrases. Highest-priority signal wins:

| Priority | Signal phrases | Status |
|---|---|---|
| 1 | "offer", "we're excited to extend" | Offer |
| 2 | "interview scheduled", "schedule your interview" | Interview |
| 3 | "we'd like to", "move forward with you", "next steps" | Screen/Interview |
| 4 | "unfortunately", "we've decided", "not moving forward", "other candidates" | Rejected |
| 5 | "application received", "thank you for applying" | Applied |

No signal phrase matched → downgrade to LOW tier in Step 4 (still written to Flagged for Review so the existence of the email is not lost).

### Step 3: Slug resolution

Resolve the email to a `{slug, match_method}` pair. Order of resolution (stop at first hit):

**3a. URL match (HIGH confidence)**

1. Extract all URLs from the email body.
2. Normalize each: strip query params, strip trailing slash, lowercase host.
3. For each entry in applications.md (Active + Closed + Flagged for Review), normalize its `**URL**:` field the same way.
4. Exact-match comparison. First hit wins. Posting URLs are globally unique so false positives here are effectively impossible.

Result: `match_method: url`.

**3b. Company-name match (MEDIUM confidence)**

Only runs if 3a produced no hit.

1. Extract company name using, in order:
   - Greenhouse: local-part of sender (`{company}@greenhouse-mail.io`)
   - Lever: sender display name, or `@{company}.lever.co` sender host
   - Ashby: sender display name, or subject prefix
   - Fallback: subject-line parse (`"Your application to {company}"`, `"Update from {company}"`)
2. Normalize: lowercase, strip `Inc|LLC|Corp|Ltd`, strip whitespace and punctuation.
3. For each entry in applications.md, take the text before `—` in the heading (`### {Company} — {Role}`), normalize the same way.
4. **Exact normalized match only** — no substring, no Levenshtein. String similarity is the main source of false positives in this domain.

Result: `match_method: name`.

**3c. No match (LOW confidence)**

Neither 3a nor 3b produced a hit. Result: `match_method: none`.

### Step 4: Tier assignment

| Tier | Criteria | Destination |
|---|---|---|
| **HIGH** | ATS sender ✓ + signal ✓ + `match_method: url` | Gate 2 (role-level confirmation, default-on) |
| **MEDIUM** | ATS sender ✓ + signal ✓ + `match_method: name` | Gate 2 (role-level confirmation, **default-off**, must be individually selected) |
| **LOW** | Any missing criterion: no signal, `match_method: none`, or signal phrase exists but is ambiguous (appears in multiple priority buckets) | Flagged for Review section of applications.md — appended without confirmation because it does not mutate any existing entry |

**Rule**: any uncertainty downgrades to the tier below, never up. MEDIUM defaulting off means name-only matches cannot be rubber-stamped. LOW bypasses the gate because appending to Flagged for Review is not a mutation.

### applications.md scope for resolution

Slug resolution searches **only the most recent** applications.md file (matching the existing state-io.md glob pattern). Older applications files are historical snapshots and are not consulted.

## applications.md schema changes

Two additive, backward-compatible changes.

### New section: `## Flagged for Review`

Appears after `## Closed Applications`. Entry shape:

```markdown
### Atlassian — VP Engineering — 2026-04-13

- **Detected signal**: "we've decided not to move forward" → Rejected
- **Sender**: no-reply@greenhouse-mail.io
- **Match method**: none (no entry found in applications.md)
- **Message-ID**: <gmail-message-id>
- **Action**: Resolve manually — confirm which application this refers to, or dismiss if unrelated
```

Entries persist until manually deleted. No slash command to resolve them in v1.

### Frontmatter: `flagged_count`

```yaml
---
format_version: 1
last_updated: 2026-04-13
active_count: 2
closed_count: 1
flagged_count: 0
---
```

`/pipeline` session hook surfaces non-zero `flagged_count` in its one-line summary.

### History entry format

History entries gain a `msg-id:` suffix for idempotency:

```markdown
#### History

- 2026-04-02: Applied — Added to pipeline
- 2026-04-13: Rejected — scan-email detected Greenhouse rejection (msg-id: <abc123>)
```

Before writing any status change, the skill greps the entire applications.md file for `msg-id: <abc123>`. A hit means the change is already applied — skip silently. This survives across scans and across re-runs of the same scan. No new state file.

## Confirmation gates (Phase 5)

Phase 5 becomes two sequential gates.

### Gate 1 — Role adds (unchanged)

```
| # | Company | Role | Source | Location | Comp | Link | Status |
|---|---------|------|--------|----------|------|------|--------|
...

Add these N roles to seen-postings? [y/N/edit]
```

### Gate 2 — Status changes (new)

Only shown if there are any HIGH or MEDIUM classifications.

```
⚠️  STATUS CHANGES DETECTED — review each carefully before accepting

[1] HIGH  ✓
    Atlassian — VP Engineering
    Current:   Applied (2026-04-02, 11 days ago)
    Detected:  Rejected
    Signal:    "we've decided not to move forward at this time"
    Sender:    no-reply@greenhouse-mail.io
    Match:     URL (https://boards.greenhouse.io/atlassian/jobs/5...)
    Message:   <gmail-msg-id>

[2] MEDIUM ⚠  name-only match — verify before accepting
    Schwab — Sr Director, Engineering
    Current:   Applied (2026-04-05, 8 days ago)
    Detected:  Rejected
    Signal:    "unfortunately"
    Sender:    talent@schwab.com
    Match:     name
    Message:   <gmail-msg-id>

Apply status changes?
  HIGH tier ([1]): accept all high-confidence? [y/N]
  MEDIUM tier ([2]): select by number or N to skip all: _
```

HIGH and MEDIUM are never approved by the same keystroke. MEDIUM requires typing a number or comma-separated list (or `N`). There is no "accept all" across tiers.

### Flagged for Review summary (informational, not a gate)

Printed after Gate 2:

```
📋  FLAGGED FOR REVIEW — 2 entries appended to applications.md

[A] Unknown company (Greenhouse) → possible Rejected
[B] Talkdesk → ambiguous signal, manual review needed

See ## Flagged for Review section of applications.md to resolve.
```

## Phase 6 — state writes for accepted status changes

For each accepted HIGH/MEDIUM classification:

1. **Idempotency check**: grep applications.md for `msg-id: <id>`. Hit → skip silently.
2. **Update the entry**:
   - Set `Stage:` to the detected status
   - Set `Last activity:` to `{today} — {new-status} — scan-email detected`
   - If status is Rejected: move entry from `## Active Applications` to `## Closed Applications`, set `Closed: {today}`, set `Summary:` to a one-line description of the detected signal
   - Append history entry: `- {today}: {new-status} — scan-email detected {ATS} {signal-type} (msg-id: <id>)`
3. **Update frontmatter counts**: recompute `active_count`, `closed_count`.
4. **For Rejected only**: print cleanup suggestion (see below).

For each LOW tier classification:
1. Append entry to `## Flagged for Review` section.
2. Increment `flagged_count` in frontmatter.

### Cleanup handling (Rejected path)

After Phase 6 writes complete, for each newly-rejected application:

1. Derive the output directory slug from the applications.md entry heading: take the text before `—`, lowercase, replace non-alphanumeric runs with `-`, strip leading/trailing `-`. Example: `The New York Times` → `the-new-york-times`. If multiple existing `output/*/` directories could match, print the ambiguity and suppress the cleanup suggestion.
2. Check if `output/{slug}/` exists and count files (`ls output/{slug}/ | wc -l` — read-only).
3. Print the suggestion block, once, at the end of the scan:

```
💡  Cleanup suggestions (copy and run if desired — scan-email will NOT delete these):

  rm -rf output/atlassian/        # 14 files
  rm -rf output/schwab/           # 8 files
```

If the slug cannot be resolved to an existing directory: print `💡 Could not auto-suggest cleanup for {company} — no matching output/ directory` and continue.

**The skill never deletes artifacts.** This contradicts a naive reading of the `feedback_cleanup_rejected_applications` memory rule; the safer interpretation is that the memory requires cleanup to happen, not that the skill must be the one running it. Eliminates the worst failure mode (wrong-slug `rm -rf` destroys real work) while preserving intent.

## Error handling

| Condition | Behavior |
|---|---|
| ATS sender matched, body fetch fails | Classify on subject + sender only; if subject has no signal phrase → LOW tier, Flagged for Review |
| applications.md is missing or empty | Skip Status Change Path entirely for this run; print `⚠️ No applications.md found — status detection skipped` |
| Multiple URL matches in one email | Take the first URL whose host is a known ATS domain; log the rest |
| Message-ID already in applications.md history | Silent skip — not surfaced in Gate 2 |
| Gate 2 interrupted (Ctrl-C) | Nothing written; next scan re-detects (message-ids not yet in history) |
| Slug resolves but `output/{slug}/` does not exist | Print suppressed-cleanup note; continue |
| Ambiguous signal (phrase matches multiple priority buckets) | Downgrade to LOW tier |

## Testing

### Fixtures

New directory: `skills/scan-email/test-fixtures/status/`

| File | Expected tier | Expected status | Expected match_method |
|---|---|---|---|
| `atlassian-rejection-greenhouse.txt` | HIGH | Rejected | url |
| `schwab-rejection-direct.txt` | MEDIUM | Rejected | name |
| `nyt-rejection-talent-acquisition.txt` | MEDIUM | Rejected | name |
| `realtor-interview-greenhouse.txt` | HIGH | Interview | url |
| `ambiguous-unfortunately.txt` | LOW | (no status) | n/a |
| `unknown-company.txt` | LOW | Rejected | none |

Plus `skills/scan-email/test-fixtures/applications-fixture.md` — a minimal applications.md used as the resolution target.

All fixtures sanitized of personal information. Real posting URLs are preserved because URL matching is the HIGH-tier load-bearing path.

### Test runner

`scripts/test-status-classifier.js` (bun). Reads each fixture, runs the Status Change Path against the fixture applications.md, asserts expected `{tier, status, slug, match_method}`. Exits non-zero on mismatch.

**Not wired into preflight.** Preflight stays lean. Runs manually (`bun scripts/test-status-classifier.js`) or via CI if/when CI exists for this repo.

## Open questions resolved during design

- **Q: Where does tier-3 "flag for review" output go?**
  A: New `## Flagged for Review` section of applications.md (persistent, surfaced by `/pipeline`).
- **Q: Confirmation UX shape?**
  A: Two sequential gates. HIGH and MEDIUM have separate prompts even within Gate 2.
- **Q: Should slug resolution search all applications files or only the most recent?**
  A: Most recent only (matches existing state-io.md glob behavior).
- **Q: Does the skill delete `output/{slug}/` on rejection?**
  A: No. Prints cleanup suggestions; user runs them manually.

## Risks accepted

1. **MEDIUM-tier false positives**: a same-name-different-company collision (e.g., two unrelated "Acme" entries) could cause the user to mark the wrong application as rejected. Mitigation: MEDIUM defaults off, requires per-entry selection. Residual risk: user approves without reading carefully. The two-gate split is the structural guard.
2. **URL normalization mismatch**: if applications.md stores a slightly different URL form than the ATS email emits (different query params, different domain variant), URL matching falls through to name matching. The MEDIUM tier handling catches this without wrong auto-apply.
3. **Signal phrase false negatives**: unusual rejection wording is classified as LOW and lands in Flagged for Review. User still sees it, just has to act manually. Acceptable.
4. **Idempotency gap if applications.md is edited out-of-band** (e.g., user manually clears History): rescan could re-apply the same status change. Low likelihood; mitigated by the confirmation gate catching the duplicate entry visually.
