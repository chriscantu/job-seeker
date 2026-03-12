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
| Headings | `<div><span style="font-size: 18px"><b>Title</b></span></div>` | `<h1>`, `<h2>`, `<h3>` |
| Links in table cells | Not supported — use plain text or move link outside table | `<a href="...">` inside `<td>` |
| Font sizing | `<span style="font-size: 14px">` | `<font size="...">` |
| Bold | `<b>text</b>` | `<strong>` (works but inconsistent) |
| Line breaks | `<div><br></div>` | `<br>` outside div |

---

## AppleScript Execution Pattern

All four scripts follow the same invocation pattern from skill instructions.
Replace `{plugin_root}` with the value from `integrations/config/notes-config.md`.

**Create** (digest):
```applescript
do shell script "osascript " & quoted form of ("{plugin_root}/scripts/apple_notes_create.applescript") & " " & ¬
    quoted form of noteTitle & " " & ¬
    quoted form of htmlBody & " " & ¬
    quoted form of folderName
```

**Read** (state notes):
```applescript
do shell script "osascript " & quoted form of ("{plugin_root}/scripts/apple_notes_read.applescript") & " " & ¬
    quoted form of noteTitle & " " & ¬
    quoted form of folderName
```

**Update** (state notes):
```applescript
do shell script "osascript " & quoted form of ("{plugin_root}/scripts/apple_notes_update.applescript") & " " & ¬
    quoted form of noteTitle & " " & ¬
    quoted form of htmlBody & " " & ¬
    quoted form of folderName
```

**List** (folder inventory):
```applescript
do shell script "osascript " & quoted form of ("{plugin_root}/scripts/apple_notes_list.applescript") & " " & ¬
    quoted form of folderName
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
| Note found | Full plaintext body | Parse and use |
| Note not found | `NOTE_NOT_FOUND` | Treat as empty state |
| Folder not found | `FOLDER_NOT_FOUND` | Create folder + treat as empty state |
| Any other error | `error: {message}` | Log warning, proceed with empty state |

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
| Folder empty | `""` (empty string) | Treat as no notes |
| Folder not found | `FOLDER_NOT_FOUND` | Treat as no notes |
| Any other error | `error: {message}` | Log warning, proceed |

---

## Error Handling

Errors are **non-blocking** — matching eisenhower's reminders adapter pattern:

- Skills surface errors to Chris with the exact message, then continue.
- `daily-digest` falls back to `output/digest-{date}.html` on create failure.
- Failure is **never silently swallowed**. Chris always knows when Notes is unavailable.

---

## State Notes Reference

| Apple Note | Operation | Script |
|------------|-----------|--------|
| `Job Search - Seen Postings` | read + update | read.applescript, update.applescript |
| `Job Search - Preferences` | read + update | read.applescript, update.applescript |
| `Job Search - Applications` | read + update | read.applescript, update.applescript |
| Daily digest (`Job Search Digest - {date}`) | create | create.applescript |
