# Apple Notes Integration (Optional)

Optional integration for writing to Apple Notes on macOS. Non-blocking — all
errors are logged, never fatal. Skip this module entirely if Apple Notes is
not configured.

## Configuration Check

Check if `integrations/config/notes-config.md` exists:
- **If absent**: skip all Apple Notes operations silently. Do not warn the user.
- **If present**: read `plugin_root` and `default_folder` from the config file.

## Operations

### Create a Note

Creates a new note (replaces if one with the same title exists):

```bash
osascript {plugin_root}/scripts/apple_notes_create.applescript "{title}" "{html_body}" "{folder}"
```

Use for: new digests, new content that should be a standalone note.

### Update a Note

Updates an existing note (upsert — creates if not found):

```bash
osascript {plugin_root}/scripts/apple_notes_update.applescript "{title}" "{html_body}" "{folder}"
```

Use for: state sync (seen-postings, applications, preferences).

### Read a Note

```bash
osascript {plugin_root}/scripts/apple_notes_read.applescript "{title}" "{folder}"
```

### List Notes

```bash
osascript {plugin_root}/scripts/apple_notes_list.applescript "{folder}"
```

## Note Naming

Use the Apple Notes Prefix from `config/search.md` (default: `Job Search`):
- `{prefix} - Seen Postings`
- `{prefix} - Preferences`
- `{prefix} - Applications`

Digest notes use a date-specific title (note the em-dash `—`, not a hyphen):

- `Executive Job Digest — {Month Day, Year}` (e.g., `Executive Job Digest — April 11, 2026`)

The digest title is **not prefixed** — it always starts with `Executive Job Digest`.
This is the dedup key: same title on same-day re-runs → single note, not duplicates.

## HTML Rules

Apple Notes HTML must follow these rules (see `integrations/adapters/apple-notes.md`
for full reference):

- Wrap every line in `<div>` tags — bare text without `<div>` collapses into one block
- Use `<div><span style="font-size: 11px"><br></span></div>` for blank lines
- Never put `<a href="">` inside `<table>` cells — Apple Notes strips those links
- Use `<b><span style="font-size: Xpx">` instead of `<h1>`/`<h2>`/`<h3>` — heading tags render incorrectly
- Use `<b>` instead of `<strong>`
- No CSS classes, `<style>` blocks, or external stylesheets
- Use `<span style="font-size: Xpx">` for font sizing, not `<font size="...">`

## HTML Pre-Write Validation

Before passing `html_body` to any Apple Notes script, verify all of the following.
If any check fails, fix the HTML before writing — do not pass invalid HTML.

1. **Every text line is wrapped in `<div>...</div>`** — no bare text outside a `<div>`
2. **No `<h1>`, `<h2>`, `<h3>` tags** — replace with `<div><b><span style="font-size: Xpx">...</span></b></div>`
3. **No `<strong>` tags** — replace with `<b>`
4. **No `<p>` or `<li>` tags** — replace with `<div>` wrappers
5. **No `<a href="">` inside `<td>` cells** — move links outside tables or use plain text URLs
6. **No `<style>` blocks or CSS classes** — use only inline `style=""` attributes
7. **No `<font>` tags** — use `<span style="font-size: Xpx">` instead
8. **Blank lines use** `<div><span style="font-size: 11px"><br></span></div>` — not bare `<br>`

## Error Handling

- Check return values: success starts with `success:`, failure starts with `error:`
- On error: log to `output/error-{date}.log`, warn the user, continue skill execution
- **Apple Notes errors are non-blocking** — the `output/` files are the source of truth
- Never silently swallow a write failure — surface the error, then continue
