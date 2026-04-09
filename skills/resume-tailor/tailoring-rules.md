# Resume Tailor — Tailoring Rules

## Phase 1: Analyze the Posting

Extract from the job posting (or company-research brief if available):

1. **Top 3-5 requirements** — the capabilities the role most demands
   (e.g., "scaling engineering orgs internationally", "platform migration",
   "CI/CD maturity")
2. **Seniority signals** — scope indicators (budget, team size, org breadth)
3. **Domain context** — industry, tech stack, company stage

## Phase 2: Score and Map Accomplishments

Read the canonical resume (`references/resume.pdf`). For every bullet and
accomplishment:

- Score relevance against the extracted requirements
- **Keep all 6 accomplishment cards** — reorder rows so the most relevant
  cards appear in row 1. Individual card content can be swapped but total
  count stays at 6. Dropping cards makes the resume look thinner.
- Determine bullet reordering within each job entry — most relevant first.
  Do not remove any bullets.

## Phase 3: Rewrite Summary

Draft a 2-3 sentence summary that:

- Leads with the strongest signal for this specific role
- References specific numbers and outcomes from the canonical resume
- Uses the candidate's voice (from `references/voice-guide.md`):
  - Concrete before abstract — lead with the number, then the meaning
  - "We" for team work, "I" for personal decisions
  - No buzzwords, no performative language
  - Friendly pragmatist tone
- Positions at VP/Senior Director scope

**Anti-patterns:**
- "I'm passionate about driving organizational excellence"
- "I'm uniquely positioned to leverage my experience"
- "I've been fortunate enough to lead..."
- Anything that sounds like a LinkedIn influencer or career coach

## Markdown Structure (Critical)

The markdown MUST conform exactly to the structure that
`scripts/generate_resume_docx.js` expects. The parser is rigid.

```
# Candidate Name
**Tagline — e.g., Engineering Leader | Platform & Infrastructure | Scaling Teams**
contact@email.com | City, State | linkedin.com/in/handle

Summary paragraph — 2-3 sentences, rewritten for this role per Phase 3.

---

## Key Accomplishments

| **Label** — description | **Label** — description |
| **Label** — description | **Label** — description |

---

## Professional Experience

### Title | Company

*Location | Date range | Team size context*

**Challenge:** (verbatim from canonical resume — do NOT remove)

**Action:** (verbatim from canonical resume — do NOT remove)

**Results:**

- Bullet point (most relevant to this role first)
- Bullet point
- Bullet point

### Title | Company

*Location | Date range*

- Bullet point
- Bullet point

---

## Education

**Degree**              ← must come first (parser captures as degree)
University Name         ← must come second (parser captures as school)
**Core Expertise:** Comma-separated skills  ← must come last
```

**Order matters in Education.** The parser reads lines sequentially.
Reordering silently corrupts the .docx.

## Content Rules

- Accomplishments table: all 6 items, reordered by scoring relevance. `**Bold Label** — description with numbers` format.
- Experience bullets: reordered per scoring. Facts/numbers verbatim from canonical resume. Light phrasing edits allowed: reorder clauses, lead with relevant phrase, echo synonymous keywords. No new claims, no inflated scope.
- Summary: rewritten version from Phase 3
- Education: copied verbatim — ALL degrees, school, full Core Expertise list
- All other content (name, tagline, contact, titles, dates): verbatim

## Key Constraints

- **Never fabricate experience** — only reorder and re-emphasize
- **Never remove sections, bullets, or narrative blocks** — Challenge/Action/Results are core content
- **Never remove accomplishment cards** — reorder and swap, never drop
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim
- **Education and Core Expertise are verbatim** — no trimming
- **Flag gaps honestly** in the decisions summary
