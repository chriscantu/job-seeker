# Adapter: Apple Calendar (v1)

**System**: Apple Calendar (macOS)
**Access method**: AppleScript via osascript
**Auth required**: None — local app, iCloud sync optional
**Direction**: Read-only (event search)
**Status**: Active (v0.1)

---

## How It Works

One operation backed by a standalone AppleScript in `scripts/`:

**Search** — Called by `interview-prep` to find upcoming interview events.
Searches event titles and descriptions for keyword matches within a
configurable lookahead window. Returns JSON to stdout.
Calls `scripts/apple_calendar_search.applescript`.

---

## Configuration (from `integrations/config/calendar-config.md`)

```
Provider: apple-calendar
Lookahead Days: 7
Interview Keywords: interview, screen, phone screen, onsite, hiring manager, recruiter, technical, panel, culture fit, final round
```

`Provider` — `apple-calendar` or `google-calendar`.
`Lookahead Days` — how many days ahead to search for events.
`Interview Keywords` — comma-separated terms to match in event titles and descriptions.

---

## Invocation Pattern (from Bash tool)

Skills call the script directly via the Bash tool in Claude Code on macOS.

**Search** (upcoming interviews):
```bash
osascript {plugin_root}/scripts/apple_calendar_search.applescript "{keywords}" "{days_ahead}"
```

Arguments:
- `keywords` — comma-separated keyword list from calendar config
- `days_ahead` — Lookahead Days value from calendar config

---

## Return Value Mapping

### Search

| Outcome | Script returns | Skill action |
|---------|---------------|--------------|
| Events found | JSON array of event objects | Parse and present to user |
| No matching events | `NO_EVENTS_FOUND` | Tell user, fall back to manual input |
| Calendar unavailable | `error: {message}` | Show error, fall back to manual input |

### Event JSON Shape

```json
{
  "title": "Technical Screen — Weave",
  "datetime": "2026-04-14T14:00:00",
  "end_datetime": "2026-04-14T15:00:00",
  "description": "Meet with Sarah Chen, VP Eng. Focus: system design, CI/CD",
  "calendar_name": "Work"
}
```

---

## Google Calendar Alternative

When `Provider` is set to `google-calendar`, the skill uses the `gcal_list_events`
MCP tool instead of the AppleScript. The skill filters results client-side against
the same keyword list and normalizes to the same event shape.

---

## Error Handling

Errors are **non-blocking** — the skill falls back to manual input:

- Calendar errors are shown to the user with the exact message, then the skill
  continues with manual company/round selection.
- Calendar integration is a convenience, not a gate.
