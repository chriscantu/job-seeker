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

## Intended Behavior

1. Read `references/resume.pdf` for the canonical resume
2. Read CLAUDE.md for candidate profile
3. Accept a job posting URL or pasted description
4. Analyze which accomplishments map strongest to the role requirements
5. Produce a reordered/emphasized version of the resume as a `.md` source
6. Generate a .docx using:
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
