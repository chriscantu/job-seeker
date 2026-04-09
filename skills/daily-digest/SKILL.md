---
name: daily-digest
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest. Trigger with "run my job
  digest", "check for new roles", "any new jobs today", or "job search
  update". State is persisted in output/ markdown files. When Apple Notes
  is configured, the digest is also written there for a native reading
  experience.
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch
---

# Daily Job Digest

Searches executive job boards, filters against the candidate's criteria,
deduplicates against previously seen postings, and writes the digest to
`output/` (plus Apple Notes when configured).

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Read `skills/_shared/batching.md` for reference — all phases in this skill
follow the batching protocol.

## Phase 0a — State & Optional Config

Read `skills/_shared/state-io.md` and execute the read pattern for:
- `seen-postings` — build dedup set of known URLs. Do NOT resurface any
  role already listed.
- `preferences` — extract interest signals and `last_run_date`.

Read `skills/daily-digest/source-strategy.md` for reference — it defines
how `search_since` is computed from `last_run_date`.

(Optional) If `integrations/config/notes-config.md` exists, read it to get
`plugin_root` and `default_folder` for Apple Notes writes.

(Optional) If `integrations/config/theirstack-config.md` exists, read it
for TheirStack config. Check budget per `source-strategy.md`.

## Filter Criteria

Read from `config/search.md`. Use the following fields to filter:

**Include:**
- Titles: values from "Target Role Titles" section
- Location: values from "Location Constraints" section
- Company type: "Company Types" field
- Comp: "Comp Floor" field — include roles likely to meet or exceed this

**Exclude:**
- Any company listed in "Companies to Skip" field
- Roles that violate location constraints
- IC/Staff Engineer roles
- Consulting or contract
- Postings verified as closed (see Phase 2)

## Phase 1 — Discovery

Read `skills/daily-digest/source-strategy.md` and execute.

This phase produces a raw candidate list from TheirStack, niche boards,
and/or WebSearch fallback. All searches batched per sub-phase.

Wait for all Phase 1 results before proceeding.

## Phase 2 — URL Verification

Read `skills/_shared/url-quality.md` and execute — filter out aggregator
URLs, find direct ATS/company links.

Read `skills/_shared/ats-verification.md` and execute — verify all
candidate URLs in a single parallel batch.

Wait for all verification results before composing the digest.

## Phase 3 — Compose and Write

Read `skills/daily-digest/scoring-rules.md` for star ratings, comp
evaluation, and the HTML template.

Score each verified role, compose the HTML digest, and write to
`output/digest-{date}.html`.

If `use_theirstack` was false due to API error or budget exhaustion (not
simply absent config), add a footer: "Note: TheirStack unavailable today
({reason}) — results sourced from web search only."

## Phase 4 — Apple Notes (optional)

Read `skills/_shared/apple-notes.md` and execute the create operation
for the digest note.

## Phase 5 — State Updates

Read `skills/_shared/state-io.md` and execute the append pattern for:
- `seen-postings` — add all roles from the digest (both included and
  excluded/closed) with posting dates
- `preferences` — append source effectiveness counts

If Apple Notes is configured, read `skills/_shared/apple-notes.md` and
execute the update operation for state notes (Seen Postings, Preferences).

## Error Handling — Apple Notes Write Failure

If the Apple Notes create script returns `error:`:
1. Log to `output/error-{date}.log`
2. The HTML file at `output/digest-{date}.html` is the fallback
3. Tell the user: "Apple Notes write failed — saved HTML fallback.
   Error: {exact message}"
4. Never silently fall back without surfacing the failure
