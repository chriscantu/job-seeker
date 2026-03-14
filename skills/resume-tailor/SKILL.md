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

## DOCX Generation Rules

When writing the generation script, always `require('../../scripts/docx-styles')` for
shared constants and helpers. This ensures consistent formatting across all resumes.

**Critical — bullet alignment (enforced in `scripts/docx-styles.js`):**
Use `NUMBERING_CONFIG` from `docx-styles.js`. Never override bullet indent values inline.
The correct values are `left: 720, hanging: 360` for level 0 and `left: 1080, hanging: 360`
for level 1. Smaller values (e.g. `left: 480, hanging: 240`) cause wrapped bullet text
to misalign with the line above — a known formatting defect.

**Run with:**
```fish
set NODE_PATH /opt/homebrew/lib/node_modules
node output/{company-slug}/generate_resume.js
```

## Key Constraints

- Never fabricate experience — only reorder and emphasize existing content
- Maintain consistent formatting with the canonical resume
- Flag any requirement gaps honestly
