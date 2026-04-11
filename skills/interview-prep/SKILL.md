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

### Normalized Event Shape

Both backends must produce the same event structure:

```
- title: "Technical Screen — Weave"
  datetime: 2026-04-14T14:00:00
  description: "Meet with Sarah Chen, VP Eng. Focus: system design, CI/CD"
  source: apple-calendar
```

Fields: `title` (event summary), `datetime` (ISO start time), `description`
(event notes/body, may be empty), `source` (`apple-calendar` or `google-calendar`).

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
