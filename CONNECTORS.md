# Connectors

## Runtime: Claude Code on macOS

This plugin runs in **Claude Code CLI on macOS**, not Cowork. Claude Code has
direct access to `osascript` via the Bash tool, which is how all native macOS
app integrations work. No MCP servers, no background daemons.

---

## Integrations

| Tool | Status | How it works |
|------|--------|-------------|
| Apple Notes | ✅ Active | Read/write via `osascript` (Bash tool). Four scripts in `scripts/`. Used by `daily-digest` for digest delivery and state notes. |
| Apple Mail | ✅ Active | Read-only via `osascript` (Bash tool). Two scripts in `scripts/`. Used by `scan-email` to extract job alerts from inbox. |
| Web search (job boards) | ✅ Active | WebSearch + WebFetch for role discovery and URL verification. Built into Claude Code. |

---

## Planned Connectors

| Category | Future Options |
|----------|----------------|
| Application tracking | Notion, Airtable, Google Sheets |
| Outreach | LinkedIn (via browser automation), Gmail |
| Resume storage | Google Drive, Dropbox |

---

## External Skill Dependencies

None. All skills are self-contained within this plugin.
