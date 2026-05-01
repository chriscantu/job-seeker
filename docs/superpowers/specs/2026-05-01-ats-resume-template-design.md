# ATS Resume Template — Design Spec

**Date:** 2026-05-01
**Author:** Christopher Cantu (with Claude)
**Status:** Draft, pending implementation plan
**Related:** Recruiter feedback session 2026-05-01; supersedes legacy `resume-tailor` flow

---

## Problem Statement

**User:** Chris (VP / Sr. Director Engineering applicant; active job search since 2026-04-06).

**Problem:** Current resume not ATS-parseable. Recruiter feedback (2026-05-01) flagged silent rejection by ATS systems before human review. No repeatable method to produce role-tailored, ATS-friendly resumes that incorporate recruiter feedback.

**Impact:** Pre-screen filter blocks applications, zero interview signal, search drags. Urgent.

**Evidence:** Direct recruiter feedback today, six concrete spec items (below).

**Constraints:**
- Output: `.docx`
- Source: markdown (`references/resume.md`) — promoted to canonical, replacing `resume.pdf`
- **HARD: ≤2 pages.** Content dropped to fit
- Professional visual quality (color OK)
- Integrate with existing `resume-tailor` skill (rewrite in place)
- Recruiter spec mandatory:
  - Key Achievements: pipe-delimited / bullets, ATS-parseable
  - Color allowed (visual hierarchy only)
  - Summary: tightened, leadership-positioned (recruiter draft = default)
  - Skills: max 10, ` | `-delimited, role-tailored
  - CAR: implicit by ordering — never literal "Challenge:/Action:/Results:" labels
  - Every Result has Impact (additive, no rewording existing wins)

**Drop heuristic:** oldest role's bottom bullets first; relevance-tiebreak within role; current role + structural sections (Summary, Skills, Key Accomplishments, Education) protected.

---

## Approach Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Renderer | `anthropic-skills:docx` skill | Avoid custom parser, no Python in repo, maintained upstream |
| Canonical source | Promote to `references/resume.md` | Markdown-native pipeline; PDF retired to archive |
| 2-page enforcement | Heuristic budget + post-render verify (hybrid) | HARD constraint demands ground-truth; heuristic keeps common path fast |
| Skill structure | Rewrite `resume-tailor` in place | Old rules contradict recruiter spec; net code decrease |
| Summary baseline | Recruiter draft verbatim default + lead-clause swap per JD | Strong leadership-positioned floor; tailored top |
| Skills selection | 5 floor + 5 JD-overlay (curated tiers) | Predictable consistency + role responsiveness |
| Template visual | Deep navy accent / Calibri / 0.75in margins / centered name | User selections |
| Test language | TypeScript (bun test) | Single test runner, type-safe fixtures |

### Think-Before-Coding Preamble (locked at brainstorming)

**Assumptions:**
- `anthropic-skills:docx` skill stable and supports template-driven named styles
- `soffice` (LibreOffice) and `pdfinfo` (poppler) installable locally
- Recruiter feedback complete (no items pending follow-up)
- Master skill list cleanly tag-able as `[always]` / `[situational]`

**Interpretations:** none material — all branches resolved.

**Simpler-path challenge:** pandoc one-shot. Rejected: cannot iterate-and-measure for HARD ≤2-page constraint.

---

## Architecture

### Component layers

```
LAYER 1 — SOURCE
  references/resume.md                      canonical content (full bullet inventory)
  references/skills-master.md               skills with [always]/[situational] tags
  references/resume-template.docx           Word styles: navy / Calibri / 0.75in / centered

LAYER 2 — SKILL
  skills/resume-tailor/SKILL.md             orchestration (rewritten)
  skills/resume-tailor/tailoring-rules.md   recruiter spec + drop strategy (rewritten)
  skills/resume-tailor/drop-strategy.md     drop order + protected sections (NEW)
  skills/resume-tailor/render.md            docx skill invocation contract (NEW)

LAYER 3 — TOOLING
  scripts/resume-page-count.fish            soffice + pdfinfo wrapper (NEW)
  scripts/cache.js                          phase cache (REUSE)
  scripts/state.js                          applications pipeline (REUSE)
  anthropic-skills:docx                     render engine (REUSE)
  scripts/generate_resume_docx.js           DELETE — superseded

LAYER 4 — OUTPUT
  output/{slug}/{Name}_Resume_{Co}.md       tailored markdown
  output/{slug}/{Name}_Resume_{Co}.docx     rendered output (≤2 pages)
  output/{slug}/{Name}_Resume_{Co}.decisions.md   audit log
```

