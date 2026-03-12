# Plugin Structure

Canonical reference for how the job-seeker plugin is organized.
When adding a new file, find the right directory here first.

---

## Top-Level Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Runtime instructions, candidate profile, skill table |
| `PRINCIPLES.md` | Engineering principles (7 rules) + quality standards + voice guidelines |
| `STRUCTURE.md` | This file — canonical directory structure |
| `ROADMAP.md` | Near-term, long-term, deferred, and won't-do planning |
| `CONNECTORS.md` | Runtime declaration — Claude Code on macOS, Bash/osascript, no MCP servers |
| `.gitignore` | Excludes output/, memory/, personal config, OS files |
| `.claude-plugin/plugin.json` | Plugin metadata (name, version, author, keywords, skills) |

---

## Directory Map

```
job-seeker/
│
├── .claude-plugin/
│   └── plugin.json          ← Plugin metadata (no mcpServers — direct scripts only)
│
├── skills/                  ← One subdirectory per skill
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
├── scripts/                 ← Executable scripts only (AppleScript, Swift, shell)
│   ├── apple_notes_create.applescript
│   ├── apple_notes_read.applescript
│   ├── apple_notes_update.applescript
│   └── apple_notes_list.applescript
│
├── integrations/            ← Everything related to external system connections
│   ├── config/              ← Per-integration config files (gitignored) + .example templates
│   ├── adapters/            ← How to push data to external systems (field mapping, invocation)
│   ├── specs/               ← Feature specs — written BEFORE implementation
│   └── docs/                ← Implementation notes, ADRs, test protocols — written AFTER
│
├── references/              ← Shared permanent reference material (committed)
│   ├── resume.pdf           ← Canonical resume (source of truth)
│   ├── voice-guide.md       ← Writing voice calibration
│   ├── blog-88-deployments.pdf
│   └── blog-team-building.pdf
│
├── tests/                   ← Test suites and manual test protocols
│
├── output/                  ← Generated per-company materials (gitignored)
│   └── {company-name}/
│       ├── why-this-company.md
│       ├── cover-letter-{date}.md
│       └── ...
│
└── memory/                  ← Runtime state mirrors (gitignored)
    └── job-search/          ← Source of truth is Apple Notes
        ├── seen-postings.md
        └── preferences.md
```

---

## Directory Rules

### `skills/`
One subdirectory per skill, each containing a `SKILL.md`.

**What belongs here**: Skill prompt text, step-by-step behavior, invocation patterns.
**What does not belong here**: Config values, executable scripts, specs.

### `scripts/`
Executable scripts only. No documentation files.

Script-level documentation belongs in a docstring/header comment within the
script file itself, or in `integrations/docs/`.

**What belongs here**: AppleScript, Swift, shell scripts.
**What does not belong here**: Specs, adapter docs, README files.

### `integrations/`
All integration-related files live here, organized into four subdirectories.
Nothing lives directly in `integrations/` — files must go into a subdirectory.

#### `integrations/config/`
User-specific configuration — one file per integration.
**Actual config files are gitignored. Only `.example` templates are committed.**

Naming convention: `{integration-name}-config.md` / `{integration-name}-config.md.example`

#### `integrations/adapters/`
Adapter definitions — one file per target system. Documents field mapping,
invocation syntax, error handling, and dedup logic.

#### `integrations/specs/`
Feature specification documents — written BEFORE implementation, kept as a
record of decisions.

Format: problem statement, solution, design, test plan.

#### `integrations/docs/`
Implementation notes, ADRs, test protocols, and override documentation.
Explains *how* something works or *why* a choice was made. Written AFTER
implementation.

### `references/`
Permanent reference material shared across skills. Committed to source control.

**What belongs here**: Resume, voice guide, blog posts, reference docs.
**What does not belong here**: Generated output, runtime state.

### `tests/`
Test suites and manual test protocols.

**What belongs here**: Automated tests, documented manual test protocols with pass/fail criteria.
**What does not belong here**: Spec docs (those go in `integrations/specs/`).

---

## File Placement Decision Tree

1. **Is it a skill definition?** → `skills/{skill-name}/SKILL.md`
2. **Is it an executable script?** → `scripts/`
3. **Is it a user-specific value (folder name, plugin path)?** → `integrations/config/` as `.example` + gitignored actual
4. **Is it an adapter doc (how to talk to a system)?** → `integrations/adapters/`
5. **Is it a feature spec written before implementation?** → `integrations/specs/`
6. **Is it an implementation note or ADR?** → `integrations/docs/`
7. **Is it permanent reference material shared across skills?** → `references/`
8. **Is it generated output for a specific company?** → `output/{company-name}/`
9. **Is it runtime state?** → `memory/` (and mirrored in Apple Notes)
10. **None of the above?** → Ask before creating. Do not default to repo root.

---

## What Gets Committed vs. What Doesn't

| Category | Committed? | Rationale |
|----------|-----------|-----------|
| CLAUDE.md, PRINCIPLES.md, STRUCTURE.md | Yes | Core infrastructure |
| skills/*/SKILL.md | Yes | Skill definitions |
| scripts/*.applescript, *.swift | Yes | Executable scripts |
| integrations/specs/ | Yes | Design records |
| integrations/docs/ | Yes | Implementation records |
| integrations/adapters/ | Yes | Adapter contracts |
| integrations/config/*.example | Yes | Config templates |
| integrations/config/* (actual values) | No | Personal config, gitignored |
| references/ (resume, voice guide, blogs) | Yes | Permanent reference material |
| tests/ | Yes | Regression tests |
| output/ (cover letters, digests) | No | Generated per-application |
| memory/ (seen postings, preferences) | No | Runtime state |

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Skills | kebab-case directory | `daily-digest/` |
| Scripts | snake_case with extension | `apple_notes_create.applescript` |
| Config templates | `{name}-config.md.example` | `notes-config.md.example` |
| Adapters | lowercase system name | `apple-notes.md` |
| Specs | `{feature}-spec.md` | `apple-notes-integration-spec.md` |
