# Interview Prep Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interview-prep skill — a calendar-first, intelligent-merge study guide generator that produces STAR stories, behavioral questions, company-specific questions, and departure framing tailored to the upcoming interview round.

**Architecture:** Skill instructions in `skills/interview-prep/SKILL.md` orchestrate the flow. Calendar discovery uses a standalone AppleScript (`scripts/apple_calendar_search.applescript`) for Apple Calendar or Google Calendar MCP tools. Output is a single markdown file per company in `output/{company-slug}/interview-prep.md` that grows via semantic merge across multiple runs.

**Tech Stack:** AppleScript (Calendar.app), Google Calendar MCP, markdown skill instructions, bun/node for config validation.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `config/candidate.md` | Add `Departure Context` field |
| Modify | `config/candidate.md.example` | Add `Departure Context` field to template |
| Create | `scripts/apple_calendar_search.applescript` | Query Calendar.app for events matching keywords in a date range |
| Create | `integrations/adapters/apple-calendar.md` | Adapter doc for Apple Calendar integration |
| Create | `integrations/config/calendar-config.md.example` | Example calendar config template |
| Modify | `skills/_shared/frontmatter.md` | Add interview-prep type-specific fields |
| Modify | `skills/interview-prep/SKILL.md` | Full skill instructions (replace stub) |
| Modify | `scripts/validate-config.js` | Add optional `Departure Context` field awareness |

---

### Task 1: Add `Departure Context` to candidate config

**Files:**
- Modify: `config/candidate.md`
- Modify: `config/candidate.md.example`

- [ ] **Step 1: Add field to `config/candidate.md`**

In `config/candidate.md`, add a new row to the profile table after the `Email` row:

```markdown
| Departure Context | Let go from Procore due to restructuring (2026-04-06). Position eliminated as part of org-wide reduction. |
```

- [ ] **Step 2: Add field to `config/candidate.md.example`**

In `config/candidate.md.example`, add a new row to the profile table after the `Email` row:

```markdown
| Departure Context | Brief context about why you left or are leaving your current role. Used by interview-prep to generate departure framing. Leave blank if not applicable. |
```

- [ ] **Step 3: Run config validation**

Run: `bun scripts/validate-config.js`
Expected: `✓ Config valid` — `Departure Context` is optional, so validation should still pass. Confirm no regressions.

- [ ] **Step 4: Commit**

```fish
git add config/candidate.md config/candidate.md.example
git commit -m "feat(config): add Departure Context field to candidate profile (#15)"
```

---

### Task 2: Create Apple Calendar AppleScript

**Files:**
- Create: `scripts/apple_calendar_search.applescript`

- [ ] **Step 1: Write the AppleScript**

Create `scripts/apple_calendar_search.applescript`:

