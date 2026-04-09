# Skill Module Extraction & Decomposition

**Issues:** #31 (extract shared logic), #34 (decompose monolithic skills)
**Date:** 2026-04-08
**Status:** Approved

---

## Problem

30% of all SKILL.md content (~750 of ~2,467 lines) is duplicated across 11 skills.
Duplicated logic includes config preflight, state I/O, ATS verification, URL quality
rules, company extraction, Apple Notes integration, batching protocol, and title
normalization. When a shared rule changes, every copy must be updated independently.

Additionally, the largest skills (daily-digest at 460 lines, scan-email at 596) mix
orchestration, business rules, templates, and integration details in a single file.
This wastes context window, increases instruction drift risk, and makes maintenance
harder.

---

## Solution

Extract duplicated logic into 7 shared modules under `skills/_shared/`. Decompose
each skill's SKILL.md into an orchestrator that references shared and local modules
on demand per phase.

---

## Shared Modules (`skills/_shared/`)

### `preflight.md`

Combined config validation and standard reads. Every skill starts here.

- Run `bun scripts/validate-config.js` — fail-fast on non-zero exit
- Read `PRINCIPLES.md` — quality standards, voice guidelines, privacy constraints
- Read `config/candidate.md` — candidate name, role, strengths, accomplishments
- Read `config/search.md` — target titles, comp floor, location, skip list

All four reads happen for every skill. The cost of reading search.md in skills that
don't strictly need it is negligible compared to the consistency benefit.

### `state-io.md`

Glob/read/append patterns for all state files.

**Read pattern:**
- Glob `output/*-{type}.md`, sort descending, read the most recent file
- If no file exists, treat as empty (no prior state)
- Supported types: `seen-postings`, `preferences`, `applications`

**Append pattern:**
- Append entries under a `## YYYY-MM-DD` section header
- Create `output/YYYY-MM-DD-{type}.md` if no file exists

**Entry format (seen-postings):**
```
- {Company} | {Title} | {URL} | posted:YYYY-MM-DD
```
- `posted:` = original publish date from ATS API
- `discovered:` = fallback when posted date unavailable
- Optional metadata flags appended by skill: `source:email-{label}`, status flags
  like `RESEARCHED`, `RESUME TAILORED`

