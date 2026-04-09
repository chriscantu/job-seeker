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

Digest notes use a date-specific title:
- `Executive Job Digest — {Month Day, Year}`

## HTML Rules

Apple Notes HTML must follow these rules (see `integrations/adapters/apple-notes.md`
for full reference):

- Wrap every line in `<div>` tags
- Use `<div><span style="font-size: 11px"><br></span></div>` for blank lines
- Never put `<a href="">` inside `<table>` cells
- Use `<b><span style="font-size: Xpx">` instead of `<h1>`/`<h2>`/`<h3>`
- No CSS classes, `<style>` blocks, or external stylesheets

## Error Handling

- Check return values: success starts with `success:`, failure starts with `error:`
- On error: log to `output/error-{date}.log`, warn the user, continue skill execution
- **Apple Notes errors are non-blocking** — the `output/` files are the source of truth
- Never silently swallow a write failure — surface the error, then continue
