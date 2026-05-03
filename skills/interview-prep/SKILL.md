---
name: interview-prep
description: >
  Behavioral and technical interview preparation with STAR story mapping.
  Calendar-first: checks for upcoming interviews, then generates a study
  guide with sections ordered by round type. Supports intelligent merge
  across multiple runs.
  Triggers: "prep me for an interview", "interview prep", "practice interview
  questions", "prep me", "interview questions"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Interview Prep

Prepares the candidate for behavioral and technical interviews by mapping their
experience to likely questions using the STAR framework. Proactively checks
the calendar for upcoming interviews and tailors content to the round type.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read these additional files in parallel:
- `references/resume.md` — canonical markdown resume; detailed accomplishments for STAR stories
- `references/voice-guide.md` — tone calibration for all written output.
  If missing, proceed with default voice calibration from `PRINCIPLES.md`.

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
- `Provider` — which backend to use. Must be `apple-calendar` or
  `google-calendar`. If unrecognized, show error: "Unknown calendar
  provider '{value}'. Supported: apple-calendar, google-calendar."
- `Lookahead Days` — search window (default 7). Must be a positive
  integer. If blank or invalid, use default of 7 and warn the user.
- `Interview Keywords` — comma-separated match terms. If blank, use
  the default keyword list from `calendar-config.md.example` and warn
  the user.

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

### Normalized Event Shape

Both backends produce the same event structure:

```json
{
  "title": "Technical Screen — Weave",
  "datetime": "2026-04-14T14:00:00",
  "end_datetime": "2026-04-14T15:00:00",
  "description": "Meet with Sarah Chen, VP Eng. Focus: system design, CI/CD",
  "calendar_name": "Work"
}
```

Fields:
- `title` — event summary
- `datetime` — start time, local system time, no timezone offset
- `end_datetime` — end time, same format
- `description` — event notes/body, may be empty string
- `calendar_name` — which calendar the event is from

The Apple Calendar backend returns this shape directly from the AppleScript.
The Google Calendar backend must map `gcal_list_events` fields to this shape
and filter by keywords client-side.

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
  - Otherwise: read the full brief for use in Phase 4.

### Existing Interview Prep (for merge)

Check if `output/{company-slug}/interview-prep.md` exists.

- **If exists**: Read the file. Parse frontmatter for `rounds_prepped`.
  This file will be used as the merge base in Phase 5.
  Tell the user: "Found existing prep for {Company} covering
  {round_types}. I'll merge new content for {new_round_type}."
- **If not exists**: First run. Full generation, no merge needed.

### Story Bank

Check if `output/story-bank.md` exists.

- **If exists**: Read the full file. Parse each `## {Story Title}` section and extract:
  - The story title (from the `##` heading)
  - Tags (from `**Tags:**` line — strip brackets, split on `] [` to get a list).
    If a story has no `**Tags:**` line, omit it from `bankByTag` but still include
    it in `bankByTitle` so it can be surfaced manually.
  - Use count (length of `**used_for:**` array; treat missing or malformed `**used_for:**`
    as empty `[]`)

  Build two lookup structures for use in Phase 4, Section 3:
  - `bankByTag`: map of `tag → [story titles]`, ordered within each list by descending
    use count (length of `used_for` array), then most recent use date descending.
    Example: `"ci-cd" → ["CI/CD Transformation at Procore", "Platform Adoption at Babylon"]`
  - `bankByTitle`: map of `title → full story text` (for surfacing the story body)

  Then show the user:

  > "Story bank has {N} stories (most used: {top story title}, used {N} times).
  > Want to audit framing before we map to this round? (yes / skip)"

  - If user says **yes**: display the full story bank inline and wait for feedback before continuing to Phase 4.
  - If user says **skip** or gives no response within one exchange: continue.

- **If not exists**: Set `bankByTag = {}` and `bankByTitle = {}`. No preflight prompt — the bank is empty.

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

Using the `bankByTag` and `bankByTitle` maps built in Phase 3, generate 6-8 stories
for this session. The goal is to **surface existing stories first** and only generate
new ones for themes not yet covered.

**Required theme coverage** (select based on round type):

| Round type | Required themes (in priority order) |
|------------|--------------------------------------|
| `behavioral` | team-scaling, conflict-resolution, delivery-transformation, cross-functional-influence, failure-learning, org-design |
| `technical` | ci-cd, platform-modernization, dx, technical-strategy, architecture |
| `hiring-manager` | team-scaling, cross-functional-influence, org-design, strategic-alignment |
| `culture-fit` | values-alignment, team-building, cross-functional-influence, failure-learning |
| `executive-panel` | team-scaling, delivery-transformation, technical-strategy, org-change |
| `recruiter-screen` | team-scaling, delivery-transformation, cross-functional-influence |
| `unknown` | team-scaling, delivery-transformation, cross-functional-influence, technical-strategy |

Initialize `newStories` as an empty list and `surfacedTitles` as an empty set at the
start of this section.

**For each required theme:**

1. Look up the theme in `bankByTag`. Take the first title from the list that is NOT
   already in `surfacedTitles` (prevents a multi-tagged story from surfacing twice).
2. **If a match exists:** Look up the story body in `bankByTitle`. Add the title to
   `surfacedTitles`. Output the full story using the format below, marking it
   **[existing]**. Add a one-line framing note specific to this company and round type.
3. **If no match:** Generate a new story from `config/candidate.md` accomplishments
   and `references/resume.md`. Mark it **[new]**. Use the bank format (with Reflection
   and Tags — see below). Add the title to `surfacedTitles`. Append the story as
   `{title, situation, task, action, result, reflection, tags}` to `newStories` for
   write-back in Phase 5.5.

