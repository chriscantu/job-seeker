# Specification: Candidate-Agnostic Configuration

**Date**: 2026-03-14
**Status**: Implemented — shipped in feature/candidate-agnostic-config branch
**Roadmap item**: v0.4 Item 5

---

## Problem

The candidate profile (name, current role, target roles, comp floor, accomplishments,
location) is hardcoded in `CLAUDE.md` and referenced across multiple skill files.
Swapping this plugin to a new user requires a find-and-replace across the whole repo.
State is tied to Apple Notes, which is a macOS-only, personal integration that new
users may not use or have access to.

## Goal

Any job seeker should be able to clone this repo, drop in their resume and a couple
of writing samples, fill out two config files, and have every skill work for them —
without touching `CLAUDE.md` or hunting for hardcoded profile strings.

## Out of Scope

- Running the plugin for multiple users simultaneously (one instance = one candidate)
- Automating the onboarding flow (config files are filled in manually)
- Migrating existing Apple Notes state to the new state layer

---

## Solution

Four changes in one coordinated pass:

1. **Config files** — move candidate data out of `CLAUDE.md` into `config/`
2. **References convention** — document `references/` as the drop-in replacement surface
3. **State layer** — replace Apple Notes as the default state mechanism with local markdown files in `output/`
4. **Thin `CLAUDE.md`** — make it a pointer document; update all skill files to read config directly

---

## Config Files

### `config/candidate.md` (gitignored)

Personal identity. Does not change during a search.

```markdown
| Field | Value |
|-------|-------|
| Name | Your Name |
| Current Role | Title, Company |
| Target Roles | Senior Director of Engineering, VP of Engineering, ... |
| Experience | X+ years leading [domain] teams (N+ engineers) |
| Core Strengths | Strength 1, Strength 2, Strength 3 |
| Previous Companies | Company A, Company B, Company C |
| Education | Degree, University |
| Location | City, State |
| Email | you@example.com |
```

### `config/search.md` (gitignored)

Search preferences that evolve during the job search.

```markdown
| Field | Value |
|-------|-------|
| Remote Preference | Remote or Hybrid |
| Comp Floor | $X base + Y% bonus + $Z equity |
| Company Types | Mission-driven, growth-stage, midsize |
| Companies to Skip | (comma-separated list) |
| Sources | LinkedIn, Greenhouse, Wellfound, ... |
| Apple Notes Prefix | Job Search |
```

`Apple Notes Prefix` is optional. If present, skills use it to construct note
names (e.g., `Job Search - Seen Postings`). Default value is `Job Search` for
backward compatibility with Chris's existing notes. A second user on the same
Mac would set a different prefix (e.g., `Jane Job Search`) to avoid sharing state.

### Templates (committed)

`config/candidate.md.example` and `config/search.md.example` are committed to git
as templates. Actual config files are gitignored. This mirrors the existing
`integrations/config/notes-config.md.example` pattern.

---

## References Convention

```
references/
  resume.pdf                     ← canonical resume (replace to onboard as new user)
  voice-guide.md                 ← existing voice/tone guidance
  writing-samples/               ← gitignored directory
    sample-cover-letter-1.md     ← 2-3 samples that establish candidate voice
    sample-cover-letter-2.md
    voice-notes.md               ← optional freeform tone notes
  writing-samples/README.md      ← committed; explains what to put here and why
```

Skills that produce written output (`cover-letter`, `why-this-company`,
`networking-outreach`) check for files in `references/writing-samples/` before
writing. If the directory is empty or missing, they fall back to
`references/voice-guide.md` and `PRINCIPLES.md` — preserving current behavior.

---

## State Layer

State moves from Apple Notes (personal, macOS-only) to local markdown files in
`output/` (already gitignored). Apple Notes remains available as an optional
personal integration for Chris — `daily-digest` can still write there in addition
to the local files. It is no longer the only state mechanism.

### File Convention

Files are named with a date prefix so you can distinguish them and see history:

