# Resume Tailor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the resume-tailor stub with a full skill that takes a job posting, analyzes requirements, and produces a role-optimized resume (.md + .docx) with rewritten summary, reordered bullets, and reconfigured Key Accomplishments table.

**Architecture:** Single SKILL.md rewrite — no new scripts. The skill instructs Claude to fetch the posting, score accomplishments against requirements, rewrite the summary, reorder bullets, promote best-fit items to the accomplishments table, generate both .md and .docx via existing `generate_resume_docx.js`, and present a tailoring decisions summary. Follows the company-research and cover-letter patterns.

**Tech Stack:** Markdown skill definition only. Tools used at runtime: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob. Existing script: `scripts/generate_resume_docx.js`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `skills/resume-tailor/SKILL.md` | Rewrite | Full skill definition — the only file that changes |

No new scripts, no new config. The existing `generate_resume_docx.js` and `docx-styles.js` are used as-is.

---

### Task 1: Write the SKILL.md frontmatter and introduction

**Files:**
- Modify: `skills/resume-tailor/SKILL.md:1-60` (replace entire file — will be built up across tasks)

**Context for the implementer:**
- Read `docs/superpowers/specs/2026-03-25-resume-tailor-skill.md` for the full spec
- Read `skills/company-research/SKILL.md` for the established pattern (frontmatter, "Before You Start", output conventions)
- Read `skills/cover-letter/SKILL.md` for the voice calibration and output path pattern
- Read the current stub at `skills/resume-tailor/SKILL.md` to see what's being replaced

- [ ] **Step 1: Replace the file with frontmatter and introduction**

Write the entire file starting with frontmatter. The file will be extended in subsequent tasks.

```yaml
---
name: resume-tailor
description: >
  Customize resume for a specific role — rewrites summary, reorders bullets,
  and reconfigures the Key Accomplishments table based on job posting analysis.
  Produces .md source + .docx in one shot. Output saved to
  output/{company-slug}/{Name}_Resume_{Company}.md/.docx.
  Triggers: "tailor my resume", "customize resume for", "adjust resume for this role"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---
```

Then the introduction and Before You Start:

```markdown
# Resume Tailor

Takes a job posting and produces a role-optimized resume with a rewritten summary,
reordered bullets, and a reconfigured Key Accomplishments table — then generates
both .md and .docx in one shot.

## Before You Start

1. Run `bun scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `PRINCIPLES.md` — quality standards, voice guidelines, output conventions
3. Read `config/candidate.md` — candidate name, core strengths, accomplishments
4. Read `config/search.md` — target roles, to contextualize fit
5. Read `references/resume.pdf` — canonical resume (source of truth for all bullet text)
6. Read `references/voice-guide.md` — the tailored summary must match the candidate's voice
7. Glob `references/writing-samples/*.md` — if any exist, read them to calibrate tone
```

- [ ] **Step 2: Verify frontmatter parses correctly**

```bash
head -12 skills/resume-tailor/SKILL.md
```

Expected: YAML frontmatter with `name`, `description`, `allowed-tools` fields between `---` delimiters.

- [ ] **Step 3: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat(resume-tailor): write frontmatter and introduction

Replaces the stub with skill metadata, trigger phrases, and
Before You Start prerequisites following the company-research pattern."
```

---

### Task 2: Write the Required Inputs and Company Research Reuse sections

**Files:**
- Modify: `skills/resume-tailor/SKILL.md` (append after Before You Start)

- [ ] **Step 1: Append the Required Inputs section**

Add after the "Before You Start" section:

```markdown
## Required Inputs

Ask the user for what you don't already have:

- **Job posting URL** (required — fetch and parse for requirements)
- **Specific points to emphasize** (optional — candidate may want to highlight
  certain experience)

## Company Research Reuse

Derive `{company-slug}` from the company name: lowercase, spaces replaced with
hyphens, special characters removed (e.g., "Maven Clinic" → `maven-clinic`).

Check for `output/{company-slug}/company-research.md`:

- **If exists**: Read it. Use the Positioning section and company context to
  inform accomplishment scoring. Note the brief's date in the decisions summary.
- **If not exists**: Fetch the job posting URL directly. Extract requirements
  from the posting content. Optionally suggest: "I can research {Company} first
  for better context — want me to run company-research?"

## Company Extraction

WebFetch the job posting URL. From the page content, extract:

| Field | Source |
|-------|--------|
| Company name | Page title, meta tags, or ATS page structure |
| Role title | Job title from the posting |
| Company website domain | Links on the page, or derive from ATS URL pattern |

Derive `{company-slug}` as described above. Create `output/{company-slug}/`
if it doesn't exist.

**If the URL returns 404 or is unparseable**, stop with:
> "Could not access that posting. Is the URL correct?"

**If the company name cannot be determined**, stop with:
> "Could not identify the company from this page. Try providing the company name directly."
```

