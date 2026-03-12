# Specification: Apple Notes Integration (Direct Script Pattern)

**Date**: 2026-03-11
**Status**: Draft — awaiting user approval before implementation
**Replaces**: MCP server approach (`scripts/apple-notes-mcp/`)

---

## Problem

The job-seeker plugin wraps Apple Notes access in a full MCP server (JSON-RPC
protocol, background process, stdio transport). Claude Code either does not launch
this server on the Mac host or launches it inside the Linux VM where `osascript`
is unavailable. The result: zero Apple Notes tools are accessible at runtime,
and the daily digest falls back to HTML files.

## Root Cause

The architecture was wrong. The eisenhower plugin — built for the same Claude Code
environment — successfully integrates with Mac Reminders and Mac Calendar using
**direct AppleScript/Swift calls from skill instructions**. No MCP server, no
protocol handshake, no background daemon.

## Solution

Replace the MCP server with standalone AppleScript files called directly from
skill markdown, mirroring eisenhower's proven Reminders adapter pattern.

---

## Design

### Scripts (new)

Four AppleScript files in `scripts/`, one per operation:

| Script | Arguments | Returns |
|--------|-----------|---------|
| `apple_notes_create.applescript` | `title`, `html_body`, `folder` | `success: {title}` or `error: {msg}` |
| `apple_notes_read.applescript` | `title`, `folder` | Note plaintext or `NOTE_NOT_FOUND` |
| `apple_notes_update.applescript` | `title`, `html_body`, `folder` | `updated: {title}` or `created: {title}` |
| `apple_notes_list.applescript` | `folder` | Newline-separated note titles |

**Default folder**: `Notes` (iCloud account)

### Invocation Pattern (from skills)

Following eisenhower's exact pattern (`reminders.md` adapter → `push_reminder.applescript`):

```
osascript {plugin_root}/scripts/apple_notes_create.applescript {title} {html_body} {folder}
```

Where `{plugin_root}` is read from a config file (see below).

### Configuration (new)

File: `integrations/config/notes-config.md` (gitignored)

```markdown
# Apple Notes Configuration

plugin_root: ~/repos/job-seeker
default_folder: Notes
account: iCloud
```

Example template committed as `integrations/config/notes-config.md.example`.

### What Gets Removed

- `scripts/apple-notes-mcp/` — entire directory (server.js, launch.sh, package.json, etc.)
- `.mcp.json` — standalone MCP config at project root
- `mcpServers` block from `.claude-plugin/plugin.json`

### What Gets Updated

- `skills/daily-digest/SKILL.md` — replace MCP tool calls with direct osascript invocations
- `PRINCIPLES.md` — replace MCP-specific rules with direct-script rules
- `STRUCTURE.md` — add `scripts/` directory and `integrations/` directory
- `CLAUDE.md` — remove MCP tool references, add script invocation instructions

---

## Deduplication (create)

Before creating a note, the create script checks for an existing note with the
same title (case-insensitive) in the target folder. If found, it deletes the old
note and creates a fresh one (digest should always reflect the latest run).

## Error Handling

Matches eisenhower's non-blocking pattern:
- Script returns `error: {message}` on failure
- Skill logs the error and falls back to `output/digest-{date}.html`
- User is told: "Apple Notes write failed — saved HTML fallback. Error: {message}"
- Failure never silently swallowed

---

## Test Plan

1. **Unit**: Run each AppleScript standalone from Terminal on macOS to verify
   create/read/update/list operations
2. **Integration**: Run `/daily-digest` in Claude Code and verify note appears in
   Apple Notes
3. **Fallback**: Disconnect from iCloud (or rename folder) and verify HTML
   fallback triggers with clear error message
4. **Dedup**: Run digest twice in same day, verify single note (not duplicated)

---

## Files Changed

### New
- `scripts/apple_notes_create.applescript`
- `scripts/apple_notes_read.applescript`
- `scripts/apple_notes_update.applescript`
- `scripts/apple_notes_list.applescript`
- `scripts/apple-notes-spec.md` (this file)
- `integrations/config/notes-config.md.example`

### Updated
- `skills/daily-digest/SKILL.md`
- `PRINCIPLES.md`
- `STRUCTURE.md`
- `CLAUDE.md`
- `.claude-plugin/plugin.json` (remove mcpServers)

### Removed
- `scripts/apple-notes-mcp/` (entire directory)
- `.mcp.json`

---

## Alignment with Eisenhower Pattern

| Aspect | Eisenhower | Job-Seeker (new) |
|--------|-----------|-----------------|
| Access method | osascript + Swift scripts | osascript scripts |
| Script location | `scripts/push_reminder.applescript` | `scripts/apple_notes_create.applescript` |
| Config | `integrations/config/task-output-config.md` | `integrations/config/notes-config.md` |
| Path resolution | `plugin_root` from config | `plugin_root` from config |
| Error handling | Non-blocking, collected at end | Non-blocking, fallback to HTML |
| MCP server | None | None |
| Background process | None | None |
