---
name: why-this-company
description: >
  Generate a compelling "Why did you decide to apply to this company?" response
  tailored to a specific company and role. Triggers: "why this company", "why am I applying",
  "write a why statement", "application response for [company]", or any variation of
  explaining motivation for applying to a specific role. Also use when preparing
  application materials that need a motivation narrative.
---

# Why This Company — Response Generator

Creates an authentic, executive-level response to "Why did you decide to apply
to this company?" by connecting the candidate's real career trajectory and values to
the company's mission, stage, and engineering challenges.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read these additional files:
- `references/resume.md` — canonical markdown resume for detailed accomplishments
- `skills/_shared/anti-slop-tells.md` — structural AI-tell blocklist + cadence guard
  shared across all prose skills; apply it before presenting any draft
- Glob `references/writing-samples/*.md` (skip `README.md`) — the candidate's real
  published prose; study sentence-level texture, not just gist.

## Phase 0a — Load Preferences

Read `skills/_shared/state-io.md` and execute — read `preferences`.

Use interest signals from preferences to inform the response. If no preferences
file exists, proceed without preference context.

## Required Inputs

Ask the user for what you don't already have:
- **Company name** (required)
- **Role title** (required)
- **Job posting URL** (helpful — fetch and read if provided)

## Research Phase

Before writing anything, research the company:

1. **WebSearch** the company to understand:
   - Their mission statement and values
   - Company stage (startup, growth, enterprise)
   - Recent news, funding rounds, product launches
   - Engineering blog posts or tech talks (reveals engineering culture)
   - Glassdoor/Blind reputation signals

2. **Identify genuine connection points** between the candidate's background and the company:
   - Mission alignment — connect to the candidate's previous company domains
     (read from `config/candidate.md` Previous Companies and Core Strengths fields)
   - Engineering challenges that match the candidate's core strengths
   - The candidate's stated goal for their next role (from `config/candidate.md`)
   - Company stage alignment (growth-stage where they can have impact)

3. **Check for weak connections** — if the alignment is thin, flag it honestly.
   "The mission connection here is less direct than your Babylon or Procore experience,
   but the engineering challenges are a strong match because..."

## Writing the Response

Structure the response in three parts:

### 1. The Hook (1-2 sentences)
Connect to the company's mission using a specific, personal thread.
Not generic admiration — a real reason grounded in the candidate's experience.

**Bad:** "I've always been passionate about [industry]."
**Good:** "At Babylon Health, I watched broken delivery keep good software from
reaching the patients who needed it. [Company] is taking on [specific problem],
which is the work I've spent the last few years closest to."

(Note: the old "good" example here used "I know what it takes to build the
engineering platform that makes that possible at scale" — that's a
self-congratulatory anti-pattern and the "at scale" crutch. See
`skills/_shared/anti-slop-tells.md`.)

### 2. The Bridge (2-3 sentences)
Connect the candidate's specific accomplishments to the company's current challenges.
Use numbers. Reference the actual role requirements if you have the posting.

**Template:** "In my current role, I [specific accomplishment with numbers].
[Company] is at the point where [specific challenge from the posting] — close to
what I worked through at [previous company]." (Avoid "that's exactly the kind of
problem I've built my career around solving" — see the cliché list in
`skills/_shared/anti-slop-tells.md`.)

### 3. The Why Now (1-2 sentences)
Explain what makes this company different from staying put. This is where
"shaping engineering culture" and "having real impact" come in — but
grounded in specifics about this company, not generic ambition.

**Template:** "What excites me about [Company] is [specific thing about
their stage/mission/challenge]. At my current company, the culture is already
set. I want to be somewhere I can [specific impact tied to company context]."

## Output Format

Produce two versions:
1. **Short form** (3-5 sentences) — for application text fields and quick responses
2. **Long form** (2-3 paragraphs) — for detailed application narratives or interview prep

## Quality Checks

Before presenting the output:
- Does it sound like the candidate, not a career coach?
- Are there specific numbers from their actual experience?
- Is the mission connection genuine, not manufactured?
- Does it read at an executive level?
- Would the candidate actually say this in conversation?
- **Anti-slop pass** — re-read against `skills/_shared/anti-slop-tells.md`: no cleft
  sentences, ≤1 antithesis flourish, no aphoristic closer, no hedge preamble, not
  staccato. Especially watch the hook and bridge — they default to cliché.

## State Update

Read `skills/_shared/state-io.md` and execute — append to `seen-postings`.

After generating, ask the candidate if they want to apply. If yes, append to
the seen-postings state file with `posted:YYYY-MM-DD` if the posting date is
visible on the job page. If unknown, use `discovered:YYYY-MM-DD` (today's date)
instead — every entry must have one or the other so all roles can be aged:

```
- {Company} | {Title} | APPLYING | {date} | posted:YYYY-MM-DD
```

Note: Applications pipeline tracking is deferred to the `application-tracker` skill.