```
output/
  2026-03-14-seen-postings.md     ← deduplication log
  2026-03-14-applications.md      ← pipeline tracker
  2026-03-14-preferences.md       ← source effectiveness, interest signals
  natera/
    Christopher_Cantu_CoverLetter_Natera.md
    ...
```

State files live at the `output/` root, not in company subdirectories — they are
global state, not per-company artifacts. Company artifacts (cover letters, resumes)
continue to live in `output/{company-slug}/`.

### Read Behavior

Glob for `output/*-seen-postings.md`, sort descending by filename, read the first
result. Treat missing files (empty glob result) as empty state — no error.

### Write Behavior

Glob for `output/*-seen-postings.md`, sort descending, append new entries to the
first result. If no file exists, create `output/{YYYY-MM-DD}-seen-postings.md`
using today's date and write the first entry. The date in the filename reflects
when this search session's state file was created, not each individual write.
A "fresh start" is as simple as not having a file — natural for when a search
ends and a new one begins.

### Entry Format

**seen-postings.md**:
```markdown
## 2026-03-14
- Natera | VP Engineering | https://boards.greenhouse.io/natera/jobs/123
- Maven Clinic | VP Engineering | https://jobs.lever.co/mavenclinic/abc
```

**preferences.md**:
```markdown
## 2026-03-14
### Source Effectiveness
- Greenhouse: 3 relevant roles found
- Wellfound: 1 relevant role found

### Passed Roles
- Acme Corp | VP Engineering — reason: in-office only
```

**applications.md** — schema deferred to the `application-tracker` skill spec (v0.4 Item 3).

---

## CLAUDE.md Changes

**Remove**: the full "Candidate Profile" table (name, role, target roles, comp, etc.)

**Add** in its place:
```markdown
## Candidate Profile
Read `config/candidate.md` for the full candidate profile.

## Search Preferences
Read `config/search.md` for target roles, comp floor, location constraints,
and sources to search.
```

**Update**: State Management section — replace Apple Notes note references with
`output/` file glob pattern.

**Add** to Apple Notes section:
```
This is Chris's personal integration and is not required for the plugin to function.
New users: see integrations/adapters/apple-notes.md if you want to enable it.
```

**Keep unchanged**: Purpose, Skill invocation table, Resume section, PRINCIPLES.md
reference.

---

## Skill Updates

Every skill that reads candidate context or writes state gets two changes:

### Config reads

Add to each skill's "Before You Start" section:

```
1. Read `config/candidate.md` — candidate name, role, experience, strengths
2. Read `config/search.md` — comp floor, target roles, location preference
```

If a skill already lists these reads, no change needed.

### State reads/writes

Replace Apple Notes state calls with output/ file pattern:

| Old (Apple Notes) | New (output/ files) |
|-------------------|---------------------|
| `osascript ... apple_notes_read.applescript "Job Search - Seen Postings"` | Glob `output/*-seen-postings.md`, read most recent |
| `osascript ... apple_notes_update.applescript "Job Search - Seen Postings"` | Append to most recent `output/*-seen-postings.md` |
| `osascript ... apple_notes_read.applescript "Job Search - Preferences"` | Glob `output/*-preferences.md`, read most recent |
| `osascript ... apple_notes_update.applescript "Job Search - Preferences"` | Append to most recent `output/*-preferences.md` |

### Skills affected

| Skill | Config reads | State changes |
|-------|-------------|---------------|
| `daily-digest` | candidate + search | seen-postings + preferences read/write; Apple Notes write remains as optional secondary; update HTML template greeting to use candidate name from config; derive filter criteria from `config/search.md` |
| `cover-letter` | candidate | seen-postings append (log materials prepared); applications write deferred to application-tracker spec |
| `why-this-company` | candidate + search | On "yes, applying": update seen-postings to mark role as APPLYING; applications write deferred to application-tracker spec |
| `resume-tailor` | candidate + search | none |
| `company-research` | candidate | none |
| `interview-prep` | candidate | none |
| `networking-outreach` | candidate | none |
| `application-tracker` | candidate + search | applications read/write (implemented fresh — separate spec) |

---

## .gitignore Additions

