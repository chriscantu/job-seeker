# Connectors

## Runtime: Claude Code on macOS

This plugin runs in **Claude Code CLI on macOS**, not Cowork. Claude Code has
direct access to `osascript` via the Bash tool, which is how all native macOS
app integrations work. No MCP servers, no background daemons — Gmail uses a
local CLI (`scripts/gmail.js`) backed by the `googleapis` package and a single
OAuth2 flow.

---

## Integrations

| Tool | Status | How it works |
| ---- | ------ | ------------ |
| Apple Notes | Active | Read/write via `osascript` (Bash tool). Four scripts in `scripts/`. Used by `daily-digest` for digest delivery and state notes. |
| Apple Mail | Active | Read-only via `osascript` (Bash tool). Three scripts in `scripts/` (scan, read, trash). Used by `scan-email` to extract job alerts and trash processed messages. |
| Apple Calendar | Active | Read-only via `osascript` (Bash tool). Used by `interview-prep` to look up scheduled interviews and extract attendee/subject context. |
| Gmail | Active | `scripts/gmail.js` — Desktop-app OAuth2 flow via `googleapis`. Commands: `auth`, `profile`, `search`, `create-draft`, `trash`. Used by `follow-up` to draft follow-up messages. Credentials in `credentials/` (gitignored). Testing-mode tokens expire every 7 days. |
| Web search (job boards) | Active | WebSearch + WebFetch for role discovery and URL verification. Built into Claude Code. |
| TheirStack API | Active | REST API for ATS-sourced job postings. Used by `daily-digest` when a key is configured. |

---

## Planned Connectors

| Category | Future Options |
| -------- | -------------- |
| Application tracking | Notion, Airtable, Google Sheets |
| Outreach | LinkedIn (via browser automation) |
| Resume storage | Google Drive, Dropbox |

---

## External Skill Dependencies

None. All skills are self-contained within this plugin.