```applescript
-- apple_calendar_search.applescript
-- Searches Calendar.app for events matching keywords within a date range.
-- Returns JSON-formatted results to stdout.
--
-- Arguments (positional, space-separated, each quoted):
--   1. keywords    — comma-separated list of keywords to match (case-insensitive)
--   2. days_ahead  — number of days from now to search (e.g. "7")
--
-- Returns (stdout):
--   JSON array of matching events, each with: title, datetime, end_datetime,
--   description, calendar_name
--   "NO_EVENTS_FOUND"   — no events matched
--   "error: {message}"  — something went wrong
--
-- Usage:
--   osascript apple_calendar_search.applescript "interview,screen,technical,hiring manager,recruiter,panel,culture fit,final round,onsite,phone screen" "7"

on run argv
    if (count of argv) < 2 then
        return "error: Expected 2 arguments (keywords, days_ahead) but got " & (count of argv)
    end if

    set keywordString to item 1 of argv
    set daysAhead to (item 2 of argv) as integer

    -- Parse comma-separated keywords into a list
    set AppleScript's text item delimiters to ","
    set keywordList to text items of keywordString
    set AppleScript's text item delimiters to ""

    -- Trim whitespace from each keyword
    set trimmedKeywords to {}
    repeat with kw in keywordList
        set end of trimmedKeywords to my trim(kw)
    end repeat

    set startDate to current date
    set endDate to startDate + (daysAhead * days)

    set matchedEvents to {}

    tell application "Calendar"
        try
            repeat with cal in calendars
                set calName to name of cal
                set evts to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
                repeat with evt in evts
                    set evtTitle to summary of evt
                    set evtDescription to ""
                    try
                        set evtDescription to description of evt
                    end try
                    if evtDescription is missing value then set evtDescription to ""

                    set searchText to my toLower(evtTitle & " " & evtDescription)

                    repeat with kw in trimmedKeywords
                        if searchText contains my toLower(kw) then
                            set evtStart to start date of evt
                            set evtEnd to end date of evt
                            set evtJSON to my buildJSON(evtTitle, evtStart, evtEnd, evtDescription, calName)
                            set end of matchedEvents to evtJSON
                            exit repeat
                        end if
                    end repeat
                end repeat
            end repeat

            if (count of matchedEvents) is 0 then
                return "NO_EVENTS_FOUND"
            end if

            -- Build JSON array
            set jsonArray to "["
            repeat with i from 1 to count of matchedEvents
                set jsonArray to jsonArray & item i of matchedEvents
                if i < (count of matchedEvents) then
                    set jsonArray to jsonArray & ","
                end if
            end repeat
            set jsonArray to jsonArray & "]"
            return jsonArray

        on error errMsg
            return "error: Calendar search failed — " & errMsg
        end try
    end tell
end run

on buildJSON(evtTitle, evtStart, evtEnd, evtDescription, calName)
    set isoStart to my toISO(evtStart)
    set isoEnd to my toISO(evtEnd)
    set json to "{"
    set json to json & "\"title\":" & my jsonString(evtTitle) & ","
    set json to json & "\"datetime\":\"" & isoStart & "\","
    set json to json & "\"end_datetime\":\"" & isoEnd & "\","
    set json to json & "\"description\":" & my jsonString(evtDescription) & ","
    set json to json & "\"calendar_name\":" & my jsonString(calName)
    set json to json & "}"
    return json
end buildJSON

on jsonString(str)
    -- Escape backslashes, quotes, and newlines for JSON
    set str to my replaceText(str, "\\", "\\\\")
    set str to my replaceText(str, "\"", "\\\"")
    set str to my replaceText(str, return, "\\n")
    set str to my replaceText(str, linefeed, "\\n")
    set str to my replaceText(str, (ASCII character 9), "\\t")
    return "\"" & str & "\""
end jsonString

on replaceText(theText, searchString, replacementString)
    set AppleScript's text item delimiters to searchString
    set theItems to text items of theText
    set AppleScript's text item delimiters to replacementString
    set theText to theItems as text
    set AppleScript's text item delimiters to ""
    return theText
end replaceText

on toLower(str)
    set lowStr to do shell script "echo " & quoted form of str & " | tr '[:upper:]' '[:lower:]'"
    return lowStr
end toLower

on toISO(d)
    set y to year of d as string
    set m to my padZero(month of d as integer)
    set dy to my padZero(day of d)
    set h to my padZero(hours of d)
    set mn to my padZero(minutes of d)
    return y & "-" & m & "-" & dy & "T" & h & ":" & mn & ":00"
end toISO

on padZero(n)
    if n < 10 then
        return "0" & (n as string)
    else
        return n as string
    end if
end padZero

on trim(str)
    repeat while str begins with " "
        set str to text 2 thru -1 of str
    end repeat
    repeat while str ends with " "
        set str to text 1 thru -2 of str
    end repeat
    return str
end trim
```

- [ ] **Step 2: Test the script manually**

Run: `osascript scripts/apple_calendar_search.applescript "interview,screen,technical,hiring manager" "7"`

Expected: Either a JSON array of matching events, or `NO_EVENTS_FOUND` if no interviews are scheduled. Verify:
- No `error:` prefix in the output
- If events are returned, JSON is parseable (pipe through `python3 -m json.tool` to verify)
- Date range is correct (events within the next 7 days only)

- [ ] **Step 3: Commit**

```fish
git add scripts/apple_calendar_search.applescript
git commit -m "feat(calendar): add Apple Calendar search AppleScript (#15)"
```

---

### Task 3: Create calendar adapter doc and config template

**Files:**
- Create: `integrations/adapters/apple-calendar.md`
- Create: `integrations/config/calendar-config.md.example`

