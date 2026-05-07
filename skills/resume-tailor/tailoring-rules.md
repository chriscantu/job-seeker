# Resume Tailor — Tailoring Rules

## Phase 1: Analyze the Posting

Extract from the job posting (or company-research brief if available):

1. **Top 3-5 requirements** — capabilities the role most demands.
2. **Seniority signals** — scope indicators (budget, team size, org breadth).
3. **Domain context** — industry, tech stack, company stage.

## Phase 2: Score and Map Content

Read `references/resume.md`. For every bullet and accomplishment:

- Score relevance against the extracted keywords (`scoreBullet`).
- Reorder all 6 Key Accomplishments by score; total count stays at 6.
- Reorder bullets within each role by score.

## Phase 3: Skills Selection

Read `references/skills-master.md`. Select 10:

- 5 floor (always-tagged)
- 5 JD-overlay (situational, ranked by JD-keyword match)

Output: ` | `-delimited single line under `## Skills`.

## Phase 4: Summary Lead-Clause Swap

Use the recruiter draft from `references/resume.md` as the baseline. Swap the lead
clause ("Senior Engineering Leader specializing in ___") with the JD's top requirement.
Preserve the rest verbatim. Mandate-line keywords across all roles are eligible signal
when the JD's top requirement matches a mandate term (e.g. JD asks for "platform
reliability" → favor the Babylon mandate's framing).

## Phase 5: Compose

Compose tailored markdown via `composeTailoredResumeMarkdown`. Schema:

```markdown
---
generated: <date>
company: <name>
role: <title>
posting_url: <url>
template_version: 1
canonical_version: <date from resume.md>
---

# Christopher Cantu

**<Tagline>**

<contact line>

<Summary paragraph — recruiter draft, lead clause swapped per JD>

## Key Accomplishments

- **<Label>** — <single sentence: action + scope + outcome>.
- ...(6 total)

## Skills

A | B | C | D | E | F | G | H | I | J

## Professional Experience

### Title | Company

*Location | Date range | Team size context*

*Hired to <one-sentence mandate — preserved verbatim from canonical>.*

- Single-sentence bullet: action verb + scope/numbers + outcome clause.
- ...

## Education

**Degrees**

School
```

**Schema rules (binding):**

- No `Challenge:`/`Action:`/`Results:` literals.
- No `**Impact:**` literal label — outcome folded into the bullet's single sentence
  via -ing / -ing-clause / "with"-clause / em-dash continuation.
- Each bullet is one sentence ending in `.`. CAR is implicit by ordering.
- Skills line: single line, ` | `-delimited, max 10.
- Key Accomplishments: `- **<Label>** — <single sentence>.` (no pipe-delimited Impact field).
- Mandate line (italic, one sentence) is preserved verbatim from `references/resume.md`. Not scored, not droppable, not rewritten. Sits directly under the role's location/dates italic.

## Phase 6: Render and Enforce

Render via `renderResume`. Verify page count via `pageCount`. If > 2 pages, run
`enforceTwoPages` per `drop-strategy.md`.

## Anti-Patterns (Summary)

- "I'm passionate about driving organizational excellence"
- "I'm uniquely positioned to leverage my experience"
- "I've been fortunate enough to lead..."
- Anything LinkedIn-influencer flavored.

## Key Constraints

- **Never fabricate experience** — only reorder, re-emphasize, swap lead clauses.
- **Drop content for 2-page fit per `drop-strategy.md`.** This SUPERSEDES the
  legacy "never remove" rule.
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim from canonical.
- **Education and Header are verbatim** — no trimming.
- **Flag gaps honestly** in the decisions log.