Aim for 6-8 stories total. If existing stories cover all required themes, surface the
best 6-8 by relevance: highest use count first, then most recent use (for canonical
entries parse the YYYY-MM-DD after the em-dash; for bare-slug entries extract the
trailing `YYYY-MM-DD` token after the last hyphen pair), then highest tag overlap with
the round type. Do not generate new stories just to hit the count if the bank already
covers the themes.

**Story format** (for both existing and new). Note: the `_{Source: ...}_` line below
is **display only** — omit it when writing to the story bank in Phase 5.5.

```markdown
### {Story Title}
**Situation:** {1-2 sentences — company, problem, stakes}
**Task:** {Your specific responsibility}
**Action:** {What you did — concrete methods, decisions, leadership moves}
**Result:** {Quantified outcome}
**Reflection:** {What this signals about your leadership / what you'd do differently}
**Tags:** [{theme1}] [{theme2}] [{theme3}]
_{Source: existing | new — {one-line framing note for this round/company}}_
```

**For new stories**, include a **Reflection** that answers "what does this story signal
about my leadership at VP level?" — not just "what went well." This is what separates
VP-level storytelling from manager-level. Example: "This signals I prioritize system
reliability over feature velocity when there's a conflict — and that I can make that
call without needing executive air cover."

### Section 4: Behavioral Questions

10-12 likely behavioral questions for Sr Dir / VP level interviews.
Each question includes:
- The question text
- 1-2 recommended STAR stories by title (from Section 3)
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
from `references/resume.md`. Topics:
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

The remaining three sections appear after the two leads, preserving their
relative order from the default sequence (2, 3, 4, 5, 6) with the two
lead sections removed. Example: for a `technical` round, the leads are
Technical Strategy Qs (6) and STAR Stories (3), so the remaining order
is Departure Framing (2), Behavioral Qs (4), Company-Specific Qs (5).

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

## Phase 5.5 — Story Bank Write-Back

### Append new stories

For each story in `newStories` (tracked in Phase 4 Section 3):

1. Check whether `output/story-bank.md` already contains a `## {Story Title}` heading
   with that exact title. If it does, skip — do not duplicate.
2. If no duplicate: append the story to `output/story-bank.md` in this format:

```markdown
## {Story Title}
**Situation:** {text}
**Task:** {text}
**Action:** {text}
**Result:** {text}
**Reflection:** {text}
**Tags:** [{theme1}] [{theme2}]
**used_for:** ["{Company} — {YYYY-MM-DD}"]
```

If `output/story-bank.md` does not exist, create it with this header first:

```markdown
# STAR+R Story Bank

Stories accumulate across sessions. Each story is tagged and tracked for reuse.
```

### Update used_for on existing stories

For each **existing** story that was surfaced in Section 3 (i.e., marked `[existing]`):

1. Find the story in `output/story-bank.md` by its `## {Story Title}` heading
2. Find its `**used_for:**` line
3. Parse the existing `used_for` value. Entries may be in two formats — accept both:
   - Quoted em-dash: `["Acme — 2026-01-10"]` (canonical format)
   - Bare slug: `[snyk-2026-04-14]` (legacy format written by evaluate)
   To check whether the current session is already recorded, **normalize** each existing
   entry before comparing: lowercase the company name, replace spaces with hyphens,
   strip the em-dash separator. This produces a `{slug}-{YYYY-MM-DD}` token for both
   formats (e.g., `acme-2026-01-10` from either `"Acme — 2026-01-10"` or
   `acme-2026-01-10`). Compare the normalized current company+date against normalized
   existing entries. If no match, append a new entry in canonical quoted em-dash format.
   - Empty: `**used_for:** []` → `**used_for:** ["{Company} — {YYYY-MM-DD}"]`
   - One legacy entry: `**used_for:** [snyk-2026-04-14]` → `**used_for:** [snyk-2026-04-14, "{Company} — {YYYY-MM-DD}"]`
   - One canonical entry: `**used_for:** ["Acme — 2026-01-10"]` → `**used_for:** ["Acme — 2026-01-10", "{Company} — {YYYY-MM-DD}"]`
   If `**used_for:**` is missing or unparseable, treat it as `[]` and rewrite in canonical form.
4. Write the updated file

### Show bank summary and flag core stories

After write-back, count `used_for` entries per story across the full bank.

After the Phase 5 summary has been shown, post a follow-up message:

> **Story bank:** {total} stories total — {N} used this session ({existing_count} existing, {new_count} new).
> {if any story has 3+ entries in used_for}: Core stories (used 3+ times — worth memorizing):
> {list of core story titles}

If no story has 3+ uses, omit the core stories line.

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| No calendar config | Prompt user to set up or skip — never silent |
| Calendar config has invalid/missing fields | Warn user, fall back to defaults (7 days, default keywords) or show error for unrecognized provider |
| Calendar query returns no events | Tell user, fall back to manual input |
| Calendar query errors | Show error message, fall back to manual input |
| No company research brief | Prompt: run /company-research or proceed with limited context |
| Stale research brief (>7 days) | Flag staleness, ask user preference |
| No `Departure Context` in config | Replace section with setup instruction |
| Company not in active applications | Accept any company name — pipeline is not a gate |
| Existing interview-prep.md | Read and merge — never silently overwrite |
| `output/{company-slug}/` doesn't exist | Create the directory before writing |
| `references/voice-guide.md` missing | Proceed with default voice calibration from PRINCIPLES.md |
