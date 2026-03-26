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

# Resume Tailor

Takes a job posting and produces a role-optimized resume with a rewritten summary,
reordered bullets, and a reconfigured Key Accomplishments table — then generates
both .md and .docx in one shot.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `PRINCIPLES.md` — quality standards, voice guidelines, output conventions
3. Read `config/candidate.md` — candidate name, core strengths, accomplishments
4. Read `config/search.md` — target roles, to contextualize fit
5. Read `references/resume.pdf` — canonical resume (source of truth for all bullet text)
6. Read `references/voice-guide.md` if it exists — the tailored summary must match
   the candidate's voice. If missing, rely on the anti-patterns list in Phase 3 below.
7. Glob `references/writing-samples/*.md` — if any exist, read them to calibrate tone

## Required Inputs

Ask the user for what you don't already have:

- **Job posting URL** (required — fetch and parse for requirements)
- **Specific points to emphasize** (optional — candidate may want to highlight
  certain experience)

## Company Research Reuse

After extracting the company name and deriving `{company-slug}` (see Company
Extraction below), check for `output/{company-slug}/company-research.md`:

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

---

## Phase 4: Generate Output

In a single pass, produce both the .md and .docx files.

### Step 4a: Write the Tailored Markdown

Write to `output/{company-slug}/{Name}_Resume_{Company}.md` where `{Name}`
is from `config/candidate.md` with spaces replaced by underscores, and
`{Company}` is the display name with spaces replaced by underscores and
special characters removed (e.g., "Maven Clinic" → `Maven_Clinic`).

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

**Degree**              ← must come first (parser captures as degree)
University Name         ← must come second (parser captures as school)
**Core Expertise:** Comma-separated skills  ← must come last
```

**Order matters in Education.** The `generate_resume_docx.js` parser reads
lines sequentially — `**bold**` lines are captured as degree, then the next
non-bold line becomes school, then `**Core Expertise:**` is handled specially.
Reordering these lines will silently corrupt the .docx.

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
node scripts/generate_resume_docx.js \
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
add a new entry under today's date section. Include `posted:YYYY-MM-DD` if the posting date is visible on the job page.
If unknown, use `discovered:YYYY-MM-DD` (today's date) instead — every entry
must have one or the other so all roles can be aged:

```
## {YYYY-MM-DD}
- {Company} | {Title} | {URL} | posted:YYYY-MM-DD | RESUME TAILORED
```

If no seen-postings file exists at all, create
`output/YYYY-MM-DD-seen-postings.md` with the new entry.

**Do not** update `applications.md` or `preferences.md`. Resume tailoring
is not a pipeline event.

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
- **Never remove sections or bullets** — all resume sections and bullets remain;
  only their order changes
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim from
  the canonical resume. Light phrasing edits allowed: reordering clauses,
  leading with the most relevant phrase, echoing synonymous posting keywords.
  No new claims, no new technologies, no inflated scope.
- **Flag gaps honestly** — if the posting requires something the candidate
  doesn't have, say so in the decisions summary