- [ ] **Step 1: Write the adapter doc**

Create `integrations/adapters/apple-calendar.md`:

```markdown
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
```

- [ ] **Step 2: Write the config example**

Create `integrations/config/calendar-config.md.example`:

```markdown
# Calendar Configuration

Copy this file to `integrations/config/calendar-config.md` to enable
calendar integration for interview-prep.

| Field | Value |
|-------|-------|
| Provider | apple-calendar |
| Lookahead Days | 7 |
| Interview Keywords | interview, screen, phone screen, onsite, hiring manager, recruiter, technical, panel, culture fit, final round |

## Provider Options

- `apple-calendar` — queries Calendar.app via AppleScript (macOS only)
- `google-calendar` — uses Google Calendar MCP tools (requires MCP setup)
```

- [ ] **Step 3: Commit**

```fish
git add integrations/adapters/apple-calendar.md integrations/config/calendar-config.md.example
git commit -m "docs(calendar): add Apple Calendar adapter and config template (#15)"
```

---

### Task 4: Update frontmatter schema for interview-prep

**Files:**
- Modify: `skills/_shared/frontmatter.md`

- [ ] **Step 1: Add interview-prep type-specific fields**

In `skills/_shared/frontmatter.md`, after the `### cover-letter` section, add:

```markdown
### interview-prep

| Field | Type | Description |
|-------|------|-------------|
| `last_updated` | date | Date of most recent run (YYYY-MM-DD) |
| `rounds_prepped` | list | Array of objects: `{type, date, context?}` for each round prepped |
```

- [ ] **Step 2: Commit**

```fish
git add skills/_shared/frontmatter.md
git commit -m "docs(frontmatter): add interview-prep schema fields (#15)"
```

---

### Task 5: Write the full SKILL.md

This is the core task — replacing the stub with the complete skill instructions.

**Files:**
- Modify: `skills/interview-prep/SKILL.md`

- [ ] **Step 1: Write the complete skill file**

Replace the entire contents of `skills/interview-prep/SKILL.md` with:

