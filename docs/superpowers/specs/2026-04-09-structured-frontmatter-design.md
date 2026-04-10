# Structured Frontmatter for Per-Company Skill Output Files

**Date**: 2026-04-09
**Issue**: #36
**Status**: Approved

## Problem Statement

**User**: Downstream skills (cover-letter, resume-tailor, interview-prep) that consume
output from upstream skills (company-research)

**Problem**: Skills communicate through prose markdown files and rely on fragile header
parsing to extract metadata. If an upstream skill changes its heading format, downstream
skills break silently — no error, just wrong or missing data.

**Impact**: Any heading rename in company-research output silently breaks cover-letter
and resume-tailor. As more skills are added, the fragile coupling multiplies.

**Evidence**: The current company-research skill produces unstructured markdown that
downstream skills parse by section name. This coupling is observable in skill code today.

## Systems Analysis

**Dependencies**: Per-company artifacts (company-research.md, resume .md, cover-letter
.md) are produced by one skill each and consumed by 1-2 downstream skills. Docx
generation scripts (`generate_resume_docx.js`, `generate_coverletter_docx.js`) parse
the .md files with rigid line-order parsers.

**Scope boundary**: Central state files (seen-postings, preferences, applications)
are explicitly out of scope — they have dedicated parsers in `scripts/lib/` with
different concerns. A separate issue (#48) tracks frontmatter for those files.

**Key risk**: Docx generation scripts start parsing at line 0. A YAML frontmatter
block would be misinterpreted as content, producing a broken .docx with no error.

## Approach: Shared Frontmatter Utility Module

Selected over two alternatives:
- **A (skill-level only)**: No shared contract — each skill reinvents parsing, schema drifts
- **C (state.js extension)**: Over-engineered — violates SRP (state.js gains a second
  responsibility) and ISP (skills need full state CLI for simple reads)

Approach B follows SOLID principles: the frontmatter utility has a single
responsibility, new schemas extend without modifying the utility, and skills depend
on a frontmatter abstraction rather than concrete file format details.

## Frontmatter Schemas

All schemas share a common base: `skill`, `company`, `slug`, `role`, `url`, `generated`.
Each file type adds type-specific fields. Metadata only — prose content stays in the body.

### company-research.md

```yaml
---
skill: company-research
company: Natera
slug: natera
role: VP of Engineering, UX/Commercial Applications
url: https://job-boards.greenhouse.io/natera/jobs/5814300004
generated: 2026-04-08
rating: 4          # integer 1-5, from company-research scoring
remote: true
positioning_count: 3
gaps_count: 2
---
```

### {Name}_Resume_{Company}.md

```yaml
---
skill: resume-tailor
company: Natera
slug: natera
role: VP of Engineering, UX/Commercial Applications
url: https://job-boards.greenhouse.io/natera/jobs/5814300004
generated: 2026-04-08
research_date: 2026-04-07
requirements_matched: 5
---
```

### {Name}_CoverLetter_{Company}.md

```yaml
---
skill: cover-letter
company: Natera
slug: natera
role: VP of Engineering, UX/Commercial Applications
url: https://job-boards.greenhouse.io/natera/jobs/5814300004
generated: 2026-04-08
word_count: 380
---
```

## Frontmatter Utility (`scripts/lib/frontmatter.js`)

A small module with two functions and zero dependencies:

```js
parseFrontmatter(markdown) → { meta: {}, body: "" }
serializeFrontmatter(meta, body) → "---\nyaml\n---\nbody"
```

The YAML in our frontmatter is flat key-value pairs (no nesting, no arrays). Parsed
with simple string splitting — no npm dependency needed. If a value contains a colon,
it is quoted in the serialized output.

**Backward compatible**: if there is no frontmatter block, `parseFrontmatter` returns
the full content as `body` with an empty `meta` object.

## Shared Skill Module (`skills/_shared/frontmatter.md`)

An instruction document that skills reference. It defines:

1. **Schema contract** — common base fields + per-type fields
2. **Producer instructions** — serialize frontmatter before body when writing output
3. **Consumer instructions** — read frontmatter for routing decisions (exists? rating?
   staleness?) before parsing prose sections

Skills are AI — they parse YAML natively from file content. No runtime validation.
Missing frontmatter is treated as "not present" (backward compatible with old files).

## Docx Parser Updates

Both docx generation scripts strip frontmatter before parsing:

**`generate_resume_docx.js`** (~line 455):
```js
const { parseFrontmatter } = require("./lib/frontmatter");
const md = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;
```

**`generate_coverletter_docx.js`** (~line 27):
```js
const { parseFrontmatter } = require("./lib/frontmatter");
const raw = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;
```

Same pattern applied to `generate_ats_resume_docx.js` and `generate_article_docx.js`
if they read markdown input.

## Skill Instruction Updates

### company-research/SKILL.md — Phase 3 (Output Brief)
- Add "Read `skills/_shared/frontmatter.md`" instruction
- Update brief template to include frontmatter block before `# {Company Name}`
- Counts (`positioning_count`, `gaps_count`) derived from written content

### resume-tailor/SKILL.md — two touchpoints
- Phase 0 "Company Research Reuse": read frontmatter first — check `generated` for
  staleness, `rating` for context — then read prose Positioning section for content
- Phase 3 "Write the Tailored Markdown": add frontmatter block before resume content

### cover-letter/SKILL.md — two touchpoints
- Research Phase: read frontmatter from `company-research.md` if it exists — use
  `generated` date to assess staleness before reading prose
- Output: add frontmatter block before cover letter content

### No changes to
`why-this-company`, `interview-prep`, `linkedin-article`, `application-tracker`,
`daily-digest`, `scan-email` — they do not produce or consume per-company artifacts
in scope.

## Testing Strategy

- **Unit tests** for `scripts/lib/frontmatter.js`: parse, serialize, roundtrip,
  no-frontmatter passthrough, quoted values containing colons
- **Integration**: generate a resume .md with frontmatter, run
  `generate_resume_docx.js`, verify the .docx is identical to one produced without
  frontmatter. Same for cover letter.