---
name: resume-tailor
description: >
  Customize resume for a specific role — produces ATS-safe, ≤2-page .docx tailored
  per recruiter spec. Drives off references/resume.md (canonical), references/skills-master.md,
  and references/resume-template.docx. Output saved to
  output/{company-slug}/{Name}_Resume_{Company}.{md,docx,decisions.md}.
  Triggers: "tailor my resume", "customize resume for", "ATS resume for"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Resume Tailor (ATS edition)

Takes a job posting and produces a role-optimized, ATS-safe resume in `.docx`,
≤2 pages, per recruiter feedback (2026-05-01). See `tailoring-rules.md`,
`drop-strategy.md`, and `render.md` for the operational rules.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute. Additionally:

- Verify `references/resume.md` exists; halt with extraction instruction if not.
- Verify `references/skills-master.md` exists with ≥5 `[always]`-tagged entries.
- Verify `references/resume-template.docx` exists.
- Verify `pandoc` on PATH; halt with `brew install pandoc` if missing.
- Verify `soffice` and `pdfinfo` on PATH; halt with `brew install --cask libreoffice`
  and `brew install poppler` if missing.

### Phase Cache Check

Before starting analysis, check for cached results from a prior interrupted run.
See `skills/_shared/phase-cache.md` for the full caching convention.

1. `bun scripts/cache.js read resume-tailor analysis`
   - If exit 0: cached. Display: "Posting analysis cached at {cached_at} for {company}.
     Resume from compose? (yes / fresh)"
2. If not cached, proceed with Phase 1 normally.

## Required Inputs

- **Job posting URL** (required)
- **Specific points to emphasize** (optional)

## Phase 1 — Company Extraction

Read `skills/_shared/company-extraction.md` and execute. Then run the
`output/{company-slug}/evaluation.md` gate per existing convention.

## Phase 2 — Analyze, Score, Compose

Read `skills/resume-tailor/tailoring-rules.md` and execute. The pipeline:

1. Fetch JD; extract top 3-5 reqs, seniority signals, keywords.
2. Score every bullet in `references/resume.md` against keywords.
3. Reorder Key Accomplishments (6 fixed, by relevance).
4. Select 10 skills (5 floor + 5 JD-overlay) from `references/skills-master.md`.
5. Swap summary lead clause with the JD's top requirement.
6. Compose tailored markdown via `composeTailored`.

Cache analysis results before composing:

```fish
bun scripts/cache.js write resume-tailor analysis '<json>'
```

## Phase 3 — Render & Enforce

1. Render the tailored .md to .docx via `renderResume` (pandoc + reference-doc template).
2. Verify page count via `pageCount` (wraps `scripts/resume-page-count.fish`).
3. If pages > 2, run `enforceTwoPages` — drops oldest+lowest bullet, re-renders, up to 5 iterations.
4. Hard fail with diagnostics if drop pool exhausted or iteration limit reached.

Output:

```
output/{company-slug}/{Name}_Resume_{Company}.md
output/{company-slug}/{Name}_Resume_{Company}.docx
output/{company-slug}/{Name}_Resume_{Company}.decisions.md
```

## Phase 4 — State Update

Read `skills/_shared/state-io.md`. Append `RESUME TAILORED` flag to the seen-postings entry.

If the company has an applications-pipeline entry:

```fish
bun scripts/state.js add-note applications --company "{company}" --note "Resume tailored {YYYY-MM-DD}"
```

If exit non-zero, log a note: "No application entry — run /application-tracker to add it."

## Error Handling

See full table in `docs/superpowers/specs/2026-05-01-ats-resume-template-design.md`.
Hard-fail philosophy: every fail surfaces (a) what failed, (b) why, (c) remediation.
Tailored .md preserved on failure.

## Key Constraints

- Never fabricate experience.
- Bullet facts (numbers, scope, outcomes) verbatim from canonical.
- Education and Header are verbatim.
- Recruiter spec (no CAR labels, every bullet has Impact, Skills max 10 pipe-delimited)
  is binding.
- 2-page limit is HARD — content drops first per drop-strategy.md.