```markdown
---
name: interview-prep
description: >
  Behavioral and technical interview preparation with STAR story mapping.
  Calendar-first: checks for upcoming interviews, then generates a study
  guide with sections ordered by round type. Supports intelligent merge
  across multiple runs.
  Triggers: "prep me for an interview", "interview prep", "practice interview
  questions", "prep me", "interview questions"
---

# Interview Prep

Prepares the candidate for behavioral and technical interviews by mapping their
experience to likely questions using the STAR framework. Proactively checks
the calendar for upcoming interviews and tailors content to the round type.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read these additional files in parallel:
- `references/resume.pdf` — detailed accomplishments for STAR stories
- `references/voice-guide.md` — tone calibration for all written output

---

## Phase 1 — Calendar Discovery

Check if `integrations/config/calendar-config.md` exists.

**If file does not exist**, prompt the user:

> "I can check your calendar for upcoming interviews to focus your prep.
> Would you like to set up calendar integration (Apple Calendar or Google
> Calendar), or skip and tell me which company/round to prep for?"

- If the user chooses to set up: ask which provider (`apple-calendar` or
  `google-calendar`), then create `integrations/config/calendar-config.md`
  using the template from `integrations/config/calendar-config.md.example`
  with their chosen provider. Continue with the calendar query below.
- If the user chooses to skip: go directly to Phase 2.

**If file exists**, read it and extract:
- `Provider` — which backend to use
- `Lookahead Days` — search window (default 7)
- `Interview Keywords` — comma-separated match terms

### Apple Calendar Backend

```bash
osascript scripts/apple_calendar_search.applescript "{keywords}" "{lookahead_days}"
```

Where `{keywords}` is the `Interview Keywords` value from config and
`{lookahead_days}` is the `Lookahead Days` value.

Parse the output:
- JSON array → list of events. Proceed to company matching.
- `NO_EVENTS_FOUND` → tell user: "No upcoming interviews found in the next
  {N} days. Want me to prep for a specific company and round?"
- `error: ...` → show the error, fall back to manual input.

### Google Calendar Backend

Use the `gcal_list_events` MCP tool to fetch events for the next N days.
Filter results client-side: for each event, check if the title or description
contains any of the `Interview Keywords` (case-insensitive). Build the same
event list as the Apple Calendar backend.

### Company Matching

Read `skills/_shared/state-io.md` and execute — read `applications`.

For each discovered calendar event:
1. Check if any company name from active applications appears in the event
   title or description (case-insensitive substring match)
2. If matched, associate the event with that company and its pipeline data
3. If no match, keep the event but mark company as "unmatched" — the user
   will confirm in Phase 2

---

## Phase 2 — User Direction

**If calendar events were found**, present them:

> "Found {N} upcoming interview(s):
> 1. **{Company}** — {Event Title}, {Day} {Date} at {Time}
> 2. **{Company}** — {Event Title}, {Day} {Date} at {Time}
>
> Which would you like to prep for? Or provide a company/round manually."

**If no calendar events** (or calendar was skipped), ask:

> "Which company and role would you like to prep for? If you know the
> interview round type (behavioral, technical, hiring manager, etc.),
> include that too."

Capture from the user:
- **Company** (required)
- **Round type** (inferred from calendar event title/description or
  user-provided). Recognized types:
  - `behavioral`
  - `technical` (also matches `system-design`)
  - `hiring-manager`
  - `culture-fit` (also matches `values`)
  - `executive-panel` (also matches `vp panel`, `leadership`)
  - `recruiter-screen` (also matches `recruiter`, `phone screen`)
  - `unknown` — default if round type is unclear
- **Additional context** (optional — recruiter notes, specific focus areas,
  calendar event description text)

---

## Phase 3 — Research Load

Derive `{company-slug}` from the company name: lowercase, spaces to hyphens,
special characters removed.

### Company Research Brief

Read `output/{company-slug}/company-research.md`.

- **If missing**: Prompt — "No research brief found for {Company}. Want to
  run /company-research first, or proceed with limited company context?"
  - If user says run research: stop and tell user to run `/company-research`
    first, then re-run `/interview-prep`.
  - If user says proceed: continue with limited context. Company-Specific
    Questions section will be thinner.
- **If exists**: Check frontmatter `generated` date.
  - If older than 7 days: flag — "Research brief for {Company} is {N} days
    old. Want to re-run /company-research, or proceed with what we have?"
  - Otherwise: read the full brief for use in Phases 4.

### Existing Interview Prep (for merge)

Check if `output/{company-slug}/interview-prep.md` exists.

- **If exists**: Read the file. Parse frontmatter for `rounds_prepped`.
  This file will be used as the merge base in Phase 5.
  Tell the user: "Found existing prep for {Company} covering
  {round_types}. I'll merge new content for {new_round_type}."
- **If not exists**: First run. Full generation, no merge needed.

---

## Phase 4 — Generate Study Guide

Generate 6 sections. When merging with an existing file, follow the merge
rules in Phase 5 — generate only what's new or needs updating.

### Section 1: Company Context Snapshot

2-3 sentences from the research brief: mission, stage, and the specific
engineering challenges relevant to this role. If no research brief exists,
use whatever company context is available from the job posting or user input.

This section always appears first regardless of round type.

### Section 2: Departure Framing

Read `Departure Context` from `config/candidate.md`.

**If the field is present and non-empty**, generate:

- **The Response** — a 2-3 sentence rehearsable answer to "Why did you
  leave?" or "Why are you leaving?" Must be:
  - Honest and forward-looking
  - Consistent (same core message regardless of who asks)
  - In the candidate's voice per `references/voice-guide.md`
- **The Pivot** — one follow-up sentence redirecting to what excites you
  about *this specific company*. Use the research brief for specifics.
- **Don't Say** — 3-5 bullet list of things to avoid: bitterness about
  former employer, over-explaining the circumstances, badmouthing
  leadership, appearing desperate, apologizing for being let go.

**If the field is absent or empty**, replace the section with:

> "No departure context configured. Add `Departure Context` to
> `config/candidate.md` to generate this section."

### Section 3: STAR Story Bank

Generate 6-8 stories using `config/candidate.md` accomplishments and
`references/resume.pdf` for detailed context. Each story must follow
this format:

```markdown
### {Label}

