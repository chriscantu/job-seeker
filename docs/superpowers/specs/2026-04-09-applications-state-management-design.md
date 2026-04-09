# Applications State Management — Design Spec

> **Issue:** #42 — Add applications state management to state.js

## Problem

The shared state I/O utility (`scripts/state.js`) covers `seen-postings` and
`preferences` — both append-only with date headers. The `applications` state
file has fundamentally different semantics:

- **In-place update** — stage transitions modify existing entries
- **Structured schema** owned by `application-tracker` via `pipeline-schema.md`
- **History tracking** — each entry has an append-only history log within a mutable parent
- **Cross-skill writes** — `cover-letter` and `resume-tailor` append notes to existing entries

These differences require a dedicated read/update interface, not the append
pattern used by the other two file types.

## Approach

Mirror the `seen-postings` pattern: a single `scripts/lib/applications.js`
module with regex-based markdown parsing, in-place writes via
`atomicWriteFileSync`, and all functions exported for unit testing. The CLI
dispatches to it the same way it dispatches to the other modules.

The applications markdown format is easier to parse than seen-postings — it uses
structured `### heading` + `- **Key**: Value` pairs rather than overloaded
bullet lines with mixed delimiters.

---

## 1. Parser — `scripts/lib/applications.js`

Parses the markdown format defined in `pipeline-schema.md` into structured JSON.
The file has two sections (`## Active Applications`, `## Closed Applications`),
each containing entries under `### {Company} — {Role Title}` headings.

### Parsed entry shape

```js
{
  company: "Maven",
  title: "VP Engineering",
  stage: "Screen",
  applied: "2026-04-01",
  lastActivity: { date: "2026-04-08", detail: "Phone screen with recruiter" },
  nextAction: "Prep for technical interview",
  contacts: "Jane Doe (Recruiter)",
  url: "https://...",
  notes: "Strong culture fit",
  history: [
    { date: "2026-04-01", stage: "Applied", detail: "Submitted via website" },
    { date: "2026-04-08", stage: "Screen", detail: "Phone screen with recruiter" }
  ],
  closed: null,          // active entry
  // closed entries: { date: "2026-04-10", reason: "rejected", summary: "No response after screen" }
}
```

### Exported functions

| Function | Purpose |
|----------|---------|
| `parseApplicationsContent(content)` | Parse a markdown string into `{ active: [], closed: [] }` |
| `parseApplicationsFile(filePath)` | Read file, delegate to `parseApplicationsContent` |
| `parseApplications(dir)` | Glob for most recent `*-applications.md`, parse it |
| `updateApplication(dir, { company, stage, detail })` | Find entry by company, update stage + append history |
| `addNote(dir, { company, note })` | Find entry by company, append to Notes and history |
| `createApplication(dir, entry)` | Add a new entry to Active Applications section |
| `formatApplication(entry)` | Render a single entry back to markdown |
| `formatApplicationsFile({ active, closed })` | Render full file with Active/Closed sections, `Last updated` timestamp |

### Key decisions

