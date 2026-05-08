# Changelog

All notable changes to job-seeker. Format roughly follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/).

## [0.6.0] — 2026-05-07

### Added

- **ATS resume template** (PRs #96, #97, #98, #117, #118) — full pipeline
  replacing prior bullet-reorder logic: parse → select → compose → render
  → enforce. Plain Calibri 11 visuals; per-role hiring mandate line.
- **Ghost-job legitimacy check (MVP)** in `/daily-digest` (PR #116, issue #68).
- **Derived-state CLI** subcommands and `infer-stage` CLI (PRs #99, #111).
- **Gmail-side auto-trash-by-sender** (PR #92).
- **iCloud relay variant auto-derive** + Gmail sender audit CLI (PR #94).

### Changed

- **TypeScript migration**: `scripts/lib/*` and 17 CLI entry points moved
  from JS to TS (issue #100, PRs #112/#113/#114/#115). Bun runtime;
  `bunx tsc --noEmit` is the type-check gate. CLAUDE.md updated to mandate
  TS for new code.
- `daysBetween` leap-day + overflow fix (PR #108).
- Dispatcher `switch` replaced with command table (PR #109).
- UTC helper centralized (PR #111).

### Fixed

- LinkedIn alerts now trashed regardless of classifier outcome (PR #87).
- `scan-email` Phase 6 Step 1 made deterministic via `auto_trash_inbox`
  CLI (PR #89).
- `auto_trash_inbox` CLI hardened against silent-failure regressions
  (PR #91).
- `gmail create-draft --to` made optional (PR #95).

### Docs

- README skill table refreshed (13 skills, including `/evaluate` and
  `/networking-outreach` now Active).
- ROADMAP updated through v0.6 ship.
- This CHANGELOG file created.

## [0.5.0] — 2026-04-22

### Added

- **`/evaluate` skill** (PR #73, issue #67) — scored fit analysis across
  6 blocks (role/archetype, CV match, level strategy, comp, personalization,
  interview prep). STAR+R stories appended to `output/story-bank.md`.
- **Application status auto-detection** in `scan-email` from ATS emails
  (PR #66, issue #18).

### Docs

- README refreshed for the v0.5 skill landscape (PR #59).

## [0.4.0] — 2026-04-04

### Added

- **`/follow-up` skill** + Gmail draft CLI (PR #55, issue #17). Single
  OAuth2 flow lives in `credentials/`; replaces prior MCP-based path.
- **`/interview-prep` skill** with Apple Calendar adapter (PR #54,
  issue #15). STAR story mapping; normalized event shape.
- **`/scan-email` skill** for Apple Mail job alert extraction (PR #12).
  Subsequent: trash processed alerts (PR #13).
- **Phase cache layer** — resumable skills (`daily-digest`,
  `scan-email`, `resume-tailor`) cache phase outputs (PR #51, issue #35).
- **`/setup` skill** — first-time configuration wizard and ongoing health
  check.
- **Commands and hooks** — `/pipeline`, `/is-open`, `/stats`; session-start,
  pre-write PII guard, stop-checker hooks.

### Fixed

- Resume docx: blank line between frontmatter and heading (PR #57).
- Apple Notes: duplicate entries and formatting errors (PR #53).
- Cache: corrupt files and missing `expires_at` (PR #35).

## [0.3.x] — 2026-03

### Added

- **Apple Notes integration** — digest delivery via `osascript`
  (read/write/upsert/list AppleScripts).
- **State layer**: `output/*-seen-postings.md`, `*-preferences.md`,
  `*-applications.md` as primary; Apple Notes as optional secondary.
- **Candidate-agnostic configuration** — `config/candidate.md` +
  `config/search.md` with `.example` templates and validators.
- **`/application-tracker`, `/company-research`, `/resume-tailor`,
  `/linkedin-article`, `/why-this-company`, `/cover-letter`** skills shipped.
- **Posting date tracking** in `seen-postings.md` (`posted:` /
  `discovered:` fields).

### Changed

- Migrated runtime from Cowork to Claude Code on macOS (osascript path
  requirement).

## [0.2.2] — 2026-02

Initial multi-skill plugin scaffolding. `/daily-digest` first shipped.

## [0.1.0] — 2026-02

Initial commit. Plugin structure and `plugin.json`.

[0.6.0]: https://github.com/chriscantu/job-seeker/compare/...HEAD
[0.5.0]: https://github.com/chriscantu/job-seeker/commits/main
[0.4.0]: https://github.com/chriscantu/job-seeker/commits/main
[0.3.x]: https://github.com/chriscantu/job-seeker/commits/main
[0.2.2]: https://github.com/chriscantu/job-seeker/commits/main
[0.1.0]: https://github.com/chriscantu/job-seeker/commits/main