### Boundaries

- Markdown content layer never knows about styling
- Template layer never knows about content
- `anthropic-skills:docx` is the single integration point
- Drop logic operates on parsed markdown, not on rendered pages
- Page-count check is a post-render gate that fires the drop loop

### Downstream skill integration

`cover-letter`, `interview-prep`, `evaluate` skills currently read `references/resume.pdf`. Migration: swap to `references/resume.md`. Audit pass required as part of implementation plan (out of scope for this skill, in scope for the rollout).

---

## Markdown Schema

Both `references/resume.md` and tailored outputs use the same schema. Tailored = subset + reordered.

```markdown
---
generated: 2026-05-01            # tailored output only
company: Acme Corp               # tailored output only
role: VP Engineering             # tailored output only
posting_url: https://...         # tailored output only
template_version: 1              # both
canonical_version: 2026-04-15    # both — date of last resume.md edit
---

# Christopher Cantu

**Senior Engineering Leader | Delivery Transformation Specialist**

christopher.cantu@gmail.com | Austin, TX | linkedin.com/in/christophermcantu

[Summary paragraph — recruiter draft default; lead clause swapped per JD when tailored]

## Key Accomplishments

- **Revenue Impact** — Delivered $18M+ in business value through delivery transformation and international expansion | **Impact:** Unlocked European/Asian market revenue ahead of plan
- **Delivery Excellence** — Transformed CI/CD from 1-5% to 95-99% reliability | **Impact:** Enabled 3x faster product release cadence
- ...(6 total)

## Skills

Delivery Transformation | Multinational Team Leadership | Platform Engineering | CI/CD Optimization | Engineering Strategy | <5 JD-tailored>

## Professional Experience

### Director of Engineering | Procore Technologies

*Austin, TX (Hybrid) | September 2023 – April 2026 | 60 engineers, 8 international teams*

- Led $50M+ frontend modernization across 125+ repos and 65+ global teams. **Impact:** $12M+ revenue unlocked in European/Asian markets within first year.
- Achieved 85% design system adoption across 185 repos in 6 months via AI-driven automation. **Impact:** Fastest design-system rollout in company history.
- Partnered with VP Product, VP Engineering, VP Customer Success on tech strategy. **Impact:** Aligned international growth roadmap across 3 regions.

### Director of Front End Platforms | Babylon Health
...

## Education

**Master of Science in Information Systems | Bachelor of Business Administration**

Baylor University
```

### Schema rules

- **Key Accomplishments**: `**Label** — what | **Impact:** outcome` per line. Pipe separates label/desc/impact for ATS parseability.
- **Skills**: single line, ` | `-delimited, max 10. No category headers.
- **No `Challenge:` / `Action:` / `Results:` literal labels.** Implicit CAR by bullet ordering: lead bullet = challenge framing, mid bullets = actions, every bullet ends with `**Impact:**` clause.
- **Every bullet has Impact.** Additive — preserve canonical scope and numbers, append impact clause if missing.
- Pipe (`|`) reserved for Skills line and Key Accomplishment fields. Bullets use prose + bold Impact.

---

## Drop Strategy + Length Budget

### Length budget (heuristic first pass)

Calibrated for 0.75in margins, Calibri 11pt body, single-spaced, against `template.docx`. Verify on first render.

| Section | Lines (max) | Drop status |
|---|---|---|
| Header (name + tagline + contact) | 4 | protected |
| Summary | 5–6 | protected |
| Key Accomplishments | 6 | protected (recruiter-mandated) |
| Skills line | 1–2 | protected |
| Professional Experience | ~30–35 | drop pool |
| Education | 2–3 | protected |
| **Total** | ~50–55 | 2-page target |

Per-role bullet allocation (initial):
- Most recent role (Procore): up to 5
- Role 2 (Babylon): up to 4
- Role 3 (Vrbo, both subroles combined): up to 4

### Algorithm

```
input: tailored_markdown, jd_keywords, jd_scores
loop iteration < 5:
  render docx via anthropic-skills:docx
  pages = page_count(docx)
  if pages <= 2: break, return success
  bullet = select_drop_target(markdown, jd_scores)
  if bullet is None: HARD FAIL — drop pool exhausted
  remove bullet from markdown
  log decision in decisions.md
```

### `select_drop_target`

