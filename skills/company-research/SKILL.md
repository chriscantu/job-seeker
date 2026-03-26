---
name: company-research
description: >
  Deep-dive research on a target company from a job posting URL. Produces a
  lean, positioning-focused brief that maps the candidate's strengths to the
  company's challenges. Output saved to output/{company-slug}/company-research.md.
  Triggers: "research this company", "tell me about [company]", "company deep dive"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Company Research

Takes a job posting URL, researches the company, and produces a positioning-focused
brief that other skills (cover-letter, why-this-company, interview-prep) can reference.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error to the user
2. Read `PRINCIPLES.md` — quality standards and voice guidelines that govern all output
3. Read `config/candidate.md` — candidate name, core strengths, accomplishments
4. Read `config/search.md` — company types of interest, to contextualize fit
5. Accept the job posting URL from the user

---

## Company Extraction

WebFetch the job posting URL. From the page content, extract:

| Field | Source |
|-------|--------|
| Company name | Page title, meta tags, or ATS page structure |
| Role title | Job title from the posting |
| Location | Location field from the posting |
| Company website domain | Links on the page, or derive from ATS URL pattern |

Derive `{company-slug}` from the company name: lowercase, spaces replaced with
hyphens, special characters removed (e.g., "Maven Clinic" → `maven-clinic`).

**If the URL returns 404 or is unparseable**, stop with:
> "Could not access that posting. Is the URL correct?"

**If the company name cannot be determined**, stop with:
> "Could not identify the company from this page. Try providing the company name directly."

---

## Research Queries — Batched

Issue ALL research queries in a single parallel batch (one message, all calls
at once). This follows the daily-digest batching protocol — never issue searches
one at a time.

```
[WebSearch: {company} mission values "about us"]
[WebSearch: {company} engineering blog OR tech blog OR developer blog]
[WebSearch: {company} funding series revenue employees site:crunchbase.com OR site:pitchbook.com]
[WebSearch: {company} glassdoor engineering culture review]
[WebFetch: {company-website}/about]
[WebFetch: {company-website}/careers]
```

Six calls total. Wait for all results before synthesizing.

**No retry logic.** If a query returns thin or empty results, note the gap in
the brief's "Gaps & Open Questions" section rather than issuing additional
queries.

---

## Output Brief

Write the research brief to `output/{company-slug}/company-research.md`.

If `output/{company-slug}/` does not exist, create the directory first.

### Brief Structure

Use this exact structure:

```markdown
# {Company Name} — Research Brief

**Date**: {YYYY-MM-DD}
**Role**: {Title from posting}
**URL**: {Original posting URL}

## Mission & Products
{What the company does, who they serve, why it matters — 2-4 sentences}

## Engineering Culture Signals
{Blog posts, open source, tech talks, eng team size, tech stack clues.
If no signals found: "No public engineering culture signals found."}

## Funding & Scale
{Stage, last round, headcount range, revenue signals if public company}

## Positioning — How to Stand Out
{2-3 bullets mapping the candidate's specific strengths and accomplishments
from config/candidate.md to this company's challenges, domain, or growth stage.
These must reference REAL accomplishments from the config, not generic platitudes.}

## Gaps & Open Questions
{Anything the research couldn't answer — e.g., "No public eng blog;
culture signals are limited to Glassdoor reviews"}
```

### Positioning Quality Rules

The Positioning section is the core value of this brief. Use `config/candidate.md`
accomplishments — the resume (`references/resume.pdf`) is not needed here; downstream
skills (cover-letter, interview-prep) read it for full detail. Requirements:

- Each bullet MUST reference a specific accomplishment or strength from `config/candidate.md`
- Each bullet MUST connect that accomplishment to something specific about this company
- Generic statements like "your leadership experience is relevant" are NOT acceptable
- Example of good: "Your experience reducing deployment cycles from 3 months to 15 minutes maps directly to {Company}'s stated priority of shipping velocity — their eng blog mentions quarterly releases as a pain point"
- Example of bad: "Your engineering leadership background would be valuable here"

---

## State Update

After writing the brief, annotate the company's entry in seen-postings.

1. Glob `output/*-seen-postings.md`, sort descending, read the most recent file
2. Find the line matching the company name and URL
3. Append `| RESEARCHED` to that line

**Before:**
```
- Maven Clinic | VP Engineering | https://jobs.lever.co/mavenclinic/abc
```

**After:**
```
- Maven Clinic | VP Engineering | https://jobs.lever.co/mavenclinic/abc | RESEARCHED
```

**If the company is NOT in seen-postings** (URL came from outside the digest),
add a new entry under today's date section with the `RESEARCHED` flag.
Include `posted:YYYY-MM-DD` if the posting date is visible on the job page
(look for "Posted on", date metadata, or ATS date fields). If the posted date
cannot be determined, use `discovered:YYYY-MM-DD` (today's date) instead —
every entry must have one or the other so all roles can be aged:

```
## {YYYY-MM-DD}
- {Company} | {Title} | {URL} | posted:YYYY-MM-DD | RESEARCHED
```

If no seen-postings file exists at all, create `output/YYYY-MM-DD-seen-postings.md`
with the new entry.

**Do not** update `preferences.md` or `applications.md`. Research is not a
pipeline event.

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| URL returns 404 or is unparseable | Stop: "Could not access that posting. Is the URL correct?" |
| Cannot determine company name | Stop: "Could not identify the company from this page. Try providing the company name directly." |
| Research queries return thin results | Write the brief with gaps noted in "Gaps & Open Questions" — don't fail, don't retry |
| `output/{company-slug}/` doesn't exist | Create it before writing the brief |
| Seen-postings file doesn't exist | Create `output/YYYY-MM-DD-seen-postings.md` with the new entry |
