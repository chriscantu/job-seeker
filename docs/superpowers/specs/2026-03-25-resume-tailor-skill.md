# Design Spec: Resume Tailor Skill

**Date**: 2026-03-25
**Status**: Implemented
**Author**: Chris Cantu + Claude

---

## Problem

The candidate has a strong canonical resume, but a one-size-fits-all document
undersells fit for specific roles. At the VP/Senior Director level, the
accomplishments don't change — but which ones lead, what the summary
emphasizes, and which highlights make the Key Accomplishments table should
shift per role.

**Target**: A skill that takes a job posting and produces a role-optimized
resume with a rewritten summary, reordered bullets, and a reconfigured
accomplishments table — all without fabricating experience.

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Tailoring scope | Rewrite summary + reorder bullets + reconfigure accomplishments table | Summary is highest-signal; table is prime real estate. Bullet text stays factual. |
| Accomplishments table | Promote any bullet from the full resume | Best-fit accomplishment may be buried in a past role — surface it |
| Company research reuse | Opportunistic — use if exists, fetch posting directly if not | Self-contained skill, but rewards prior research |
| Output review flow | Generate .md + .docx in one shot, present decisions summary | .docx is the artifact that matters; markdown review is redundant overhead |
| Bullet text editing | Light emphasis edits only — facts and numbers verbatim | Rewriting risks fabrication; reordering is safe |

### Constraints (Non-Negotiable)

1. **Never fabricate experience** — only reorder, re-emphasize, and rewrite
   the summary using existing content from `references/resume.pdf`
2. **Never remove sections** — all resume sections remain; only content
   ordering within sections changes
3. **Bullet facts are sacred** — numbers, scope, outcomes must come verbatim
   from the canonical resume. Light phrasing edits for emphasis are allowed:
   reordering clauses within a bullet, leading with the most relevant phrase,
   or echoing a posting keyword that's synonymous with existing text (e.g.,
   "microservices" → "microservices architecture"). No new claims, no new
   technologies, no inflated scope.
4. **Flag gaps honestly** — if the posting requires something the candidate
   doesn't have, call it out in the decisions summary

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Full bullet rewrite per application | Risks fabrication, hard to verify, inconsistent across applications |
| Reorder only (no summary rewrite) | Leaves the highest-signal section generic |
| Markdown review gate before .docx | Redundant — the .docx is what gets sent to recruiters |
| Require company-research first | Over-coupled — skill should work standalone |

---

## Inputs & Prerequisites

### Before You Start

1. Run `node scripts/validate-config.js` — stop on non-zero exit
2. Read `PRINCIPLES.md` — quality standards and voice guidelines
3. Read `config/candidate.md` — candidate name, core strengths, accomplishments
4. Read `config/search.md` — target roles, to contextualize fit
5. Read `references/resume.pdf` — canonical resume (source of truth for all content)
6. Read `references/voice-guide.md` — summary must match candidate's voice

### Required Inputs

Ask the user for what you don't already have:

- **Job posting URL** (required — fetch and parse for requirements)
- **Specific points to emphasize** (optional — candidate may want to highlight
  certain experience)

### Company Research Reuse

Check for `output/{company-slug}/company-research.md`:

- **If exists**: Read it. Use the Positioning section and company context to
  inform accomplishment scoring. Note the brief's date in the decisions summary.
- **If not exists**: Fetch the job posting URL directly. Extract requirements
  from the posting content. Optionally suggest: "I can research {Company}
  first for better context — want me to run company-research?"

### Company Extraction

Same pattern as company-research skill:

- Extract company name from the job posting page
- Derive `{company-slug}`: lowercase, spaces to hyphens, special chars removed
- Create `output/{company-slug}/` if it doesn't exist

---

## Workflow

### Phase 1: Analyze the Posting

Extract from the job posting (or company-research brief):

1. **Top 3-5 requirements** — the capabilities the role most demands
   (e.g., "scaling engineering orgs internationally", "platform migration",
   "CI/CD maturity")
