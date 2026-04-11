# Interview Prep Skill — Design Spec

**Issue**: #15
**Date**: 2026-04-11
**Status**: Approved

## Problem

When an interview request arrives, there's no structured prep material ready.
Building a STAR story bank, mapping accomplishments to likely questions, and
researching company-specific angles from scratch each time is slow and risks
showing up underprepared. At VP-level, a fumbled behavioral question can end
a candidacy. Realtor.com is already at Interview (1) stage; Weave could move
to screening any day.

## Approach

**Calendar-first, intelligent merge (Approach D)**: The skill proactively checks
the user's calendar for upcoming interviews, presents what it finds, and asks
the user to confirm or provide additional context. It generates a single study
guide per company that grows smarter over multiple runs — new content is appended
via semantic dedup, and sections reorder based on the upcoming round type.

Rejected alternatives:
- **A (Single-pass overwrite)**: Simple but loses prior prep work when re-run
  for a different round at the same company.
- **B (Cumulative blind append)**: Risks duplicate content and growing file size
  without intelligent filtering.
- **C (Base + round files)**: Clean separation but creates multiple files to
  review, contradicts the user's preference for one complete document.

## Decisions

- **Calendar integration is offered, not silent**: If no calendar config exists,
  the skill prompts the user to set it up or skip. If config exists but no events
  match, it tells the user and falls back to manual input. Calendar is never
  silently bypassed.
- **Two calendar backends**: Apple Calendar (osascript) and Google Calendar
  (gcal_list_events MCP). Configured via `integrations/config/calendar-config.md`.
  Both produce the same normalized event shape.
- **Departure framing is configurable**: A new `departure_context` field in
  `config/candidate.md` provides the raw material. The skill generates the
  rehearsable response, pivot, and "don't say" list from this field. Not
  hardcoded to any specific situation.
- **Semantic dedup for merge**: On subsequent runs, the skill reads the existing
  file and uses LLM judgment to avoid appending substantially similar questions.
  No regex or exact-match — "scaled a team" and "grew an engineering org" are
  recognized as the same question.
- **All sections always present**: Round type changes ordering, never visibility.
  The user scrolls past less relevant sections rather than losing them.
- **No phase caching**: This skill makes no external API calls. All inputs are
  local files. Regeneration is fast and cheap — caching adds complexity for no
  benefit.
- **No state file updates**: Interview prep is not a pipeline event. The skill
  does not write to seen-postings, preferences, or applications.

---

## Skill Phases

### Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read additional files:
- `references/resume.pdf` — detailed accomplishments for STAR stories
- `references/voice-guide.md` — tone calibration for all written output

### Phase 1 — Calendar Discovery

Read `integrations/config/calendar-config.md`.

**If file does not exist:**
> "I can check your calendar for upcoming interviews to focus your prep.
> Would you like to set up calendar integration (Apple Calendar or Google
> Calendar), or skip and tell me which company/round to prep for?"

If the user chooses to set up, create `integrations/config/calendar-config.md`
with their provider choice and default settings. If they choose to skip, go
directly to Phase 2.

**If file exists**, query the configured backend for events in the next N days
(default: 7) matching interview keywords.

#### Calendar Config Schema

File: `integrations/config/calendar-config.md`

```markdown
# Calendar Configuration

| Field | Value |
|-------|-------|
| Provider | apple-calendar |
| Lookahead Days | 7 |
| Interview Keywords | interview, screen, phone screen, onsite, hiring manager, recruiter, technical, panel, culture fit, final round |
```

`Provider` is either `apple-calendar` or `google-calendar`.

#### Apple Calendar Backend

Standalone AppleScript file (`scripts/apple_calendar_search.applescript`)
invoked via `osascript`, following the same pattern as the Apple Notes adapter
(`scripts/apple_notes_*.applescript`). Searches event titles and notes for
keyword matches within the lookahead window. Returns JSON-formatted results
to stdout.

#### Google Calendar Backend

`gcal_list_events` MCP tool with date range filter. Results filtered
client-side against the keyword list.

#### Normalized Event Shape

Both backends produce:

```
- title: "Technical Screen — Weave"
  datetime: 2026-04-14T14:00:00
  description: "Meet with Sarah Chen, VP Eng. Focus: system design, CI/CD"
  source: apple-calendar
```