```
1. Identify drop pool: bullets in oldest role first
2. Within drop pool, sort by relevance score ASC (lowest JD-relevance first)
3. Tiebreak: bottom of role section
4. If oldest role exhausted, advance to second-oldest role
5. NEVER drop from current role
6. NEVER drop Summary, Skills, Key Accomplishments, Education, Header
7. If oldest + second-oldest pools exhausted AND still > 2 pages:
   HARD FAIL with current draft + diagnostics
```

### Decisions log shape

```markdown
# Tailoring Decisions — Acme Corp / VP Engineering

## JD Requirements Keyed
- platform engineering at scale (high)
- international team leadership (high)
- CI/CD modernization (medium)

## Skills Selection (10/10)
Floor (5): Delivery Transformation | Multinational Team Leadership | Platform Engineering | CI/CD Optimization | Engineering Strategy
JD-overlay (5): Design Systems | Micro-Frontends | TypeScript | Observability | Feature Flags

## Summary
Lead clause swapped: "Senior Engineering Leader specializing in **platform engineering and delivery transformation**..."

## Bullets Dropped (3, oldest first)
1. Vrbo / Sr Manager / "Pioneered WCAG-compliant accessibility..." — score 1.2/5, oldest role bottom
2. Vrbo / Sr Manager / "Successfully executed multiple large-scale system migrations..." — score 0.8/5, oldest role bottom
3. Vrbo / Director / "Led performance testing and chaos engineering..." — score 1.5/5, second-oldest bottom

## Final State
2 pages | 38 lines | 3 bullets dropped | 2 render iterations
```

---

## Render Pipeline

### docx skill invocation

`anthropic-skills:docx` invoked with:
- `markdown_path`: tailored `.md`
- `template_path`: `references/resume-template.docx`
- `output_path`: target `.docx`

Skill emits paragraph styles by element type. Style names defined in template MUST match.

| Markdown element | Style name in template |
|---|---|
| `# H1` | `Heading 1` (overridden: name banner) |
| `**bold-only line** under H1` | custom: `Tagline` |
| Plain paragraph after tagline | `Contact` |
| `## H2` | `Heading 2` (section dividers) |
| `### H3` | `Heading 3` (role title \| company) |
| `*italic line*` | `Role Meta` |
| Bullet list `- ...` | `List Bullet` (overridden: tight) |
| Skills line | `Skills Line` |
| Accomplishment line | `Accomplishment` |
| `**bold run** within paragraph` | inline bold run, no style |

Restyling: edit named styles in `template.docx` in Word, save. No code change.

### `scripts/resume-page-count.fish`

```fish
#!/usr/bin/env fish
# Usage: resume-page-count.fish <docx-path>
# Outputs integer page count. Exits non-zero on failure.

set docx $argv[1]
set tmpdir (mktemp -d)
soffice --headless --convert-to pdf --outdir $tmpdir $docx > /dev/null 2>&1
or begin; rm -rf $tmpdir; exit 2; end

set pdf $tmpdir/(basename $docx .docx).pdf
set pages (pdfinfo $pdf | grep -E '^Pages:' | awk '{print $2}')
rm -rf $tmpdir

if test -z "$pages"
    exit 3
end
echo $pages
```

### Preflight (skill startup)

- `which soffice` — fail with `brew install --cask libreoffice` instruction if missing
- `which pdfinfo` — fail with `brew install poppler` instruction if missing
- `references/resume.md` present
- `references/resume-template.docx` present
- `references/skills-master.md` present (≥5 `[always]`-tagged entries)

---

## Error Handling

| Condition | Behavior |
|---|---|
| `references/resume.md` missing | HARD FAIL — direct user to extract from `resume.pdf` or restore |
| `references/resume-template.docx` missing | HARD FAIL — cannot render |
| `references/skills-master.md` missing | HARD FAIL — cannot select 10-skill list |
| `soffice` not on PATH | HARD FAIL — install instruction |
| `pdfinfo` not on PATH | HARD FAIL — install instruction |
| `anthropic-skills:docx` invocation error | Surface error verbatim; leave tailored .md for debug; non-zero exit |
| JD URL 404 | HARD FAIL — verify URL |
| JD parse — no requirements extracted | WARN; continue with floor-only Skills + verbatim recruiter Summary; log gap in decisions.md |
| Master skill list <5 `[always]` tags | HARD FAIL — under-defined floor |
| Pages > 2 + drop pool exhausted | HARD FAIL with diagnostics — dump rendered docx, list drops, suggest template review |
| Iteration > 5 | HARD FAIL — drop loop did not converge |
| Bullet missing Impact in canonical | WARN once per run; tailoring proceeds; flagged in decisions.md |
| `output/{slug}/` missing | Create silently |
| Existing tailored output present | Overwrite without prompt |
| Downstream skills break on new schema | OUT OF SCOPE for this skill; flag in implementation plan as audit task |