- **Lookup by company** — case-insensitive substring match. Company names are
  unique in practice and match how skills refer to applications ("update Maven
  to Screen stage"). Returns an error if zero or multiple entries match.
- **In-place mutation** — reads file, modifies the entry, writes the whole file
  back via `atomicWriteFileSync`. No append-only semantics.
- **Auto-timestamp** — `updateApplication` and `addNote` set
  `lastActivity.date` to today and append a history line with today's date.
- **Stage validation** — `updateApplication` validates against the stages
  defined in `pipeline-schema.md`. Rejects unknown stages.

---

## 2. CLI Interface — changes to `scripts/state.js`

Add `applications` as a recognized type and wire up four subcommands.

### Commands

```bash
# Read all entries (or filter by stage)
bun scripts/state.js read applications
bun scripts/state.js read applications --stage Applied

# Update stage (finds by company, case-insensitive substring)
bun scripts/state.js update applications --company Maven --stage Screen --detail "Phone screen with recruiter"

# Add a note to an existing entry
bun scripts/state.js add-note applications --company Maven --note "Cover letter generated 2026-04-09"

# Create a new entry
bun scripts/state.js create applications '{"company":"Maven","title":"VP Engineering","url":"https://...","stage":"Applied"}'
```

### Design decisions

- **`add-note` is its own command** rather than overloading `update` with
  `--add-note`. Stage transitions and annotations are semantically different
  operations; splitting them simplifies arg parsing and validation.
- **`read` with `--stage` filter** reuses the existing `parseArgs` helper.
  Returns JSON array, same pattern as seen-postings read.
- **`create` takes a JSON blob** — same pattern as `append` for other types.
  Validator ensures required fields. Defaults `applied` to today if omitted.
- **`update` and `add-note` are applications-only commands** — added to the
  guard list alongside `query`, `dedup-check`, `flag` (seen-postings-only).
- **File creation** — if no `*-applications.md` exists, `create` bootstraps one
  with today's date prefix and the standard header from `pipeline-schema.md`.

---

## 3. Validator — `scripts/lib/validators.js`

Add `validateApplicationEntry(entry)` for the `create` command.

**Required fields:** `company`, `title`, `stage`

**Optional fields:** `url`, `applied`, `notes`, `contacts`, `nextAction`

**Validations:**

- `company` and `title`: non-empty strings, no pipe characters
- `stage`: one of `Discovery`, `Research`, `Applied`, `Screen`,
  `Interview (1)`, `Interview (2+)`, `Final Round`, `Offer`, `Decision`, `Closed`
- `url`: valid HTTP(S) URL or null
- `applied`: YYYY-MM-DD format if provided, defaults to today

---

## 4. Skill Wiring — cross-skill validation

Two skills call `state.js` to validate end-to-end.

### cover-letter/SKILL.md

After generating a cover letter:

```bash
bun scripts/state.js add-note applications --company "{company}" --note "Cover letter generated {date}"
```

### resume-tailor/SKILL.md

After tailoring a resume:

```bash
bun scripts/state.js add-note applications --company "{company}" --note "Resume tailored {date}"
```

### Supporting changes

- **`skills/_shared/state-io.md`** — add documentation of the applications
  subcommands so all skills have the reference.
- **Guard clause** — both skills check if an application entry exists for the
  company. If `add-note` returns an error (no match), the skill logs a note and
  continues rather than failing the whole run.

### What doesn't change

`application-tracker/SKILL.md` manages the file directly via Read/Write. It
doesn't route through the CLI for full pipeline updates — the CLI is for
surgical cross-skill writes.

---

## 5. Testing

### Unit tests — `tests/applications.test.js`

- Parse a well-formed applications markdown string — verify entry shape and
  field extraction for both active and closed entries
- Parse Active vs Closed sections correctly
- `updateApplication` — stage transition updates stage, lastActivity, appends
  history line
- `updateApplication` — rejects invalid stage names
- `addNote` — appends to Notes field and appends history line
- `createApplication` — adds entry to Active section, creates file if none
  exists
- `formatApplicationsFile` round-trip — parse then format then parse produces
  identical entries
- Company lookup — case-insensitive substring match, error on zero matches,
  error on ambiguous match (multiple companies match substring)

### CLI integration tests — additions to `tests/state-cli.test.js`

- `read applications` returns valid JSON (empty array when no file exists)
- `create applications '{...}'` creates file and entry, subsequent `read`
  returns it
- `update applications --company ... --stage ...` transitions stage
- `add-note applications --company ... --note ...` appends note
- Error cases: unknown stage, missing `--company`, no matching entry,
  `update`/`add-note` on wrong type

### Test strategy

Unit tests use in-memory markdown strings via `parseApplicationsContent` (same
pattern as `parseSeenPostingsContent`). CLI integration tests work against real
files in `output/` — they create, read, and clean up a temp applications file.

---

## Files Changed

| File | Action |
|------|--------|
| `scripts/lib/applications.js` | Create — parser, writer, update, add-note |
| `scripts/lib/validators.js` | Edit — add `validateApplicationEntry` |
| `scripts/state.js` | Edit — add `applications` type, `update`, `add-note`, `create` commands |
| `tests/applications.test.js` | Create — unit tests for parser and writer |
| `tests/state-cli.test.js` | Edit — add CLI integration tests for applications |
| `skills/_shared/state-io.md` | Edit — document applications subcommands |
| `skills/cover-letter/SKILL.md` | Edit — add post-generation `add-note` call |
| `skills/resume-tailor/SKILL.md` | Edit — add post-generation `add-note` call |