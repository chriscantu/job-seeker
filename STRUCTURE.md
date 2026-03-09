# Plugin Structure

Canonical reference for how the job-seeker plugin is organized.
When adding a new file, find the right directory here first.

---

## Directory Map

```
job-seeker/
│
├── CLAUDE.md              ← Runtime instructions, candidate profile, skill table
├── PRINCIPLES.md          ← Quality standards and voice guidelines
├── STRUCTURE.md           ← This file — canonical directory structure
├── .gitignore             ← Excludes output/, memory/, and OS files
│
├── skills/                ← One subdirectory per skill
│   ├── daily-digest/
│   │   └── SKILL.md
│   ├── why-this-company/
│   │   └── SKILL.md
│   ├── cover-letter/
│   │   └── SKILL.md
│   ├── resume-tailor/
│   │   └── SKILL.md
│   ├── company-research/
│   │   └── SKILL.md
│   ├── interview-prep/
│   │   └── SKILL.md
│   ├── application-tracker/
│   │   └── SKILL.md
│   └── networking-outreach/
│       └── SKILL.md
│
├── references/            ← Shared permanent reference material (committed)
│   ├── resume.pdf         ← Canonical resume (source of truth)
│   ├── voice-guide.md     ← Writing voice calibration
│   ├── blog-88-deployments.pdf
│   └── blog-team-building.pdf
│
├── output/                ← Generated per-company materials (gitignored)
│   └── {company-name}/
│       ├── why-this-company.md
│       ├── cover-letter-{date}.md
│       └── ...
│
└── memory/                ← Runtime state mirrors (gitignored)
    └── job-search/        ← Source of truth is Apple Notes
        ├── seen-postings.md
        └── preferences.md
```

---

## What Gets Committed vs. What Doesn't

| Category | Committed? | Rationale |
|----------|-----------|-----------|
| CLAUDE.md, PRINCIPLES.md, STRUCTURE.md | Yes | Core infrastructure |
| skills/*/SKILL.md | Yes | Skill definitions |
| references/ (resume, voice guide, blogs) | Yes | Permanent reference material |
| output/ (cover letters, why responses) | No | Generated per-application, changes constantly |
| memory/ (seen postings, preferences) | No | Runtime state, Apple Notes is source of truth |

---

## Skill Status

| Skill | Status | Description |
|-------|--------|-------------|
| `daily-digest` | **Active** | Runs interactively on session open, writes to Apple Notes (requires macOS) |
| `why-this-company` | **Active** | Generates "why this company" responses |
| `cover-letter` | **Active** | Generates tailored cover letters |
| `resume-tailor` | Planned | Customizes resume emphasis per role |
| `company-research` | Planned | Deep dive research on target companies |
| `interview-prep` | Planned | Behavioral questions + STAR story mapping |
| `application-tracker` | Planned | Pipeline tracking across opportunities |
| `networking-outreach` | Planned | Outreach message drafts |

---

## File Placement Decision Tree

1. **Is it a skill definition?** → `skills/{skill-name}/SKILL.md`
2. **Is it permanent reference material shared across skills?** → `references/`
3. **Is it generated output for a specific company?** → `output/{company-name}/`
4. **Is it runtime state?** → `memory/` (and mirrored in Apple Notes)
5. **None of the above?** → Ask before creating.
