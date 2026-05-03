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
| `.gitignore` | Excludes output/, personal config, OS files |
| `.claude-plugin/plugin.json` | Plugin metadata (name, version, author, keywords, skills) |
| `.claude-plugin/marketplace.json` | Marketplace catalog for plugin installation |

---

## Directory Map

```
job-seeker/
│
├── .claude-plugin/
│   ├── plugin.json          ← Plugin metadata (no mcpServers — direct scripts only)
│   └── marketplace.json     ← Marketplace catalog for plugin installation
│
├── skills/                  ← One subdirectory per skill
│   ├── _shared/             ← Shared modules referenced by multiple skills
│   │   ├── preflight.md
│   │   ├── state-io.md
│   │   ├── ats-verification.md
│   │   ├── url-quality.md
│   │   ├── company-extraction.md
│   │   ├── apple-notes.md
│   │   └── batching.md
│   ├── daily-digest/
│   │   ├── SKILL.md
│   │   ├── scoring-rules.md
│   │   └── source-strategy.md
│   ├── why-this-company/
│   │   └── SKILL.md
│   ├── cover-letter/
│   │   └── SKILL.md
│   ├── resume-tailor/
│   │   ├── SKILL.md
│   │   └── tailoring-rules.md
│   ├── company-research/
│   │   └── SKILL.md
│   ├── interview-prep/
│   │   └── SKILL.md
│   ├── application-tracker/
│   │   ├── SKILL.md
│   │   └── pipeline-schema.md
│   ├── networking-outreach/
│   │   └── SKILL.md
│   ├── follow-up/
│   │   └── SKILL.md
│   ├── setup/
│   │   └── SKILL.md
│   ├── linkedin-article/
│   │   └── SKILL.md
│   ├── scan-email/
│   │   ├── SKILL.md
│   │   ├── classification-rules.md
│   │   └── body-extraction.md
│   └── evaluate/
│       ├── SKILL.md
│       ├── scoring-rules.md
│       └── archetypes.md
│
├── commands/                ← Slash command definitions (one .md per command)
│   ├── pipeline.md
│   ├── is-open.md
│   └── stats.md
│
├── hooks/                   ← Event hooks (SessionStart, PreToolUse, Stop)
│   ├── hooks.json           ← Hook definitions
│   └── scripts/
│       └── pii-guard.js     ← PII blocking script for Write/Edit
│
├── src/                     ← TypeScript pipeline modules (consumed via Bun)
│   └── resume-tailor/       ← Parse/score/select/compose/render pipeline for tailored resumes
│       └── page-count.ts    ← TS wrapper around scripts/resume-page-count.fish
│
├── scripts/                 ← Executable scripts only (AppleScript, Swift, JS, fish)
│   ├── apple_notes_create.applescript
│   ├── apple_notes_read.applescript
│   ├── apple_notes_update.applescript
│   ├── apple_notes_list.applescript
│   ├── apple_mail_scan.applescript
│   ├── apple_mail_read.applescript
│   ├── apple_mail_trash.applescript
│   ├── apple_calendar_search.applescript
│   ├── gmail.js             ← Gmail CLI (auth, profile, search, create-draft, trash)
│   ├── generate_coverletter_docx.js
│   ├── docx-styles.js
│   └── lib/                 ← Script-local modules
│       └── gmail-auth.js    ← OAuth2 client + token persistence for gmail.js
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
│   ├── email-patterns.md    ← Job alert email classification patterns
│   ├── blog-88-deployments.pdf
│   └── blog-team-building.pdf
│
├── tests/                   ← Test suites and manual test protocols
│
└── output/                  ← Generated materials + state files (gitignored)
    ├── YYYY-MM-DD-seen-postings.md    ← Dedup log (state)
    ├── YYYY-MM-DD-preferences.md      ← Source effectiveness (state)
    ├── YYYY-MM-DD-applications.md     ← Pipeline tracker (state)
    └── {company-name}/
        ├── why-this-company.md
        ├── cover-letter-{date}.md
        └── ...
```

---

## Directory Rules

### `skills/`
One subdirectory per skill, each containing a `SKILL.md` orchestrator.
Skills may also have local sub-modules (e.g., `scoring-rules.md`) for
skill-specific logic that would bloat the orchestrator.

**`skills/_shared/`** contains modules referenced by multiple skills via
`Read` directives (e.g., `Read skills/_shared/preflight.md and execute`).
These are the single source of truth for shared logic like config
validation, state I/O, ATS verification, and URL quality rules.

**What belongs here**: Skill orchestrators, local sub-modules, shared modules.
**What does not belong here**: Config values, executable scripts, specs.

### `src/`
TypeScript pipeline modules consumed by the Bun runtime. Organized by skill
(e.g., `src/resume-tailor/` for the resume-tailor pipeline).

Modules here are pure TS (no executable shebang). They may shell out to
fish/JS tools in `scripts/` via `Bun.spawn`. Tests live in `tests/`
mirroring the directory layout (e.g., `tests/resume-tailor/page-count.test.ts`).

**What belongs here**: TypeScript modules with one clear responsibility per file.
**What does not belong here**: Executable scripts (use `scripts/`), tests
(use `tests/`), generated output (use `output/`).

### `scripts/`
Executable scripts only. No documentation files.

Script-level documentation belongs in a docstring/header comment within the
script file itself, or in `integrations/docs/`.

**What belongs here**: AppleScript, Swift, shell/fish scripts, JS generators.
**What does not belong here**: Specs, adapter docs, README files, TS modules
(use `src/`), Python source (Python deps live in installed plugin packages,
not in this repo).

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
1a. **Is it logic shared across multiple skills?** → `skills/_shared/`
1b. **Is it skill-specific logic extracted from a SKILL.md?** → `skills/{skill-name}/`
2. **Is it an executable script?** → `scripts/`
2a. **Is it a TypeScript pipeline module (no shebang, imported by tests)?** → `src/{skill-name}/`
3. **Is it a user-specific value (folder name, plugin path)?** → `integrations/config/` as `.example` + gitignored actual
4. **Is it an adapter doc (how to talk to a system)?** → `integrations/adapters/`
5. **Is it a feature spec written before implementation?** → `integrations/specs/`
6. **Is it an implementation note or ADR?** → `integrations/docs/`
7. **Is it permanent reference material shared across skills?** → `references/`
8. **Is it generated output for a specific company?** → `output/{company-name}/`
9. **Is it runtime state?** → `output/` as a date-prefixed markdown file
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
| output/ state files (seen-postings, preferences, applications) | No | Runtime state, gitignored with output/ |

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Skills | kebab-case directory | `daily-digest/` |
| Scripts | snake_case with extension | `apple_notes_create.applescript` |
| Config templates | `{name}-config.md.example` | `notes-config.md.example` |
| Adapters | lowercase system name | `apple-notes.md` |
| Specs | `{feature}-spec.md` | `apple-notes-integration-spec.md` |