**Dedup set:**
When reading seen-postings, build a set of known URLs. Skills that need richer dedup
(e.g., scan-email's company+title tuples) state the extension in their orchestrator
after the module reference.

### `ats-verification.md`

URL routing and API interpretation for job posting verification.

- References `integrations/adapters/ats-apis.md` for endpoint details — does not
  duplicate the API contract
- Adds orchestration: when to verify, how to batch verification calls, how to
  interpret results
- Posting date extraction field mapping:
  - Greenhouse: `updated_at`
  - Lever: `createdAt` (epoch ms)
  - Ashby: not exposed in public API
  - WebFetch: best-effort from page metadata
- Error handling: 404 = closed, 5xx = fallback to WebFetch, all non-blocking

### `url-quality.md`

Aggregator exclusion, URL prioritization, and title normalization.

- **Aggregator exclusion list:** EchoJobs, Jobera, SimplyHired, RemoteRocketship,
  and others — these URLs are deprioritized or excluded
- **URL priority tiers:**
  1. Direct ATS URL (Greenhouse, Lever, Ashby)
  2. Company careers page
  3. Reputable job board (LinkedIn, Wellfound, Built In)
  4. Aggregator
- **Common ATS URL patterns** for recognition
- **Tracking redirect resolution** guidance
- **Title normalization:** expand abbreviations before matching/display
  - "Sr." / "Sr " → "Senior"
  - "Jr." / "Jr " → "Junior"
  - "Eng." / "Eng " → "Engineering"
  - Other common abbreviations as encountered

### `company-extraction.md`

Parse company name and slug from job posting URLs.

- WebFetch the URL, extract company name from page title, meta tags, or ATS structure
- Extract role title, location, and company website domain where available
- Derive `{company-slug}`: lowercase, spaces → hyphens, strip special characters
  (e.g., "Maven Clinic" → `maven-clinic`)
- Create `output/{company-slug}/` directory when needed
- Error handling:
  - URL returns 404 or unparseable → stop: "Could not access that posting"
  - Company name undetermined → stop: "Could not identify the company"

### `apple-notes.md`

Optional Apple Notes integration. Non-blocking — errors are logged, never fatal.

- Check `integrations/config/notes-config.md` exists — if absent, skip silently
- Read `plugin_root` and `default_folder` from config
- Two operations:
  - **Create:** `osascript {plugin_root}/scripts/apple_notes_create.applescript
    "{title}" "{html_body}" "{folder}"`
  - **Update:** `osascript {plugin_root}/scripts/apple_notes_update.applescript
    "{title}" "{html_body}" "{folder}"`
- All errors are non-blocking: log the error, continue skill execution

### `batching.md`

Universal batching rule for all multi-call operations.

- Every tool call in a skill MUST be batched — issue all searches, fetches, or
  verifications in a single message with parallel tool calls
- Never issue searches or verifications one at a time — this forces per-call user
  approval and creates a poor experience
- Applies to: WebSearch, WebFetch, ATS API calls, and any other multi-target operations
- If a phase has N independent calls, they go in one message, not N messages

---

## Skill Decomposition

### Orchestrator Pattern

Every SKILL.md follows this structure after decomposition:

```markdown
# Skill Name

## Phase 0 — Preflight
Read `skills/_shared/preflight.md` and execute.

## Phase 1 — [Skill-specific]
[Orchestration logic — decisions, flow control]
Read `skills/{skill}/local-module.md` for [specific concern].

## Phase 2 — [Skill-specific]
Read `skills/_shared/ats-verification.md` and execute.
[Phase-specific decisions]

## Phase N — State Update
Read `skills/_shared/state-io.md` and append results.
```

### Module Reference Convention

- **Directive format:** `Read \`skills/_shared/module.md\` and execute.`
- Always use backtick-quoted relative paths from project root
- Always include the verb: `and execute` for procedural modules, `for reference`
  for lookup-only modules
- One directive per concern — never combine multiple module reads in one sentence
- **Conditional references:** conditions stay in the orchestrator, not the module
  ```
  If this phase verifies ATS URLs, read `skills/_shared/ats-verification.md` and execute.
  ```
- **Skill-specific extensions:** stated after the module directive, not parameterized
  into the module
  ```
  Read `skills/_shared/state-io.md` and execute.
  Additionally, build dedup tuples of (company_name_lowercase, title_lowercase).
  ```

### Per-Skill Breakdown

**daily-digest** (460 → ~150 orchestrator)
- Local: `scoring-rules.md` (star ratings, comp evaluation, freshness weighting),
  `source-strategy.md` (TheirStack queries, niche board rotation, search construction)
- Shared: preflight, state-io, ats-verification, url-quality, batching, apple-notes

**scan-email** (596 → ~180 orchestrator)
- Local: `classification-rules.md` (subject/body pattern matching, sender routing,
  abbreviation-aware filtering), `body-extraction.md` (HTML parsing, field extraction)
- Shared: preflight, state-io, ats-verification, url-quality, batching, apple-notes

**resume-tailor** (320 → ~120 orchestrator)
- Local: `tailoring-rules.md` (section rewriting strategy, keyword matching,
  accomplishment selection)
- Shared: preflight, state-io, company-extraction

**application-tracker** (278 → ~100 orchestrator)
- Local: `pipeline-schema.md` (stage definitions, staleness thresholds, transition rules)
- Shared: preflight, state-io, apple-notes

**company-research** (169 → ~80 orchestrator)
- Local: none — remaining content compact enough to stay inline
- Shared: preflight, state-io, company-extraction, batching

**cover-letter** (126 → ~70 orchestrator)
- Local: none
- Shared: preflight, state-io, company-extraction

**why-this-company** (117 → ~60 orchestrator)
- Local: none
- Shared: preflight, state-io

**linkedin-article** (129 → ~80 orchestrator)
- Local: none
- Shared: preflight

**setup** (194 → ~140 orchestrator)
- Local: none
- Shared: preflight (override: setup runs validate-config and displays the output
  to the user regardless of exit code, rather than fail-fast on non-zero. The
  orchestrator states: "Read `skills/_shared/preflight.md` and execute, but display
  validate-config output even on success — setup's purpose is to show config status.")

**interview-prep** (38 → ~25 orchestrator)
- Local: none
- Shared: preflight

**networking-outreach** (38 → ~25 orchestrator)
- Local: none
- Shared: preflight

---

## Existing References

`integrations/adapters/ats-apis.md` stays unchanged. `skills/_shared/ats-verification.md`
references it for endpoint specs rather than duplicating the API contract. The adapter
owns the raw API details; the shared module owns the orchestration logic around when
and how to use them.

---

## Migration Strategy

- Duplicated blocks in each SKILL.md → deleted, replaced with module directives
- Skill-specific logic extracted to local `.md` files → replaced with Read directives
- Remaining orchestration → stays in SKILL.md, restructured into clear phases
- No behavioral changes — every skill produces identical output before and after
- Validation: manually invoke each skill after decomposition and verify output matches

---

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Total SKILL.md lines | 2,467 | ~1,100 (orchestrators) + ~350 (local modules) + ~250 (shared modules) = ~1,700 |
| Duplicated lines | ~750 (30%) | ~0 (shared modules are single source of truth) |
| Context loaded per skill invocation | 200-600 lines upfront | 100-180 lines upfront + modules on demand |
| Files to update when shared logic changes | 3-11 | 1 |
