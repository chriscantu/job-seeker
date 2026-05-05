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

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Accept the job posting URL from the user.

---

## Phase 1 — Company Extraction

Read `skills/_shared/company-extraction.md` and execute.

---

## Phase 2 — Research Queries (Batched)

Read `skills/_shared/batching.md` for reference.

Issue ALL research queries in a single parallel batch (one message, all calls
at once).

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

## Phase 3 — Output Brief

Read `skills/_shared/frontmatter.md` for the schema contract.

Write the research brief to `output/{company-slug}/company-research.md`.

If `output/{company-slug}/` does not exist, create the directory first.

### Brief Structure

Use this exact structure. The frontmatter block provides structured metadata;
the body contains the research narrative.

```markdown
---
skill: company-research
company: {Company Name}
slug: {company-slug}
role: {Title from posting}
url: "{Original posting URL}"
generated: {YYYY-MM-DD}
rating: {1-5 fit rating}
remote: {true/false}
positioning_count: {number of positioning bullets written below}
gaps_count: {number of gaps/questions written below}
---

# {Company Name} — Research Brief

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

## Phase 4 — State Update

Read seen-postings via `bun scripts/state.ts read seen-postings`. All
mutations use the CLI subcommands below — never edit
`output/*-seen-postings.md` directly.

After writing the brief, annotate the company's entry in seen-postings:

```
bun scripts/state.ts flag seen-postings --url "<job-url>" --add RESEARCHED
```

The `flag` subcommand finds the entry by URL and appends the `RESEARCHED`
flag. If no matching entry exists, the command exits non-zero — fall through
to the bootstrap path below.

**If the company is NOT in seen-postings** (URL came from outside the
digest, or the `flag` call exited non-zero), append a new entry tagged
`RESEARCHED`. Include `posted:YYYY-MM-DD` if the posting date is visible on
the job page (look for "Posted on", date metadata, or ATS date fields).
If the posted date cannot be determined, use `discovered:YYYY-MM-DD`
(today's date) — every entry must have one or the other so all roles can
be aged:

```
bun scripts/state.ts append seen-postings '{
  "company": "<Company>",
  "title": "<Title>",
  "url": "<URL>",
  "posted": "<YYYY-MM-DD>",
  "flags": ["RESEARCHED"]
}'
```

The CLI auto-creates `output/YYYY-MM-DD-seen-postings.md` if no file exists.

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
| Seen-postings file doesn't exist | `bun scripts/state.ts append seen-postings '<json>'` — auto-creates today's file. |
