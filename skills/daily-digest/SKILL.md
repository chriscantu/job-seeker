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

Read state via the CLI (parse stdout JSON):
- `bun scripts/state.js read seen-postings` — build dedup set of known
  URLs from the returned entries. Do NOT resurface any role already listed.
- `bun scripts/state.js read preferences` — extract interest signals and
  `last_run_date` from the returned object.

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

### Phase Cache Check

Before starting discovery, check for cached results from a prior interrupted run.
See `skills/_shared/phase-cache.md` for the full caching convention.

1. Run `bun scripts/cache.js read daily-digest phase2`
   - If exit 0: Phase 2 results are cached. Display: "Verification cached at {cached_at} — {N} roles verified. Resume from compose?" If user confirms, skip to Phase 3 using the cached data. If user says "fresh", proceed normally.

2. If Phase 2 was not cached, run `bun scripts/cache.js read daily-digest phase1`
   - If exit 0: Phase 1 results are cached. Display: "Discovery cached at {cached_at} — {N} roles found. Resume from verification?" If user confirms, skip to Phase 2 using the cached data. If user says "fresh", proceed normally.

3. If neither cached, proceed with Phase 1 normally.

## Phase 1 — Discovery

Read `skills/daily-digest/source-strategy.md` and execute.

This phase produces a raw candidate list from TheirStack, niche boards,
and/or WebSearch fallback. All searches batched per sub-phase.

Wait for all Phase 1 results before proceeding.

#### Cache Phase 1 Results

After discovery completes, cache the results for resumption:
`bun scripts/cache.js write daily-digest phase1 '<json>'`
— include the full candidate list and source metadata.

## Phase 2 — URL Verification

Read `skills/_shared/url-quality.md` and execute — filter out aggregator
URLs, find direct ATS/company links.

Read `skills/_shared/ats-verification.md` and execute — verify all
candidate URLs in a single parallel batch.

Wait for all verification results before composing the digest.

#### Cache Phase 2 Results

After verification completes, cache the results:
`bun scripts/cache.js write daily-digest phase2 '<json>'`
— include verified roles, closed postings, and source stats.

## Phase 3 — Compose and Write

Read `skills/daily-digest/scoring-rules.md` for star ratings, comp
evaluation, and the HTML template.

Score each verified role, compose the HTML digest, and write to
`output/digest-{date}.html`.

If `use_theirstack` was false due to API error or budget exhaustion (not
simply absent config), add a footer: "Note: TheirStack unavailable today
({reason}) — results sourced from web search only."

## Phase 4 — Apple Notes (optional)

Skip if `integrations/config/notes-config.md` does not exist.

Read `skills/_shared/apple-notes.md` and execute the create operation
for the digest note.

## Phase 5 — State Updates

Append state via the CLI (the CLI auto-creates today's file if none exists):
- For each role from the digest (both included and excluded/closed):
  `bun scripts/state.js append seen-postings '<json>'` with `company`,
  `title`, `url`, `posted` (or `discovered`) date, and any flags.
- `bun scripts/state.js append preferences '<json>'` for source
  effectiveness counts.

If Apple Notes is configured, read `skills/_shared/apple-notes.md` and
execute the update operation for state notes (Seen Postings, Preferences).

## Error Handling — Apple Notes Write Failure

If the Apple Notes create script returns `error:`:
1. Log to `output/error-{date}.log`
2. The HTML file at `output/digest-{date}.html` is the fallback
3. Tell the user: "Apple Notes write failed — saved HTML fallback.
   Error: {exact message}"
4. Never silently fall back without surfacing the failure
