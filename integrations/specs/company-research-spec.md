# Specification: Company Research

**Date**: 2026-03-25
**Status**: Implemented — pending live validation
**Roadmap item**: v0.4 Item 3 (Activate Planned Skills)

---

## Problem

The cover-letter, why-this-company, and interview-prep skills all need company
context to produce quality output. Today, each skill does ad-hoc web searches
inline — duplicating effort, producing inconsistent depth, and burning tool
calls on research that could be done once and reused.

## Goal

A single skill that takes a job posting URL, produces a lean positioning-focused
research brief, and saves it where other skills can find it. One invocation per
company, reusable across the application lifecycle.

## Out of Scope

- Full dossier (leadership profiles, detailed financials, org charts) — that's
  interview-prep territory
- Cache/refresh logic — if the user asks for research, they get research
- Apple Notes integration — briefs are reference artifacts, not daily deliverables
- Automatic triggering from daily-digest — the user decides when to research

---

## Solution

Single-pass research with batched web calls. The skill:

1. Accepts a job posting URL
2. Extracts company identity from the posting page
3. Runs all research queries in one parallel batch
4. Synthesizes a lean brief focused on positioning
5. Annotates seen-postings with a `RESEARCHED` flag

---

## Input

A job posting URL. This is the only required input. The URL can come from:

- The daily digest (`output/digest-{date}.html`)
- A seen-postings entry
- Pasted manually by the user

The skill derives `{company-slug}` from the extracted company name: lowercase,
spaces replaced with hyphens, special characters removed (e.g., "Maven Clinic"
→ `maven-clinic`). This matches the existing `output/{company-slug}/` convention
used by cover-letter and why-this-company.

---

## Company Extraction

WebFetch the posting URL and parse:

| Field | Source |
|-------|--------|
| Company name | Page title, meta tags, or ATS page structure |
| Role title | Job title from the posting |
| Location | Location field from the posting |
| Company website domain | Links on the page, or derive from ATS URL |

If the URL returns 404 or is unparseable, stop with:
> "Could not access that posting. Is the URL correct?"

If the company name cannot be determined, stop with:
> "Could not identify the company from this page. Try providing the company name directly."

---

## Research Queries

After extraction, issue all queries in a single parallel batch (one message,
all calls at once — follows the daily-digest batching protocol):

```
[WebSearch: {company} mission values "about us"]
[WebSearch: {company} engineering blog OR tech blog OR developer blog]
[WebSearch: {company} funding series revenue employees site:crunchbase.com OR site:pitchbook.com]
[WebSearch: {company} glassdoor engineering culture review]
[WebFetch: {company-website}/about]
[WebFetch: {company-website}/careers]
```

Six calls total. Wait for all results before synthesizing.

**No retry logic.** If a query returns thin or empty results, the brief notes
the gap in "Gaps & Open Questions" rather than issuing additional queries. This
keeps the skill predictable and fast.

---

## Output Brief

Single file: `output/{company-slug}/company-research.md`

If `output/{company-slug}/` does not exist, create it.

### Brief Structure

```markdown
# {Company Name} — Research Brief

**Date**: {YYYY-MM-DD}
**Role**: {Title from posting}
**URL**: {Original posting URL}

## Mission & Products
{What the company does, who they serve, why it matters}

## Engineering Culture Signals
{Blog posts, open source, tech talks, eng team size, tech stack clues}
{If no signals found: "No public engineering culture signals found."}

## Funding & Scale
{Stage, last round, headcount range, revenue signals if public}

## Positioning — How to Stand Out
{2-3 bullets mapping the candidate's strengths from config/candidate.md
to this company's challenges, domain, or growth stage}

## Gaps & Open Questions
{Anything the research couldn't answer — e.g., "No public eng blog;
culture signals are limited to Glassdoor reviews"}
```

The **Positioning** section is the core value. It reads accomplishments and
core strengths from `config/candidate.md` and maps them to what the research
revealed about the company's challenges, domain, and growth stage. This is
what cover-letter and why-this-company consume.

---

## State Update

After writing the brief, annotate seen-postings:

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

If the company is not in seen-postings (user pasted a URL found outside the
digest), add a new entry under today's date section with the `RESEARCHED` flag:

```
## {YYYY-MM-DD}
- {Company} | {Title} | {URL} | RESEARCHED
```

**No changes** to `preferences.md` or `applications.md`. Research is not a
pipeline event.

---

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show
   the error to the user
2. Read `PRINCIPLES.md` — quality standards and voice guidelines that govern all output
3. Read `config/candidate.md` — candidate name, core strengths, accomplishments
4. Read `config/search.md` — company types, to contextualize fit
5. Accept the job posting URL from the user

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| URL returns 404 or is unparseable | Stop: "Could not access that posting. Is the URL correct?" |
| Cannot determine company name | Stop: "Could not identify the company from this page. Try providing the company name directly." |
| Research queries return thin results | Write the brief with gaps noted in "Gaps & Open Questions" — don't fail, don't retry |
| `output/{company-slug}/` doesn't exist | Create it (matches cover-letter behavior) |
| Seen-postings file doesn't exist | Create `output/YYYY-MM-DD-seen-postings.md` with the new entry |

---

## Skill File Changes

### `skills/company-research/SKILL.md`

Replace the current stub with the full skill definition implementing this spec.
The SKILL.md should include:

- Frontmatter (name, description, allowed-tools, triggers)
- Before You Start section (config reads, URL input)
- Company Extraction section
- Research Queries section (batched, with exact query patterns)
- Output Brief section (structure, Positioning guidance)
- State Update section (seen-postings annotation)
- Error Handling section

### `CLAUDE.md`

No changes needed — `company-research` is already listed in the skill
invocation table with correct trigger phrases.

### `STRUCTURE.md`

No changes needed — `skills/company-research/` is already in the directory map.

### `plugin.json`

No changes needed — `company-research` is already registered.

---

## Downstream Skill Integration

Other skills should check for a research brief before doing their own research:

| Skill | How it uses the brief |
|-------|----------------------|
| `application-tracker` | Already reads `output/{company-slug}/company-research.md` to enrich pipeline context |
| `cover-letter` | Read `output/{company-slug}/company-research.md` if it exists; use Positioning section to ground the letter |
| `why-this-company` | Read the brief for Mission & Products and Positioning; skip redundant web searches |
| `interview-prep` | Read the brief as a starting point; expand with deeper research as needed |

`application-tracker` already integrates. The remaining downstream changes are
**not part of this spec**. They are noted here so that when those skills are
activated, they know to look for the brief. The `RESEARCHED` flag in
seen-postings provides a quick check before globbing for the file.

---

## Test Protocol

### Manual validation steps

1. Run `node scripts/validate-config.js` — confirm `✓ Config valid`
2. Invoke `company-research` with a live Greenhouse URL — confirm brief is
   written to `output/{company-slug}/company-research.md` with all 5 sections
3. Check `output/*-seen-postings.md` — confirm the entry has `| RESEARCHED` appended
4. Invoke with a dead URL (404) — confirm clear error message, no brief written
5. Invoke with a URL for a company not in seen-postings — confirm new entry
   created with `RESEARCHED` flag
6. Verify the Positioning section references specific accomplishments from
   `config/candidate.md`, not generic platitudes
7. Run `node scripts/validate-structure.js` — confirm no regressions
