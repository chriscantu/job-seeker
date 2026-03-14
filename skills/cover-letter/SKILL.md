---
name: cover-letter
description: >
  Generate a tailored cover letter for a specific company and role.
  Use this skill when Chris asks for a "cover letter", "write a cover
  letter for [company]", "application letter", or any request to create
  a formal letter accompanying a job application. Also use when Chris
  says "apply to [company]" and a cover letter is part of the process.
  This skill produces a professional .docx cover letter (plus a .md source)
  that maps Chris's specific accomplishments to the role requirements.
---

# Cover Letter Generator

Creates a tailored, executive-level cover letter that maps Chris's specific
accomplishments to a role's requirements. Every letter should feel like it
could only have been written by Chris for this specific role.

## Before You Start

1. Read `PRINCIPLES.md` — especially "Quantify Everything" and "Respect the Level"
2. Read `config/candidate.md` — candidate name, role, accomplishments
3. Read `references/resume.pdf` for full detailed accomplishments
4. Glob `references/writing-samples/*.md` — if any files exist, read them to
   calibrate tone and voice before writing. Fall back to `references/voice-guide.md`
   if the directory is empty or missing.
5. Read the `why-this-company` skill's output if one exists for this company
   (avoid duplicating the research)

## Required Inputs

Ask the user for what you don't already have:
- **Company name** (required)
- **Role title** (required)
- **Job posting URL** (strongly recommended — fetch and read to extract requirements)
- **Specific points to emphasize** (optional — Chris may want to highlight certain experience)
- **Format preference** (optional — default is .docx + .md source)

## Research Phase

If a `why-this-company` response was already generated for this role, reuse
that research. Otherwise:

1. Fetch and read the job posting if a URL was provided
2. WebSearch the company for mission, stage, recent news, engineering culture
3. Identify the 3-4 key requirements from the posting that most closely
   match Chris's experience

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

**Body paragraphs (2)** — Map Chris's experience to role requirements.
Each paragraph should follow: [Role requirement] → [Chris's specific
accomplishment with numbers] → [How this translates to value for this company]

Pull from the `## Accomplishments` section of `config/candidate.md`. Map each
listed accomplishment to the most relevant requirement area from the job posting.
Prefer accomplishments with specific numbers — any bullet without a number is
weak evidence.

**Closing paragraph** — Forward-looking. What Chris will bring to this specific
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
   output/{company-slug}/Christopher_Cantu_CoverLetter_{Company}.md
   ```
2. Generate a .docx by invoking the `anthropic-skills:docx` skill, saving to:
   ```
   output/{company-slug}/Christopher_Cantu_CoverLetter_{Company}.docx
   ```
3. The `output/` directory is gitignored — generated materials stay local

## Quality Checks

Before presenting:
- Does every paragraph contain at least one specific number?
- Is the opening sentence compelling enough to keep reading?
- Does it address the top 3 requirements from the job posting?
- Is it under 400 words? (Executives don't read long cover letters)
- Would Chris be comfortable sending this as-is?

## State Update

After generating, append to the seen-postings state file:

1. Glob `output/*-seen-postings.md`, sort descending.
2. Append to the most recent file (or create `output/YYYY-MM-DD-seen-postings.md`
   if none exists):
   ```
   - {Company} | {Title} | cover letter generated | {date}
   ```

Note: Applications pipeline tracking is deferred to the `application-tracker` skill.