- [ ] **Step 2: Verify the sections are present**

```bash
grep -c "## Required Inputs\|## Company Research Reuse\|## Company Extraction" skills/resume-tailor/SKILL.md
```

Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat(resume-tailor): add inputs, research reuse, and company extraction

Defines required inputs (posting URL + optional emphasis points),
opportunistic reuse of company-research briefs, and company
extraction with slug derivation."
```

---

### Task 3: Write the Analysis Phase section

**Files:**
- Modify: `skills/resume-tailor/SKILL.md` (append after Company Extraction)

- [ ] **Step 1: Append the Analysis Phase section**

```markdown
---

## Phase 1: Analyze the Posting

Extract from the job posting (or company-research brief if available):

1. **Top 3-5 requirements** — the capabilities the role most demands
   (e.g., "scaling engineering orgs internationally", "platform migration
   experience", "CI/CD maturity")
2. **Seniority signals** — scope indicators (budget, team size, org breadth)
3. **Domain context** — industry, tech stack, company stage

---

## Phase 2: Score and Map Accomplishments

Read the canonical resume (`references/resume.pdf`). For every bullet and
accomplishment in the resume:

- Score relevance against the extracted requirements
- Identify the **4 best-fit accomplishments** for the Key Accomplishments
  table — these can come from ANYWHERE in the resume (existing table entries
  OR bullets buried deeper in experience sections). The canonical resume's
  table is optimized for the general case; tailoring optimizes for the
  specific case.
- Determine bullet reordering within each job entry — most relevant to this
  role first, least relevant last. Do not remove any bullets.

---

## Phase 3: Rewrite Summary

Draft a new 2-3 sentence summary that:

- Leads with the strongest signal for this specific role
- References specific numbers and outcomes from the canonical resume
- Uses the candidate's voice (from `references/voice-guide.md`):
  - Concrete before abstract — lead with the number, then the meaning
  - "We" for team work, "I" for personal decisions
  - No buzzwords, no performative language
  - Friendly pragmatist tone — teach, don't perform
- Positions the candidate at the right level (VP/Senior Director scope —
  not senior engineer, not CTO)

**Anti-patterns for the summary** (from `references/voice-guide.md`):
- "I'm passionate about driving organizational excellence"
- "I'm uniquely positioned to leverage my experience"
- "I've been fortunate enough to lead..."
- Anything that sounds like a LinkedIn influencer or career coach
```

- [ ] **Step 2: Verify the phases are present**

```bash
grep -c "## Phase 1\|## Phase 2\|## Phase 3" skills/resume-tailor/SKILL.md
```

Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat(resume-tailor): add analysis, scoring, and summary rewrite phases

Phase 1 extracts requirements from the posting. Phase 2 scores every
resume bullet and selects the 4 best-fit accomplishments for the table.
Phase 3 rewrites the summary in the candidate's voice."
```

---

### Task 4: Write the Output Generation section

**Files:**
- Modify: `skills/resume-tailor/SKILL.md` (append after Phase 3)

**Context for the implementer:**
- Read `scripts/generate_resume_docx.js` lines 88-202 to understand the exact markdown structure the parser expects
- The parser detects sections by: `# Name`, `**tagline**`, contact line with `@` or `|`, summary paragraph, `## Key Accomplishments` (table with `|` rows), `### Title | Company` (experience entries), `## Education`

- [ ] **Step 1: Append the Output Generation section**

```markdown
---

## Phase 4: Generate Output

In a single pass, produce both the .md and .docx files.

### Step 4a: Write the Tailored Markdown

Write to `output/{company-slug}/{Name}_Resume_{Company}.md` where `{Name}`
is from `config/candidate.md` with spaces replaced by underscores.

**Critical: the markdown MUST conform exactly to the structure that
`scripts/generate_resume_docx.js` expects.** The parser is rigid — deviating
breaks the .docx. Required structure:

```
# Candidate Name
**Tagline — e.g., Engineering Leader | Platform & Infrastructure | Scaling Teams**
contact@email.com | City, State | linkedin.com/in/handle

Summary paragraph — 2-3 sentences, rewritten for this role per Phase 3.

---

## Key Accomplishments

| Left column | Right column |
|-------------|--------------|
| **Label** — description | **Label** — description |
| **Label** — description | **Label** — description |

---

## Professional Experience

### Title | Company

*Location | Date range | Team size context*

- Bullet point (most relevant to this role first)
- Bullet point
- Bullet point

### Title | Company

*Location | Date range*

- Bullet point
- Bullet point

---

## Education

**Degree**
University Name
**Core Expertise:** Comma-separated skills
```

**Rules for the markdown:**
- All section headings, table format, and bullet syntax must match exactly
- The accomplishments table is 2 columns with `|` separators
- Each `### Title | Company` entry needs a `*metadata*` line (italics)
- Bullets are `- ` prefixed (dash space)
- The `*Tailored for {Company} — {Role}*` footer line is stripped by the
  parser, so you can include it for human reference but it won't appear in
  the .docx

**Content rules:**
- Accomplishments table: the 4 best-fit items from Phase 2. Each cell uses
  `**Bold Label** — description with numbers` format.
- Experience bullets: reordered per Phase 2 scoring. Facts and numbers are
  verbatim from the canonical resume. Light phrasing edits are allowed:
  reordering clauses within a bullet, leading with the most relevant phrase,
  or echoing a posting keyword that's synonymous with existing text. No new
  claims, no new technologies, no inflated scope.
- Summary: the rewritten version from Phase 3
- Education: copied verbatim from the canonical resume — no changes
- All other content (name, tagline, contact, job titles, dates, metadata):
  copied verbatim from the canonical resume

### Step 4b: Generate the .docx

Run:

```fish
set NODE_PATH /opt/homebrew/lib/node_modules
bun scripts/generate_resume_docx.js \
  output/{company-slug}/{Name}_Resume_{Company}.md \
  output/{company-slug}/{Name}_Resume_{Company}.docx
```

If the script exits non-zero, show the error message to the user and leave
the .md in place for debugging. Do not silently swallow the error.

### Step 4c: Present Tailoring Decisions Summary

After generating both files, present a summary to the user covering:

1. **Requirements keyed on** — the 3-5 requirements extracted in Phase 1
2. **Accomplishments table changes** — which items were promoted into the
   table and which were moved out, with a one-line reason for each
3. **Bullet reordering** — for each job entry where bullets were reordered,
   note which bullet moved to the top and why
4. **Summary changes** — what the new summary emphasizes vs. the canonical
5. **Requirement gaps** — any posting requirements the candidate's resume
   doesn't address. Flag these honestly — don't hide mismatches.

End with the file paths:
```
Files written:
  output/{company-slug}/{Name}_Resume_{Company}.md
  output/{company-slug}/{Name}_Resume_{Company}.docx
```
```

- [ ] **Step 2: Verify the output section is complete**

```bash
grep -c "Step 4a\|Step 4b\|Step 4c\|generate_resume_docx" skills/resume-tailor/SKILL.md
```

Expected: at least `4` (the three steps plus the script reference)

- [ ] **Step 3: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat(resume-tailor): add output generation phase

Defines the tailored markdown format (matching generate_resume_docx.js
parser expectations), .docx generation command, and tailoring decisions
summary presented to the user."
```

---

### Task 5: Write the State Update and Error Handling sections

**Files:**
- Modify: `skills/resume-tailor/SKILL.md` (append after Phase 4)

- [ ] **Step 1: Append the State Update section**

```markdown
---

## Phase 5: State Update

1. Glob `output/*-seen-postings.md`, sort descending, read the most recent file
2. Find the line matching the company name or URL
3. Append `| RESUME TAILORED` to that line

**Before:**
```
- Maven Clinic | VP Engineering | https://jobs.lever.co/mavenclinic/abc
```

**After:**
```
- Maven Clinic | VP Engineering | https://jobs.lever.co/mavenclinic/abc | RESUME TAILORED
```

**If the company is NOT in seen-postings** (URL came from outside the digest),
add a new entry under today's date section:

```
## {YYYY-MM-DD}
- {Company} | {Title} | {URL} | RESUME TAILORED
```

If no seen-postings file exists at all, create
`output/YYYY-MM-DD-seen-postings.md` with the new entry.

**Do not** update `applications.md` or `preferences.md`. Resume tailoring
is not a pipeline event.
```

- [ ] **Step 2: Append the Error Handling section**

```markdown
---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Job posting URL returns 404 | Stop: "Could not access that posting. Is the URL correct?" |
| Cannot determine company name | Stop: "Could not identify the company. Try providing the company name directly." |
| `references/resume.pdf` missing | Stop: "No canonical resume found at references/resume.pdf" |
| `config/candidate.md` missing or invalid | Stop: show the validation error from `validate-config.js` |
| `generate_resume_docx.js` fails | Show the error to the user, leave the .md in place for debugging |
| Company-research brief exists but is old | Use it — note the date in the decisions summary |
| `output/{company-slug}/` doesn't exist | Create it before writing files |
| Seen-postings file doesn't exist | Create `output/YYYY-MM-DD-seen-postings.md` with the new entry |

## Key Constraints

- **Never fabricate experience** — only reorder, re-emphasize, and rewrite
  the summary using existing content from `references/resume.pdf`
- **Never remove sections** — all resume sections remain
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim from
  the canonical resume. Light phrasing edits allowed: reordering clauses,
  leading with the most relevant phrase, echoing synonymous posting keywords.
  No new claims, no new technologies, no inflated scope.
- **Flag gaps honestly** — if the posting requires something the candidate
  doesn't have, say so in the decisions summary
```

- [ ] **Step 3: Verify all major sections are present**

```bash
grep -c "## Before You Start\|## Required Inputs\|## Company Research Reuse\|## Company Extraction\|## Phase 1\|## Phase 2\|## Phase 3\|## Phase 4\|## Phase 5\|## Error Handling\|## Key Constraints" skills/resume-tailor/SKILL.md
```

Expected: `11`

- [ ] **Step 4: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat(resume-tailor): add state update, error handling, and constraints

Completes the SKILL.md with seen-postings state annotation (RESUME TAILORED
flag), error handling table, and non-negotiable constraints on content
integrity."
```

---

### Task 6: Validate the complete skill

**Files:**
- Read: `skills/resume-tailor/SKILL.md` (full file review)

- [ ] **Step 1: Check file length and structure**

```bash
wc -l skills/resume-tailor/SKILL.md
```

Expected: 180-250 lines (substantially more than the 60-line stub).

- [ ] **Step 2: Verify all sections from the spec are covered**

```bash
grep "^## \|^### " skills/resume-tailor/SKILL.md
```

Verify the output shows all expected section headings in order:
- Before You Start
- Required Inputs
- Company Research Reuse
- Company Extraction
- Phase 1: Analyze the Posting
- Phase 2: Score and Map Accomplishments
- Phase 3: Rewrite Summary
- Phase 4: Generate Output (with Steps 4a, 4b, 4c)
- Phase 5: State Update
- Error Handling
- Key Constraints

- [ ] **Step 3: Verify references to config files**

```bash
grep -c "config/candidate.md\|config/search.md\|references/resume.pdf\|references/voice-guide.md" skills/resume-tailor/SKILL.md
```

Expected: at least `6` (each file referenced at least once in Before You Start + once in a phase).

- [ ] **Step 4: Verify the markdown format example matches the parser**

Manually confirm the markdown structure example in Step 4a matches what
`scripts/generate_resume_docx.js:parseResume()` expects:

- `# Name` (H1) — parser line 105: `lines[i].startsWith("# ")`
- `**Tagline**` — parser line 109: `match(/^\*\*(.+)\*\*$/)`
- Contact with `@` or `|` — parser line 111: `includes("@") || includes("|")`
- Summary paragraph before any `#` — parser lines 121-126
- `## Key Accomplishments` — parser line 140: `nm.includes("ACCOMPLISHMENT")`
- Table rows with `|` — parser line 165: `stripped.startsWith("|")`
- `### Title | Company` — parser line 152-155: `startsWith("### ")`, splits on ` | `
- `*metadata*` line — parser line 158: `startsWith("*")`
- `- bullet` — parser line 176: `startsWith("- ")`
- `## Education` — parser line 145: `nm.includes("EDUCATION")`

- [ ] **Step 5: Run existing validators**

```bash
bun scripts/validate-config.js && bun scripts/validate-structure.js
```

Expected: Both pass — we only changed the content of an existing SKILL.md, not the file structure or config.

---

### Task 7: Update the spec status and commit

**Files:**
- Modify: `docs/superpowers/specs/2026-03-25-resume-tailor-skill.md:3`

- [ ] **Step 1: Update the spec status**

Change line 3 from:
```
**Status**: Approved
```
To:
```
**Status**: Implemented
```

- [ ] **Step 2: Final commit**

```bash
git add docs/superpowers/specs/2026-03-25-resume-tailor-skill.md
git commit -m "docs: mark resume-tailor spec as implemented"
```

- [ ] **Step 3: Verify clean working tree**

```bash
git status
```

Expected: nothing to commit, working tree clean (except `output/` and `config/` which are gitignored, and any untracked plan files).