**Hard-fail philosophy:** never silent. Every fail surfaces (a) what failed, (b) why, (c) concrete remediation. Tailored .md preserved on failure for debugging.

---

## Testing Strategy

### Unit tests (TypeScript, `bun test`)

`tests/resume-tailor/`:

- `parse-canonical.test.ts` — resume.md parses cleanly into AST. Property: every bullet has Impact OR is flagged.
- `score-bullets.test.ts` — JD keyword extraction → relevance score per bullet (3 sample JDs).
- `select-skills.test.ts` — 5 floor + ≤5 JD-overlay, deduped, max 10.
- `summary-lead-clause-swap.test.ts` — Lead clause swap; rest verbatim. No new claims.
- `drop-target-select.test.ts` — Oldest-role bottom-up; relevance tiebreak; current-role protection; exhaustion.
- `compose-tailored.test.ts` — Schema conformance: pipe-delimited Skills, every bullet has Impact, no literal CAR labels.

### Integration tests (TypeScript, shell out via `Bun.spawn`)

- `render-integration.test.ts` — tailored.md + template → docx exists, non-zero, valid zip.
- `page-count.test.ts` — known 1-page docx → outputs 1; known 3-page docx → outputs 3.
- `enforcement-loop.test.ts` — oversize tailored.md → loop converges to ≤2 pages, decisions.md correct.
- `drop-exhaustion.test.ts` — oversized template → HARD FAIL surfaces correctly.
- `style-fidelity.test.ts` — unzip output docx, grep `word/styles.xml` for named styles preserved.

### End-to-end (TypeScript)

- `e2e-fixtures.test.ts` — 3 saved JD fixtures (platform VP, scaling director, AI infra). For each: skill end-to-end, output exists, ≤2 pages, decisions.md present, drops match expected pattern.
- ATS smoke (manual once per release): open output `.docx` in https://www.jobscan.co/ — confirm Skills, Education, Roles parsed. Log result in `tests/resume-tailor/ats-smoke-{date}.md`.

### Verification gate

Before declaring skill done:
- `bun test` clean
- `tsc --noEmit` clean (any TS touched)
- 3 e2e runs against fixtures complete with ≤2 pages
- 1 manual ATS-parser run logged

### Regression protection

- Snapshot tests on canonical fixtures; diff fails on drift
- Pre-commit `references/resume.md` schema validator: fails commit if Impact missing on a bullet, Skills > 10, etc.

---

## Out of Scope (for this design)

- Cover-letter / interview-prep / evaluate skill audits for new `resume.md` source — handled in implementation plan rollout
- Ghost-job posting detection (issue #68)
- Resume PDF export (downstream concern; ATS submissions take .docx)
- Recruiter-facing variants (this template is one shape; variant pool was rejected)
- ATS-specific tuning per system (Workday vs Greenhouse vs Lever) — deferred until first failure observed

---

## Open Questions / Follow-ups

1. **Master skill list curation** — `references/skills-master.md` does not exist yet. Implementation plan must include one-time authoring pass (~10 min): tag every skill from current resume `[always]` or `[situational]`, with at least 5 `[always]`.
2. **Template authoring** — `references/resume-template.docx` does not exist. Implementation plan must include one-time Word authoring (~30 min): create named styles per the render mapping, apply navy / Calibri / 0.75in / centered.
3. **Canonical extract** — `references/resume.pdf` → `references/resume.md` requires one-time extract + manual cleanup (~30 min) to align with new schema (Impact clauses, pipe-delimited Skills, etc.).
4. **Recruiter Summary length** — recruiter draft is 4 sentences; ATS norm is 2–3. Decision: keep verbatim per user's pick, revisit if too long after first render.

---

## Acceptance Criteria

- `references/resume.md` exists, schema-valid, full bullet inventory with Impact clauses
- `references/skills-master.md` exists, ≥5 `[always]`-tagged skills
- `references/resume-template.docx` exists with required named styles
- `skills/resume-tailor/` rewritten per design; old contradicting rules removed
- `scripts/generate_resume_docx.js` deleted; `scripts/resume-page-count.fish` added
- All tests in test plan green
- Three sample JDs produce ≤2-page `.docx` outputs end-to-end
- One manual ATS-parser smoke run passes (Skills + Education + Roles all extracted)
- Downstream skill audit complete (cover-letter, interview-prep, evaluate read new canonical without breakage)