2. **Seniority signals** — scope indicators (budget, team size, org breadth)
3. **Domain context** — industry, tech stack, company stage

### Phase 2: Score and Map Accomplishments

Read the canonical resume (`references/resume.pdf`). For every bullet and
accomplishment:

- Score relevance against the extracted requirements
- Identify the **4 best-fit accomplishments** for the Key Accomplishments
  table — these can come from anywhere in the resume (existing table entries
  OR bullets buried in experience sections)
- Determine bullet reordering within each job entry — most relevant first

### Phase 3: Rewrite Summary

Draft a new 2-3 sentence summary that:

- Leads with the strongest signal for this specific role
- References specific numbers/outcomes from the canonical resume
- Uses the candidate's voice (from `voice-guide.md`): concrete before abstract,
  "we" for team work, no buzzwords, no performative language
- Positions the candidate at the right level (VP/Senior Director scope)

### Phase 4: Generate Output

**In a single pass**, produce both files:

1. Write the tailored resume markdown to:
   ```
   output/{company-slug}/{Name}_Resume_{Company}.md
   ```
   Where `{Name}` is from `config/candidate.md` with spaces replaced by
   underscores.

2. The markdown MUST conform exactly to the structure that
   `scripts/generate_resume_docx.js` expects:
   - `# Name` (H1)
   - `**Tagline**` (bold line)
   - Contact line (with `@` or `|`)
   - Summary paragraph
   - `## Key Accomplishments` with a 2-column markdown table
   - `### Title | Company` entries with `*metadata*` and `- bullet` items
   - `## Education`

3. Generate .docx:
   ```fish
   set NODE_PATH /opt/homebrew/lib/node_modules
   node scripts/generate_resume_docx.js \
     output/{company-slug}/{Name}_Resume_{Company}.md \
     output/{company-slug}/{Name}_Resume_{Company}.docx
   ```

4. Present a **tailoring decisions summary** to the user:
   - Which requirements the skill keyed on
   - Which accomplishments were promoted to / demoted from the table, and why
   - How bullets were reordered within each job entry
   - What the new summary emphasizes vs. the canonical version
   - Any requirement gaps — areas where the posting asks for something the
     candidate's resume doesn't address

### Phase 5: State Update

1. Glob `output/*-seen-postings.md`, sort descending, read the most recent
2. Find the line matching the company name/URL
3. Append `| RESUME TAILORED` to that line

**If the company is NOT in seen-postings**, add a new entry:
```
## {YYYY-MM-DD}
- {Company} | {Title} | {URL} | RESUME TAILORED
```

If no seen-postings file exists, create `output/YYYY-MM-DD-seen-postings.md`.

**Do not** update `applications.md` or `preferences.md`. Resume tailoring is
not a pipeline event.

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Job posting URL returns 404 | Stop: "Could not access that posting. Is the URL correct?" |
| Cannot determine company name | Stop: "Could not identify the company. Try providing the company name directly." |
| `references/resume.pdf` missing | Stop: "No canonical resume found at references/resume.pdf" |
| `generate_resume_docx.js` fails | Show the error, leave the .md in place for debugging |
| Company-research brief exists but is old | Use it — note the date in decisions summary |
| Config validation fails | Stop and show the validation error |

---

## Privacy Constraints

- Tailored resumes live in `output/` (gitignored)
- The resume contains PII by nature (name, contact info) — this is expected
- Never commit generated resumes to the repository

---

## Success Criteria

1. Generated resume preserves all sections from the canonical resume
2. No fabricated experience — only reordering, re-emphasis, and summary rewrite
3. Key Accomplishments table contains the 4 best-fit items for this role
4. Summary is rewritten in the candidate's voice, targeted to the role
5. .docx generates successfully with correct formatting
6. Decisions summary clearly explains what changed and why
7. Requirement gaps are flagged honestly, not hidden
