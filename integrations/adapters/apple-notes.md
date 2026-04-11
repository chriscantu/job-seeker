# Adapter: Apple Notes (v1)

**System**: Apple Notes (macOS)
**Access method**: AppleScript via osascript
**Auth required**: None — local app, iCloud sync optional
**Direction**: Bidirectional (read and write)
**Status**: Active (v0.3)

---

## How It Works

Four operations, each backed by a standalone AppleScript in `scripts/`:

**Create** — Called by `daily-digest` to write the digest note. Deletes any
existing note with the same title first (digest always reflects the latest run).
Calls `scripts/apple_notes_create.applescript`.

**Read** — Called by skills to fetch state notes (Seen Postings, Preferences,
Applications). Returns plaintext. Calls `scripts/apple_notes_read.applescript`.

**Update** — Called by skills to write state notes. Upsert semantics: updates
body if found, creates the note if not. Use this (not create) for state notes
that should persist their identity across sessions.
Calls `scripts/apple_notes_update.applescript`.

**List** — Called to check which notes exist in a folder before reading.
Returns newline-separated titles. Calls `scripts/apple_notes_list.applescript`.

---

## Configuration (from `integrations/config/notes-config.md`)

```
plugin_root: ~/repos/job-seeker
default_folder: Notes
account: iCloud
```

`plugin_root` — absolute path to the plugin repo on the Mac host.
`default_folder` — Notes folder to use when no folder is specified.
`account` — iCloud or On My Mac. Most users want iCloud for cross-device access.

---

## Field Mapping

| Operation | Argument       | Notes field   | Notes                                      |
|-----------|----------------|---------------|--------------------------------------------|
| create    | `title`        | `name`        | Dedup key — old note deleted if title matches |
| create    | `html_body`    | `body`        | Must follow Apple Notes HTML rules (see below) |
| create    | `folder`       | parent folder | Created automatically if missing            |
| read      | `title`        | `name`        | Case-insensitive match                      |
| read      | `folder`       | parent folder | Must already exist                          |
| update    | `title`        | `name`        | Case-insensitive match; creates if missing  |
| update    | `html_body`    | `body`        | Replaces full body — partial updates not supported |
| list      | `folder`       | parent folder | Lists all note titles in folder            |

---

## Apple Notes HTML Rules

Apple Notes renders a limited HTML subset. Violations produce garbled output.

| Rule | Correct | Incorrect |
|------|---------|-----------|
| Line wrapping | `<div>text</div>` | Bare text, `<p>`, `<li>` |
| Headings | `<div><b><span style="font-size: 18px">Title</span></b></div>` | `<h1>`, `<h2>`, `<h3>` |
| Links in table cells | Not supported — use plain text or move link outside table | `<a href="...">` inside `<td>` |
| Font sizing | `<span style="font-size: 14px">` | `<font size="...">` |
| Bold | `<b>text</b>` | `<strong>` (not supported) |
| Line breaks | `<div><span style="font-size: 11px"><br></span></div>` | Bare `<br>` or `<div><br></div>` |

---

## Invocation Pattern (from Bash tool)

Skills call these scripts directly via the Bash tool in Claude Code on macOS.
Replace `{plugin_root}` with the value from `integrations/config/notes-config.md`.
Expand `~` to the absolute home directory path when constructing the command.

**Create** (digest):
```bash
osascript {plugin_root}/scripts/apple_notes_create.applescript "noteTitle" "htmlBody" "folderName"
```

**Read** (state notes):
```bash
osascript {plugin_root}/scripts/apple_notes_read.applescript "noteTitle" "folderName"
```

**Update** (state notes):
```bash
osascript {plugin_root}/scripts/apple_notes_update.applescript "noteTitle" "htmlBody" "folderName"
```

**List** (folder inventory):
```bash
osascript {plugin_root}/scripts/apple_notes_list.applescript "folderName"
```

---

## Deduplication Logic

**Create (digest notes)**:
1. Check if folder exists. Create if missing.
2. Fetch `name` of every note in that folder.
3. Compare incoming title against existing names (case-insensitive, whitespace-trimmed).
4. If match found → delete existing note, then create fresh.
5. If no match → create directly.

**Update (state notes)**:
1. Check if folder exists. Create if missing.
2. Search for matching note (case-insensitive, trimmed).
3. If found → update `body` in place (preserves note creation date, iCloud identity).
4. If not found → create new note (upsert).

---

## Return Value Mapping

### Create

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Note created (or replaced) | `success: {title}` | Log success |
| Could not create folder | `error: Could not create folder ...` | Log error + HTML fallback |
| Could not delete old note | `error: Could not delete existing note ...` | Log error + HTML fallback |
| Notes app unavailable | `error: ...` (osascript error) | Log error + HTML fallback |

### Read

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Note found with content | Full plaintext body | Parse and use |
| Note found but empty | `NOTE_EMPTY` | Treat as empty state (note exists, no content yet) |
| Note not found | `NOTE_NOT_FOUND` | Treat as empty state |
| Folder not found | `FOLDER_NOT_FOUND` | Create folder + treat as empty state |
| Any other error | `error: {message}` | Log warning to `output/error-{date}.log`, proceed with empty state |

### Update

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Body updated | `updated: {title}` | Log success |
| Note created (upsert) | `created: {title}` | Log success |
| Could not create folder | `error: Could not create folder ...` | Log error |
| Could not update body | `error: Could not update note ...` | Log error |
| Any other error | `error: {message}` | Log error |

### List

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Notes exist | Newline-separated titles | Parse into list |
| Some notes unreadable | Titles + `SKIPPED_UNREADABLE:{N}` line | Parse titles, warn Chris that N notes could not be read — state note may be absent |
| Folder empty | `""` (empty string) | Treat as no notes |
| Folder not found | `FOLDER_NOT_FOUND` | Treat as no notes |
| Any other error | `error: {message}` | Log warning to `output/error-{date}.log`, proceed |

---

## Error Handling

Errors are **non-blocking** — matching eisenhower's reminders adapter pattern:

- Skills surface errors to Chris with the exact message, then continue.
- `daily-digest` falls back to `output/digest-{date}.html` on create failure.
- Failure is **never silently swallowed**. Chris always knows when Notes is unavailable.

---

## State Notes Reference

`{prefix}` = the "Apple Notes Prefix" value from `config/search.md` (default: `Job Search`).

| Apple Note | Operation | Script |
|------------|-----------|--------|
| `{prefix} - Seen Postings` | read + update | read.applescript, update.applescript |
| `{prefix} - Preferences` | read + update | read.applescript, update.applescript |
| `{prefix} - Applications` | read + update | read.applescript, update.applescript |
| `Executive Job Digest — {Month Day, Year}` | create | create.applescript |
