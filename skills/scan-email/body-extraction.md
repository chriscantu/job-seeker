# Scan Email — Body Extraction

Rules for fetching email bodies and extracting job posting URLs.
Applied to both Apple Mail and Gmail messages.

## Apple Mail Body Fetch

For each Apple Mail candidate, use the `message_index` stored during
classification. **Do NOT re-derive the index** — always use the stored
value. Indices can shift if new mail arrives between phases.

```bash
osascript {plugin_root}/scripts/apple_mail_read.applescript "{account_name}" "{inbox_name}" {message_index}
```

### Parsing Apple Mail Responses

| Response prefix | Action |
|----------------|--------|
| `HTML:` | Extract URLs from HTML `href="..."` attributes |
| `TEXT:` | Extract URLs matching `https?://[^\s<>"]+` |
| `BODY_UNAVAILABLE:` | Add to results: "body unavailable — classified on subject/sender only" |
| `ACCOUNT_NOT_FOUND` or `MAILBOX_NOT_FOUND` | Account lost mid-scan — stop remaining fetches, report error |
| `MESSAGE_NOT_FOUND` | Message moved/deleted since scan — skip, note in results |
| `error:` | Log error, skip message, continue |

## Gmail Body Fetch

For each Gmail candidate, use the stored `messageId`:

```
[gmail_read_message: messageId="{messageId}"]
```

### Parsing Gmail Responses

Gmail MCP returns a structured object with `body`, `headers`, `attachments`.

| Condition | Action |
|-----------|--------|
| `body` contains HTML tags | Extract URLs from `href="..."` attributes |
| `body` is plaintext | Extract URLs matching `https?://[^\s<>"]+` |
| `body` empty or missing | "body unavailable — classified on subject/sender only" |
| MCP call fails | Log error, skip message, continue |

## URL Extraction (Both Sources)

For each email body, extract:

1. **Job URL(s)** — filter for known ATS URL patterns from
   `references/email-patterns.md` → URL Extraction Patterns
2. **Company name** — from email subject, body content, or URL domain
3. **Role title** — from email subject or body content
4. **Location** — if mentioned in the body
5. **Comp range** — if mentioned in the body

### Tracking Redirects

If URLs are tracking redirects (Indeed `rc/clk/`, LinkedIn `/comm/`, etc.),
flag them for redirect resolution in Phase 4. Do not resolve during body
extraction — batch all resolutions together later.

### No URL Found

If no job URL is found in the body despite matching sender/subject patterns,
flag the role for **WebSearch fallback** in the orchestrator's dedup/verify phase.

## Batching

Read `skills/_shared/batching.md` for reference. If some calls in the batch
fail while others succeed, process successful results normally and handle
failures per the rules above.