**Situation:** {1-2 sentences of context — the company, the problem, the stakes}

**Task:** {Your specific responsibility — what were you asked/expected to do}

**Action:** {What you actually did — concrete methods, decisions, leadership moves}

**Result:** {Quantified outcome — numbers, percentages, dollar amounts, timeline improvements}

**Best for:** {Comma-separated list of question types this story answers, e.g., "scaling teams, delivery transformation, cross-functional influence"}
```

Story selection criteria:
- Cover the breadth of accomplishments in `config/candidate.md`
- Each story should map to 2-3 different question types
- Prefer stories with strong quantified results
- Include at least one story about: team scaling, delivery/velocity
  improvement, cross-functional collaboration, technical strategy,
  and navigating organizational challenge

### Section 4: Behavioral Questions

10-12 likely behavioral questions for Sr Dir / VP level interviews.
Each question includes:
- The question text
- 1-2 recommended STAR stories by label (from Section 3)
- A one-line note on what angle to emphasize

Coverage areas (at least one question per area):
- Leadership philosophy and style
- Conflict resolution and difficult conversations
- Cross-functional influence and stakeholder management
- Team scaling and organizational design
- Failure, learning, and course correction
- Prioritization and resource allocation

### Section 5: Company-Specific Questions

5-8 questions derived from the company research brief. Each question:
- References something specific about this company (domain, challenges,
  recent news, engineering culture signals, growth stage)
- Includes a brief note on how to angle the answer using the candidate's
  experience

If no research brief exists, generate 3-4 generic questions about the
company's domain and note the limitation.

### Section 6: Technical Strategy Questions

5-8 questions on technical leadership topics. Each question includes a
2-3 sentence suggested framing grounded in the candidate's real experience
from `references/resume.pdf`. Topics:
- Platform modernization and migration strategy
- CI/CD at scale (the candidate's strongest area)
- AI/ML adoption and tooling strategy
- Architecture decisions and build vs buy
- Developer experience and productivity
- Observability and operational excellence

### Round-Type Section Ordering

Company Context Snapshot always appears first. The remaining 5 sections
are ordered based on the round type — the two most relevant sections
appear immediately after the snapshot:

| Round type | Leads with (after Company Snapshot) |
|------------|-------------------------------------|
| `behavioral` | Departure Framing, Behavioral Qs |
| `technical` | Technical Strategy Qs, STAR Stories |
| `hiring-manager` | Company-Specific Qs, Departure Framing |
| `culture-fit` | Company-Specific Qs, Departure Framing |
| `executive-panel` | Departure Framing, STAR Stories |
| `recruiter-screen` | Departure Framing, STAR Stories |
| `unknown` | Departure Framing, STAR Stories |

Remaining sections follow in their default order (2, 3, 4, 5, 6) with
the two lead sections removed from their default positions.

---

## Phase 5 — Write Output

Write to `output/{company-slug}/interview-prep.md`.

If `output/{company-slug}/` does not exist, create it.

### Frontmatter

Read `skills/_shared/frontmatter.md` for the base schema contract.

```yaml
---
skill: interview-prep
company: {Company Name}
slug: {company-slug}
role: {Role title}
url: "{Job posting URL if known}"
generated: {YYYY-MM-DD of first run}
last_updated: {YYYY-MM-DD of this run}
rounds_prepped:
  - type: {round-type}
    date: {YYYY-MM-DD}
    context: "{User-provided context, if any}"
