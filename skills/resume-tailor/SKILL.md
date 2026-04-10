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

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Additionally:
- Read `references/resume.pdf` — canonical resume (source of truth for all bullet text)
- Read `references/voice-guide.md` if it exists — the tailored summary must match
  the candidate's voice. If missing, rely on the anti-patterns list in tailoring-rules.
- Glob `references/writing-samples/*.md` — if any exist, read them to calibrate tone

## Required Inputs

Ask the user for what you don't already have:

- **Job posting URL** (required — fetch and parse for requirements)
- **Specific points to emphasize** (optional — candidate may want to highlight
  certain experience)

## Company Research Reuse

After extracting the company name and deriving `{company-slug}` (see Phase 1),
check for `output/{company-slug}/company-research.md`:

- **If exists**: Read the file. Check the frontmatter block first (see
  `skills/_shared/frontmatter.md`):
  - `generated` — if older than 7 days, suggest re-running company-research
  - `rating` — note the fit rating in the decisions summary
  - Then read the Positioning section in the body to inform accomplishment scoring.
- **If not exists**: Fetch the job posting URL directly. Extract requirements
  from the posting content. Optionally suggest: "I can research {Company} first
  for better context — want me to run company-research?"

## Phase 1 — Company Extraction

Read `skills/_shared/company-extraction.md` and execute.

## Phase 2 — Analyze, Score, and Rewrite

Read `skills/resume-tailor/tailoring-rules.md` and execute Phases 1-3.

## Phase 3 — Generate Output

### Step 3a: Write the Tailored Markdown

Write to `output/{company-slug}/{Name}_Resume_{Company}.md` where `{Name}`
is from `config/candidate.md` with spaces replaced by underscores, and
`{Company}` is the display name with spaces replaced by underscores and
special characters removed (e.g., "Maven Clinic" → `Maven_Clinic`).

Include a frontmatter block before the resume content (see
`skills/_shared/frontmatter.md` for the schema). The `research_date` field
is the `generated` date from the company-research brief, if one was used.

Follow the markdown structure and content rules in
`skills/resume-tailor/tailoring-rules.md` exactly — the parser is rigid.
The docx generation script strips frontmatter automatically before parsing.

### Step 3b: Generate the .docx

```fish
set NODE_PATH /opt/homebrew/lib/node_modules
bun scripts/generate_resume_docx.js \
  output/{company-slug}/{Name}_Resume_{Company}.md \
  output/{company-slug}/{Name}_Resume_{Company}.docx
```

If the script exits non-zero, show the error to the user and leave the .md
in place for debugging. Do not silently swallow the error.

### Step 3c: Present Tailoring Decisions Summary

After generating both files, present a summary covering:

1. **Requirements keyed on** — the 3-5 requirements extracted in Phase 2
2. **Accomplishments table changes** — which items were promoted/demoted, why
3. **Bullet reordering** — for each reordered job entry, which bullet moved up and why
4. **Summary changes** — what the new summary emphasizes vs. the canonical
5. **Requirement gaps** — any posting requirements the resume doesn't address.
   Flag these honestly — don't hide mismatches.

End with the file paths:
```
Files written:
  output/{company-slug}/{Name}_Resume_{Company}.md
  output/{company-slug}/{Name}_Resume_{Company}.docx
```

## Phase 4 — State Update

Read `skills/_shared/state-io.md` and execute the **append** pattern for `seen-postings`.

Find the seen-postings line matching the company name or URL and append
`| RESUME TAILORED` to that line.

**If the company is NOT in seen-postings** (URL came from outside the digest),
add a new entry under today's date section with the `RESUME TAILORED` flag.
Include `posted:YYYY-MM-DD` if visible on the job page, otherwise use
`discovered:YYYY-MM-DD` (today's date).

### Applications Pipeline (if tracked)

If the company has an entry in the applications pipeline, record the resume tailoring:

```fish
bun scripts/state.js add-note applications --company "{company}" --note "Resume tailored {YYYY-MM-DD}"
```

If the command exits non-zero (no matching application entry), this is expected
for roles not yet in the pipeline. Log a note to the user:

> "No application entry found for {company} — skipping pipeline update.
> Run /application-tracker to add it."

Do not fail the skill run.

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
- **Never remove sections, bullets, or narrative blocks** — all resume sections,
  bullets, AND Challenge/Action/Results paragraphs remain. Only bullet ORDER
  changes; nothing is deleted.
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim from
  the canonical resume. Light phrasing edits allowed.
- **Education and Core Expertise are verbatim** — copy the entire Education
  section exactly. Do not trim, reorder, or omit any items.
- **Flag gaps honestly** — if the posting requires something the candidate
  doesn't have, say so in the decisions summary
