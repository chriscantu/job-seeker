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

## Before You Start

1. Read `PRINCIPLES.md` — especially "Authenticity Over Polish" and "Mission Alignment Is Not Performative"
2. Read `config/candidate.md` — candidate name, role, previous companies, strengths
3. Read `references/resume.pdf` for detailed accomplishments
4. Glob `references/writing-samples/*.md` — if any files exist, read them to
   calibrate tone before writing.
5. Glob `output/*-preferences.md`, sort descending, read the most recent file
   for interest signals. If no file exists, proceed without preference context.

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
**Good:** "At Babylon Health, I saw firsthand how broken delivery systems
block a company's ability to reach the people who need it most. [Company]
is solving [specific problem] and I know what it takes to build the
engineering platform that makes that possible at scale."

### 2. The Bridge (2-3 sentences)
Connect the candidate's specific accomplishments to the company's current challenges.
Use numbers. Reference the actual role requirements if you have the posting.

**Template:** "In my current role, I [specific accomplishment
with numbers]. [Company] is at a stage where [specific challenge from
job posting or research], and that's exactly the kind of problem I've
built my career around solving."

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

## State Update

After generating, ask the candidate if they want to apply. If yes:

1. Glob `output/*-seen-postings.md`, sort descending.
2. Append to the most recent file (or create `output/YYYY-MM-DD-seen-postings.md`
   if none exists):
   ```
   - {Company} | {Title} | APPLYING | {date}
   ```

Note: Applications pipeline tracking is deferred to the `application-tracker` skill.