```
config/candidate.md
config/search.md
references/writing-samples/
```

(`output/` is already gitignored)

---

## PRINCIPLES.md Updates

Update the "Don't duplicate config" principle:

```markdown
**Don't duplicate config** — Candidate profile and search preferences live in
`config/candidate.md` and `config/search.md`. Skills read them; they don't
hardcode them. Never copy profile data into a skill file.
```

Update the "State Continuity" section:

```markdown
**State Continuity** — `output/` markdown files are the source of truth for
state that persists across sessions (seen postings, preferences, applications).
Apple Notes is an optional personal integration — `daily-digest` writes there
as a secondary layer when configured, but it is not required for the plugin
to function. Skills read the most recent `output/*-{state-type}.md` file via
glob before acting and append to it after completing.
```

---

## Rollout

This is a breaking change — all skill files are updated in a single PR. No
partial migration. Skills that are currently stubs (`application-tracker`,
`resume-tailor`, etc.) get the config-read instructions added even if the
rest of the skill isn't implemented yet.

Delete `memory/job-search/seen-postings.md` and `memory/job-search/preferences.md`
as part of this PR — they are superseded by `output/` state files. The
`memory/job-search/` directory itself can be removed if empty. Update `CLAUDE.md`
to remove the reference to `memory/job-search/` as a local mirror.

Create `references/writing-samples/README.md` (committed) explaining: what writing
samples to include (2–3 cover letters or narratives that represent the candidate's
voice), why skills use them (tone calibration), and file naming conventions.

### Automated validation — `scripts/validate-config.js`

A Node.js script (run via `node scripts/validate-config.js`) that:

1. Checks `config/candidate.md` exists; if not, exits with a message pointing to `config/candidate.md.example`
2. Checks `config/candidate.md` contains all required fields: Name, Current Role, Target Roles, Experience, Core Strengths, Previous Companies, Education, Location, Email
3. Checks `config/search.md` exists; if not, exits with a message pointing to `config/search.md.example`
4. Checks `config/search.md` contains all required fields: Remote Preference, Comp Floor, Company Types
5. Checks `.gitignore` contains: `config/candidate.md`, `config/search.md`, `references/writing-samples/`
6. If any `output/*-seen-postings.md` files exist, validates they follow `YYYY-MM-DD-seen-postings.md` naming
7. Prints a summary: `✓ Config valid` or `✗ N issues found` with specific messages for each failure

Skills instruct Claude to run `node scripts/validate-config.js` as the first step in "Before You Start" — if it exits non-zero, stop and surface the error message to the user.

### Manual test protocol — `integrations/docs/config-migration-test-protocol.md`

A step-by-step protocol (modeled after `apple-notes-test-protocol.md`) to be run after implementation:

1. Run `node scripts/validate-config.js` with both config files present — confirm `✓ Config valid`
2. Rename `config/candidate.md` to `config/candidate.md.bak`, run `daily-digest` — confirm clear error message pointing to `.example` file
3. Restore config, run `daily-digest` — confirm greeting uses `Name` field from config (not hardcoded "Chris")
4. Confirm state was written to `output/*-seen-postings.md` with correct entry format
5. Confirm Apple Notes still received a write when `integrations/config/notes-config.md` is present
6. Run `cover-letter` for a test company — confirm it reads `references/writing-samples/` if files are present
7. Add a file to `references/writing-samples/` and rerun `cover-letter` — confirm the sample is referenced
8. Confirm `memory/job-search/` directory no longer exists in the repo
9. Run `node scripts/validate-config.js` with a missing required field — confirm specific failure message

---

## Open Questions

1. **First-run UX**: If `config/candidate.md` doesn't exist, should skills fail
   with a clear error message pointing to `config/candidate.md.example`, or
   silently fall back to any CLAUDE.md context? **Recommendation**: fail with a
   clear message — silent fallback defeats the purpose of the migration.

2. **Apple Notes for new skills**: Skills not yet implemented (`company-research`,
   `interview-prep`) never had Apple Notes state. They start clean with the
   output/ pattern — no migration needed.
