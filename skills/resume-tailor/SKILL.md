---
name: resume-tailor
description: >
  Customize resume emphasis and bullet ordering for a specific role.
  Triggers: "tailor my resume for", "customize resume", "adjust resume for this role"
---

# Resume Tailor

Customizes Chris's resume for a specific job posting by reordering bullets,
adjusting emphasis, and surfacing the most relevant accomplishments.

## Status: Planned

This skill is stubbed for future development.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, role, accomplishments
3. Read `config/search.md` — target roles, comp floor
4. Read `references/resume.pdf` — canonical resume content

## Intended Behavior

1. Accept a job posting URL or pasted description
2. Analyze which accomplishments map strongest to the role requirements
3. Produce a reordered/emphasized version of the resume as a `.md` source
4. Generate a .docx using:
   ```
   node scripts/generate_resume_docx.js \
     output/{company-slug}/Christopher_Cantu_Resume_{Company}.md \
     output/{company-slug}/Christopher_Cantu_Resume_{Company}.docx
   ```

All files saved to `output/{company-slug}/` — same directory as the cover letter.

## Key Constraints

- Never fabricate experience — only reorder and emphasize existing content
- Maintain consistent formatting with the canonical resume
- Flag any requirement gaps honestly