#### Company Matching

1. Check if any company name from active applications (`output/*-applications.md`)
   appears in the event title or description
2. If no match, present the raw event and ask the user to confirm which company

**If the query returns no matching events:**
> "No upcoming interviews found in the next 7 days. Want me to prep for a
> specific company and round?"

### Phase 2 — User Direction

Present discovered interviews (if any):

> "Found 2 upcoming interviews:
> 1. **Weave** — Technical Screen with VP Eng, Thursday Apr 14 at 2pm
> 2. **Realtor.com** — Hiring Manager Round, Friday Apr 15 at 10am
>
> Which would you like to prep for? Or provide a company/round manually."

Capture from the user:
- **Company** (required)
- **Round type** (inferred from calendar event or user-provided)
- **Additional context** (optional — recruiter notes, specific focus areas,
  anything the user wants to paste in)

Recognized round types: `behavioral`, `technical`, `system-design`,
`hiring-manager`, `culture-fit`, `executive-panel`, `recruiter-screen`.
If the round type doesn't map cleanly, use `unknown` and apply default ordering.

### Phase 3 — Research Load

Read `output/{company-slug}/company-research.md`.

- **If missing**: Prompt user — "No research brief found for {company}. Want
  to run /company-research first, or proceed with limited company context?"
- **If stale** (>7 days per frontmatter `generated` date): Flag it — "Research
  brief is {N} days old. Want to re-run /company-research, or proceed with
  what we have?"

Read existing `output/{company-slug}/interview-prep.md` if it exists (for
intelligent merge in Phase 5).

### Phase 4 — Generate Study Guide

Produce 6 sections, ordered by round-type relevance. Content rules for each
section below.

#### Section 1: Company Context Snapshot

2-3 sentences from the research brief: mission, stage, and the specific
engineering challenges relevant to this role. Not a rehash — just enough to
ground the rest of the prep.

Always appears first regardless of round type.

#### Section 2: Departure Framing

Reads `departure_context` from `config/candidate.md`. Produces:

- A 2-3 sentence rehearsable response — consistent, honest, forward-looking
- One follow-up pivot redirecting to what excites you about *this* company
- A "don't say" list — things to avoid (bitterness, over-explaining, blame)

Voice must match `references/voice-guide.md`. This is how you'd actually say
it in conversation, not how a career coach would script it.

#### Section 3: STAR Story Bank

6-8 stories mapped from `config/candidate.md` accomplishments and
`references/resume.pdf`. Each story:

| Field | Content |
|-------|---------|
| **Label** | Short name for quick reference (e.g., "CI/CD Transformation") |
| **Situation** | 1-2 sentences of context |
| **Task** | Your specific responsibility |
| **Action** | What you did — concrete, with methods |
| **Result** | Quantified outcome |
| **Best for** | Which question types this answers (e.g., "scaling teams, delivery transformation") |

#### Section 4: Behavioral Questions

10-12 likely behavioral questions for Sr Dir / VP level. Each mapped to 1-2
recommended STAR stories by label. Coverage areas: leadership philosophy,
conflict resolution, cross-functional influence, team scaling, failure/learning,
prioritization.

#### Section 5: Company-Specific Questions

5-8 questions derived from the research brief — specific to this company's
domain, challenges, stage, or culture signals. Each includes a brief note on
how to angle the answer using the candidate's experience.

#### Section 6: Technical Strategy Questions

5-8 questions on platform modernization, CI/CD at scale, AI/ML adoption,
architecture decisions, build vs buy. Each includes a 2-3 sentence suggested
framing using the candidate's real experience.

### Round-Type Section Ordering

Company Snapshot always leads. The next two sections are chosen by round type
to put the highest-leverage content near the top. Remaining sections follow
in default order.

| Round type | Leads with (after Company Snapshot) |
|------------|-------------------------------------|
| **Behavioral** | Departure Framing, Behavioral Qs |
| **Technical / System Design** | Technical Strategy Qs, STAR Stories |
| **Hiring Manager** | Company-Specific Qs, Departure Framing |
| **Culture / Values** | Company-Specific Qs, Departure Framing |
| **Executive Panel** | Departure Framing, STAR Stories |
| **Recruiter Screen** | Departure Framing, STAR Stories |
| **Unknown / Default** | Departure Framing, STAR Stories |

