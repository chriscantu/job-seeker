# Adapter: Apple Mail (v1)

**System**: Apple Mail (macOS)
**Access method**: AppleScript via osascript
**Auth required**: None — local app, iCloud sync built-in
**Direction**: Read + trash (processed alerts only)
**Status**: Active (v1)

---

## How It Works

Three operations, each backed by a standalone AppleScript in `scripts/`:

**Scan** — Called by `scan-email` to retrieve email metadata (subject, sender,
date, message index) in batches of 10. Processes a configurable range of
messages from the inbox. Calls `scripts/apple_mail_scan.applescript`.

**Read** — Called by `scan-email` to fetch the full body of a single matched
email by its message index. Returns HTML source (preferred, for URL extraction)
or plaintext content (fallback). Calls `scripts/apple_mail_read.applescript`.

**Trash** — Called by `scan-email` Phase 6 to move processed job alert emails
to the account's Trash mailbox. Only emails that matched a job alert sender
AND had their body fetched are trashed. Calls `scripts/apple_mail_trash.applescript`.

---

## Configuration (from `integrations/config/mail-config.md`)

```
account_name: iCloud
inbox_name: INBOX
```

`account_name` — Substring of the Mail account name. Uses `contains` matching
so "iCloud" matches "iCloud (chris.m.cantu@icloud.com)".

`inbox_name` — Exact mailbox name within the account. Common: `INBOX`.

---

## Field Mapping

### Scan (batch metadata)

| Argument | Mail field | Notes |
|----------|-----------|-------|
| `account_name` | Account name | Substring match |
| `inbox_name` | Mailbox name | Case-sensitive lookup, case-insensitive fallback |
| `start_index` | Message position | 1-based, default mailbox sort order |
| `end_index` | Message position | Capped at message count |

| Output field | Mail property | Notes |
|-------------|--------------|-------|
| `subject` | `subject of msg` | ASCII-safe, capped at 500 chars |
| `sender` | `sender of msg` | ASCII-safe, capped at 500 chars |
| `date_received` | `date received of msg` | AppleScript date string |
| `message_index` | Loop index | Stable reference for body fetch |

### Read (single message body)

| Argument | Mail field | Notes |
|----------|-----------|-------|
| `account_name` | Account name | Substring match |
| `inbox_name` | Mailbox name | Case-sensitive lookup, case-insensitive fallback |
| `message_index` | Message position | From scan output |

| Output | Mail property | Notes |
|--------|--------------|-------|
| `HTML:{content}` | `source of msg` | Raw MIME/HTML, 4000 chars, ASCII-safe |
| `TEXT:{content}` | `content of msg` | Plaintext fallback, 4000 chars, ASCII-safe |

---

## Invocation Pattern (from Bash tool)

Skills call these scripts via the Bash tool in Claude Code on macOS.
Replace `{plugin_root}` with the repo root path (from
`integrations/config/notes-config.md` if available, or the working directory).

**Scan** (batch metadata — 10 messages at a time):
```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" {start} {end}
```

**Read** (single message body):
```bash
osascript {plugin_root}/scripts/apple_mail_read.applescript "{account_name}" "{inbox_name}" {index}
```

**Trash** (move single message to Trash):
```bash
osascript {plugin_root}/scripts/apple_mail_trash.applescript "{account_name}" "{inbox_name}" {index}
```

---

## Return Value Mapping

### Scan

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Messages found | Newline-delimited `subject\|\|\|sender\|\|\|date\|\|\|index` records | Parse and classify each record |
| Individual message unreadable | Record with `(unreadable: {reason})` subject | Skip, continue scanning |
| Fewer messages than start_index | `NO_MESSAGES` | Stop scanning (all messages processed) |
| Account not found | `ACCOUNT_NOT_FOUND` | Stop: show config guidance |
| Mailbox not found | `MAILBOX_NOT_FOUND` | Stop: show config guidance |
| Any other error | `error: {message}` | Stop: show error to user |

### Read

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| HTML source available | `HTML:{content}` | Extract URLs from href attributes |
| Plaintext only | `TEXT:{content}` | Extract URLs via URL regex |
| Body unavailable | `BODY_UNAVAILABLE: {reason}` | Classify on subject/sender only, note in results |
| Account not found | `ACCOUNT_NOT_FOUND` | Stop: show config guidance |
| Mailbox not found | `MAILBOX_NOT_FOUND` | Stop: show config guidance |
| Index out of range | `MESSAGE_NOT_FOUND` | Skip this message, note in results |
| Any other error | `error: {message}` | Log error, skip message |

### Trash

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Message trashed | `trashed: {index}` | Log success |
| Account not found | `ACCOUNT_NOT_FOUND` | Stop: show config guidance |
| Mailbox not found | `MAILBOX_NOT_FOUND` | Stop: show config guidance |
| Trash mailbox not found | `TRASH_NOT_FOUND` | Log error, skip all remaining trash calls |
| Index out of range | `MESSAGE_NOT_FOUND` | Skip (already moved/deleted), continue |
| Any other error | `error: {message}` | Log error, skip message, continue |

---

## Error Handling

Errors follow the **non-blocking** pattern from the Apple Notes adapter,
with one exception: account/mailbox not found is **fatal** (cannot proceed
without a valid mail source).

| Error class | Blocking? | Action |
|-------------|-----------|--------|
| Account/mailbox not found | Yes — fatal | Stop skill, show config guidance |
| Apple Mail not running | Warning | Detected by skill orchestration (Phase 1 Step 1a via System Events), not by the scripts. Scripts assume Mail.app is already running — `tell application "Mail"` will auto-launch it if not. |
| Individual message read failure | No | Skip message, continue |
| Body fetch failure | No | Classify on metadata only |
| Trash mailbox not found | No | Skip all trash calls, report error |
| Individual trash failure | No | Skip message, continue trashing |
| osascript timeout | No | Reduce batch size for remaining batches |

Errors are surfaced to the user with the exact message. Never silently
swallowed.

---

## Scope Restriction

- **Read + trash**: Processed job alert emails are moved to Trash after
  user confirmation. Unmatched emails are never touched. Emails are never
  marked as read or moved to any mailbox other than Trash.
- **Single account/inbox**: Only the configured account and inbox are accessed
- **No sent mail**: Only inbox messages are scanned
- **10-message batch limit**: Prevents osascript timeouts
- **50-message session cap**: Keeps runtime reasonable
