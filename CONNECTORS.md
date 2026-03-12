# Connectors

## Required: Control your Mac (osascript)

**MCP tool**: `mcp__Control_your_Mac__osascript`
**Used by**: `skills/daily-digest/SKILL.md`
**Purpose**: Runs AppleScript on the Mac host to read and write Apple Notes natively.
Without this, the digest falls back to HTML output only (`output/digest-{date}.html`).

**Install**: Search "Control your Mac" in the Claude plugins marketplace or MCP registry.
Once installed, it is available automatically — no additional configuration required.

---

## Integrations

| Tool | Status | How it works |
|------|--------|-------------|
| Apple Notes | ✅ Active | Read/write via osascript. Four scripts in `scripts/`. Used by `daily-digest` for digest delivery and state notes. Requires "Control your Mac" MCP. |
| Web search (job boards) | ✅ Active | WebSearch + WebFetch for role discovery and URL verification. Built into Cowork. |

---

## Planned Connectors

| Category | Future Options |
|----------|----------------|
| Application tracking | Notion, Airtable, Google Sheets |
| Outreach | LinkedIn (via browser automation), Gmail |
| Resume storage | Google Drive, Dropbox |

---

## External Skill Dependencies

None currently. All skills are self-contained within this plugin.
