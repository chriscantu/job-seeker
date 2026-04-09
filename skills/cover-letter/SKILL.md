---
name: cover-letter
description: >
  Generate a tailored cover letter for a specific company and role.
  Triggers: "cover letter", "write a cover letter for [company]",
  "application letter", "apply to [company]". Produces a professional
  .docx cover letter (plus .md source) that maps the candidate's specific
  accomplishments to the role requirements.
---

# Cover Letter Generator

Creates a tailored, executive-level cover letter that maps the candidate's specific
accomplishments to a role's requirements. Every letter should feel like it
could only have been written for this specific role.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read these additional files:
- `references/resume.pdf` — for full detailed accomplishments
- Glob `references/writing-samples/*.md` — if any files exist, read them to
  calibrate tone and voice before writing. Fall back to `references/voice-guide.md`
  if the directory is empty or missing.

Check if a `why-this-company` output already exists for this company
(`output/{company-slug}/`). If so, read it to avoid duplicating research.

## Required Inputs

Ask the user for what you don't already have:
- **Company name** (required)
- **Role title** (required)
- **Job posting URL** (strongly recommended — fetch and read to extract requirements)
- **Specific points to emphasize** (optional — the candidate may want to highlight certain experience)
- **Format preference** (optional — default is .docx + .md source)

## Phase 1 — Company Extraction (URL cases)

If a job posting URL was provided:

Read `skills/_shared/company-extraction.md` and execute.

## Research Phase

If a `why-this-company` response was already generated for this role, reuse
that research. Otherwise:

1. Fetch and read the job posting if a URL was provided
2. WebSearch the company for mission, stage, recent news, engineering culture
3. Identify the 3-4 key requirements from the posting that most closely
   match the candidate's experience

## Writing the Cover Letter

### Tone
Executive, confident, specific. Not formal-stiff — conversational-professional.
Think "senior leader writing to a peer" not "applicant pleading for consideration."

### Structure

**Opening paragraph** — Lead with the strongest connection point.
Not "I am writing to express my interest in..." — that's dead on arrival.
Instead, open with a specific accomplishment or insight that immediately
demonstrates fit.

Example opening:
"When I reduced localization deployment at Procore from six months to minutes,
it unlocked $12M in revenue across European and Asian markets within the first
year. I see [Company] facing a similar inflection point with [specific challenge],
and that's exactly the kind of problem I've spent the last decade solving."

**Body paragraphs (2)** — Map the candidate's experience to role requirements.
Each paragraph should follow: [Role requirement] → [the candidate's specific
accomplishment with numbers] → [How this translates to value for this company]

Pull from the `## Accomplishments` section of `config/candidate.md`. Map each
listed accomplishment to the most relevant requirement area from the job posting.
Prefer accomplishments with specific numbers — any bullet without a number is
weak evidence.

**Closing paragraph** — Forward-looking. What the candidate will bring to this specific
company and role. End with a clear call to action.

### What to Avoid
- Generic phrases: "I am a passionate leader" / "I thrive in fast-paced environments"
- Repeating the resume bullet-for-bullet — the letter should tell a narrative
- Underselling: own the candidate's actual scope — team size, org scale, company stage
- Overselling: Don't claim CTO-level scope; be honest about Director-level experience with VP-level ambition

## Output

All files go in `output/{company-slug}/` (e.g., `output/natera/`).

1. Write the cover letter source:
   ```
   output/{company-slug}/{Name}_CoverLetter_{Company}.md
   ```
   Where `{Name}` is from `config/candidate.md` with spaces replaced by underscores.
2. Generate the .docx:
   ```fish
   set NODE_PATH /opt/homebrew/lib/node_modules
   node scripts/generate_coverletter_docx.js \
     output/{company-slug}/{Name}_CoverLetter_{Company}.md \
     output/{company-slug}/{Name}_CoverLetter_{Company}.docx
   ```
   If the script exits non-zero, show the error and leave the .md in place.
3. The `output/` directory is gitignored — generated materials stay local

## Quality Checks

Before presenting:
- Does every paragraph contain at least one specific number?
- Is the opening sentence compelling enough to keep reading?
- Does it address the top 3 requirements from the job posting?
- Is it under 400 words? (Executives don't read long cover letters)
- Would the candidate be comfortable sending this as-is?

## State Update

Read `skills/_shared/state-io.md` and execute — append to `seen-postings`.

After generating, append to the seen-postings state file with
`posted:YYYY-MM-DD` if the posting date is visible on the job page. If unknown,
use `discovered:YYYY-MM-DD` (today's date) instead — every entry must have one
or the other so all roles can be aged:

```
- {Company} | {Title} | cover letter generated | {date} | posted:YYYY-MM-DD
```

Note: Applications pipeline tracking is deferred to the `application-tracker` skill.
