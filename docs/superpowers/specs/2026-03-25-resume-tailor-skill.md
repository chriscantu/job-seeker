# Design Spec: Resume Tailor Skill

**Date**: 2026-03-25
**Status**: Draft
**Author**: Chris Cantu + Claude

---

## Problem

The resume-tailor skill is stubbed but has real infrastructure behind it
(`scripts/generate_resume_docx.js`, `scripts/docx-styles.js`). The gap
is defining *what tailoring means* at an executive level:

1. **Not a rewrite**: VP/Senior Director resumes don't change drastically
   per application. The accomplishments are the same — the emphasis shifts.
2. **Not just reordering**: Sometimes a bullet needs slight reframing to
   highlight a different dimension of the same accomplishment.
3. **ATS compatibility**: Many companies use ATS keyword scanning. The
   tailored resume must surface relevant keywords from the posting without
   keyword-stuffing.

**Target**: A skill that takes a job posting and produces a role-optimized
resume that emphasizes the most relevant accomplishments, adjusts framing
where appropriate, and passes ATS keyword checks — all without fabricating
experience.

---

## Decision

Build resume-tailor as a multi-phase skill: analyze posting → score
accomplishments → reorder and optionally reframe → generate .docx.

### Constraints (Non-Negotiable)

1. **Never fabricate experience** — only reorder, emphasize, and lightly
   reframe existing content from `references/resume.pdf`
2. **Never remove sections** — all resume sections remain; only bullet
   order within sections changes
3. **Preserve formatting** — use `scripts/docx-styles.js` for consistent
   bullet alignment and styling
4. **Flag gaps honestly** — if the posting requires something Chris doesn't
   have, call it out rather than papering over it

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Full rewrite per application | Risky at exec level — resume should be recognizably consistent |
| Keyword injection only | Surface-level; doesn't help with human reviewers |
| Multiple resume versions maintained manually | Doesn't scale; this is what the tool automates |

---

## Workflow

### Phase 1: Analyze the Posting

**Inputs** (ask for what's missing):
- Company name (required)
- Role title (required)
- Job posting URL (required — fetch and parse)
- Specific emphasis requests (optional — user may want to highlight certain experience)

**Extract from posting**:
1. **Hard requirements**: Must-have skills, experience levels, domain knowledge
2. **Soft requirements**: Leadership style, culture signals, team size expectations
3. **Keywords**: Technical terms, frameworks, methodologies mentioned 2+ times
4. **Seniority signals**: Scope indicators (budget, team size, org breadth)

### Phase 2: Score Accomplishments

Read `references/resume.pdf` and `config/candidate.md` accomplishments.

For each accomplishment, score against the posting:

| Score | Meaning |
|-------|---------|
| 5 | Direct match — accomplishment addresses a stated requirement |
| 4 | Strong adjacent — same domain or skill, different context |
| 3 | Transferable — demonstrates the underlying capability |
| 2 | Tangential — loosely related |
| 1 | No meaningful connection |

**Present the scoring table to the user** before proceeding. This is a
meaningful design decision — the user should see which accomplishments
the skill considers most relevant and have a chance to override.

```
Accomplishment Scoring for {Company} — {Role}
─────────────────────────────────────────────────
Score │ Accomplishment                     │ Matches
  5   │ Reduced deploy cycle 6mo → minutes │ CI/CD transformation req
  5   │ Scaled eng org 40 → 160            │ Team scaling req
  4   │ $12M revenue from localization     │ International expansion
  3   │ SOC 2 compliance program           │ Security mention in posting
  2   │ Community-driven quality culture    │ Weak match
─────────────────────────────────────────────────
Proposed order: 1, 2, 4, 3, 5

Adjust? (confirm, swap positions, or re-score)
```

### Phase 3: Reorder and Reframe

Based on confirmed scoring:

1. **Reorder bullets** within each resume section by score (highest first)
2. **Lightly reframe** top-scored bullets to echo posting language where
   natural. Rules:
   - Change "led migration to microservices" → "led migration to
     microservices architecture" if "architecture" is a posting keyword
   - Do NOT change meaning, scope, or numbers
   - Do NOT add technologies or skills not present in the original
   - Limit reframing to 1-2 word additions/substitutions per bullet
3. **Add a keyword coverage check**: List posting keywords and which
   resume bullet contains each. Flag any high-priority keywords with
   no coverage.

### Phase 4: Generate Output

1. Write the tailored resume markdown:
   ```
   output/{company-slug}/Christopher_Cantu_Resume_{Company}.md
   ```

2. Generate .docx using existing infrastructure:
   ```fish
   set NODE_PATH /opt/homebrew/lib/node_modules
   node scripts/generate_resume_docx.js \
     output/{company-slug}/Christopher_Cantu_Resume_{Company}.md \
     output/{company-slug}/Christopher_Cantu_Resume_{Company}.docx
   ```

3. Show the user a diff-style summary of what changed vs. the base resume:
   - Bullets that moved up
   - Bullets that were reframed (show before/after)
   - Keywords covered vs. not covered

### Phase 5: State Update

1. Append to `output/*-seen-postings.md`:
   ```
   - {Company} | {Title} | resume tailored | {date}
   ```

2. If `application-tracker` state exists, add note:
   ```
   Notes: "Resume tailored — emphasis on {top 2 matched themes}"
   ```

---

## Integration with Company Researcher Agent

If a `company-research.md` brief exists for the target company, read it
to inform scoring:

- Company stage/size → weight scaling accomplishments higher for growth-stage
- Engineering culture signals → weight methodology accomplishments accordingly
- Stated challenges → boost accomplishments that directly address them

If no brief exists and the user hasn't opted out, suggest running
`company-research` first: "I can research {Company} first to better score
your accomplishments — want me to?"

---

## DOCX Generation Rules

From the existing stub and `scripts/docx-styles.js`:

- Always `require('../../scripts/docx-styles')` for shared constants
- Use `NUMBERING_CONFIG` from docx-styles.js — never override indent values
- Correct values: `left: 720, hanging: 360` (level 0), `left: 1080, hanging: 360` (level 1)
- Run with `NODE_PATH=/opt/homebrew/lib/node_modules`

---

## Privacy Constraints

- Tailored resumes live in `output/` (gitignored)
- The resume contains PII by nature (name, contact info) — this is expected
- Never commit generated resumes to the repository
- Do not log resume content to any external service

---

## Success Criteria

1. Scoring table is presented to user before any changes are made
2. User confirms or adjusts scoring before generation
3. Generated resume preserves all sections from the original
4. No fabricated experience — only reordering and light reframing
5. Keyword coverage report shows which posting keywords are addressed
6. .docx generates successfully with correct formatting
7. Diff summary clearly shows what changed vs. the base resume