---
```

### First Run (no existing file)

Write the full study guide with all 6 sections ordered per the round type.
Set `generated` and `last_updated` to today. Create `rounds_prepped` with
one entry for this round.

### Subsequent Runs (existing file — intelligent merge)

Read the existing file. Apply these merge rules:

| Section | Merge behavior |
|---------|---------------|
| Company Snapshot | **Replace** — always pull latest from research brief |
| Departure Framing | **Keep** — only regenerate if `Departure Context` in `config/candidate.md` has changed vs. what's in the file |
| STAR Story Bank | **Keep** existing stories. Add new stories only if the round type calls for story types not yet covered by existing labels. |
| Behavioral Qs | **Keep** existing questions. Append new questions relevant to the new round type. **Semantic dedup**: skip any new question that is substantially similar to an existing one (LLM judgment — "scaled a team" ≈ "grew an engineering org"). |
| Company-Specific Qs | **Keep** existing. Append if new user context or updated research reveals angles not yet covered. Semantic dedup applies. |
| Technical Strategy Qs | **Keep** existing. Append new questions relevant to the new round type. Semantic dedup applies. |

After merging content:
1. Reorder sections for the latest round type per the ordering table
2. Update frontmatter: set `last_updated` to today, append new entry to `rounds_prepped`
3. Preserve the original `generated` date

### Present Summary

After writing, show the user:

> "Interview prep written to `output/{company-slug}/interview-prep.md`
>
> **Round:** {round_type}
> **Sections:** {count} sections, {total_questions} questions
> **STAR stories:** {count}
> **New this run:** {summary of what was added vs. kept from prior run}
>
> Review the file and let me know if you want to adjust anything."

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| No calendar config | Prompt user to set up or skip — never silent |
| Calendar query returns no events | Tell user, fall back to manual input |
| Calendar query errors | Show error message, fall back to manual input |
| No company research brief | Prompt: run /company-research or proceed with limited context |
| Stale research brief (>7 days) | Flag staleness, ask user preference |
| No `Departure Context` in config | Replace section with setup instruction |
| Company not in active applications | Accept any company name — pipeline is not a gate |
| Existing interview-prep.md | Read and merge — never silently overwrite |
| `output/{company-slug}/` doesn't exist | Create the directory before writing |
```

- [ ] **Step 2: Read the written file to verify completeness**

Read `skills/interview-prep/SKILL.md` end-to-end. Verify:
- All 6 phases are present (0 through 5)
- All 6 sections are defined in Phase 4
- Round-type ordering table is included
- Merge rules are defined in Phase 5
- Error handling table covers all conditions from the spec
- Frontmatter schema matches the spec

- [ ] **Step 3: Commit**

```fish
git add skills/interview-prep/SKILL.md
git commit -m "feat(interview-prep): implement full skill replacing stub (#15)

Calendar-first discovery, STAR story bank, departure framing, round-type
section ordering, and intelligent merge for multi-run refinement."
```

---

### Task 6: Verify end-to-end with config validation

**Files:** None (verification only)

- [ ] **Step 1: Run config validation**

Run: `bun scripts/validate-config.js`
Expected: `✓ Config valid`

- [ ] **Step 2: Verify file structure**

Run: `ls -la scripts/apple_calendar_search.applescript integrations/adapters/apple-calendar.md integrations/config/calendar-config.md.example skills/interview-prep/SKILL.md`

Expected: All four files exist and are non-empty.

- [ ] **Step 3: Verify AppleScript is executable**

Run: `osascript scripts/apple_calendar_search.applescript "interview,screen" "7"`
Expected: Either JSON array or `NO_EVENTS_FOUND`. No `error:` prefix.

- [ ] **Step 4: Verify the skill is discoverable**

Confirm `.claude/commands/interview-prep.md` still points to the correct skill file.
Run: `cat .claude/commands/interview-prep.md`
Expected: `Read and execute skills/interview-prep/SKILL.md for the current session.`

---

### Task 7: Create user's calendar config (optional, if user opts in)

This task is only needed if the user wants to set up their personal calendar
config now. It is not required for the skill to function.

**Files:**
- Create: `integrations/config/calendar-config.md` (from example template)

- [ ] **Step 1: Ask the user**

> "Want to set up your calendar config now? This will create
> `integrations/config/calendar-config.md` with Apple Calendar as the
> default provider. You can change it later."

- [ ] **Step 2: If yes, create the config**

Copy `integrations/config/calendar-config.md.example` to
`integrations/config/calendar-config.md` with `Provider` set to
`apple-calendar` (or `google-calendar` if the user prefers).

Note: This file should be gitignored (personal config). Verify it's
covered by existing gitignore patterns or add an entry.

- [ ] **Step 3: Test calendar integration**

Run: `osascript scripts/apple_calendar_search.applescript "interview,screen,phone screen,onsite,hiring manager,recruiter,technical,panel,culture fit,final round" "7"`

Confirm the output is valid (JSON array or `NO_EVENTS_FOUND`).