### Phase 5 — Write Output

Write to `output/{company-slug}/interview-prep.md`.

#### Frontmatter Schema

```yaml
---
skill: interview-prep
company: Weave
slug: weave
role: Senior Director of Engineering
url: "https://jobs.ashbyhq.com/weave/..."
generated: 2026-04-11
last_updated: 2026-04-14
rounds_prepped:
  - type: recruiter-screen
    date: 2026-04-11
  - type: technical
    date: 2026-04-14
    context: "System design discussion with VP Eng, focus on CI/CD architecture"
---
```

`generated` = first run. `last_updated` = most recent run. `rounds_prepped`
tracks every round processed with preserved user context.

#### Intelligent Merge Rules

**First run** (no existing file): generate everything fresh, write the full file.

**Subsequent runs** (file exists):

| Section | Merge behavior |
|---------|---------------|
| Company Snapshot | Replace — always pull latest from research brief |
| Departure Framing | Keep — only regenerate if `departure_context` has changed |
| STAR Story Bank | Keep existing, add new stories only if round type needs uncovered areas |
| Behavioral Qs | Keep existing, append new questions for the new round (semantic dedup) |
| Company-Specific Qs | Keep existing, append if new context reveals uncovered angles |
| Technical Strategy Qs | Keep existing, append new questions for the new round (semantic dedup) |

After merging, reorder the full file for the latest round type per the ordering
table above. Update frontmatter: bump `last_updated`, append to `rounds_prepped`.

#### Semantic Dedup

Before appending a question, check if a substantially similar question already
exists in that section. This is LLM judgment — not exact string matching.
"Tell me about a time you scaled a team" and "Describe how you've grown an
engineering organization" are the same question and should not both appear.

---

## Config Changes

### `config/candidate.md` — New Field

Add `departure_context` to the candidate profile table:

```markdown
| Departure Context | Let go from Procore due to restructuring (2026-04-06). Position eliminated as part of org-wide reduction. |
```

The skill reads this field to generate the Departure Framing section. If the
field is absent or empty, the section is replaced with a note:
"No departure context configured. Add `Departure Context` to
`config/candidate.md` to generate this section."

### `integrations/config/calendar-config.md` — New File

Created on first run if the user opts in. See Calendar Config Schema above.

### `integrations/adapters/apple-calendar.md` — New File

Adapter doc following the pattern of `integrations/adapters/apple-notes.md`.
Documents the AppleScript file, config schema, and usage instructions.

### `scripts/apple_calendar_search.applescript` — New File

Standalone AppleScript that queries Calendar.app for events matching keywords
within a date range. Returns JSON to stdout. Follows the pattern of existing
`scripts/apple_notes_*.applescript` files.

---

## Output Example

File: `output/weave/interview-prep.md`

```
---
skill: interview-prep
company: Weave
slug: weave
role: Senior Director of Engineering
url: "https://jobs.ashbyhq.com/weave/..."
generated: 2026-04-11
last_updated: 2026-04-11
rounds_prepped:
  - type: technical
    date: 2026-04-11
    context: "System design with VP Eng, CI/CD focus"
---

# Weave — Interview Prep

## Company Context
{2-3 sentences from research brief}

## Technical Strategy Questions
{5-8 questions — leads because round type is "technical"}

## STAR Story Bank
{6-8 stories}

## Company-Specific Questions
{5-8 questions}

## Departure Framing
{Response, pivot, don't-say list}

## Behavioral Questions
{10-12 questions mapped to STAR stories}
```

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| No calendar config | Prompt user to set up or skip (never silent) |
| Calendar query returns no events | Tell user, fall back to manual input |
| No company research brief | Prompt user to run /company-research or proceed with limited context |
| Stale research brief (>7 days) | Flag staleness, ask user preference |
| No `departure_context` in config | Replace Departure Framing section with setup instruction |
| Company not in active applications | Accept any company name — applications tracker is not a gate |
| Existing interview-prep.md | Read and merge — never silently overwrite |
