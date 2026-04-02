# Company Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the company-research stub with a full skill that takes a job posting URL, produces a lean positioning-focused research brief, and annotates seen-postings.

**Architecture:** Single SKILL.md rewrite — no scripts, no code. The skill instructs Claude to WebFetch the posting URL, batch 6 research queries, synthesize a brief to `output/{company-slug}/company-research.md`, and append `| RESEARCHED` to the seen-postings entry. Follows daily-digest's batching protocol pattern.

**Tech Stack:** Markdown skill definition only. Tools used by the skill at runtime: WebFetch, WebSearch, Read, Write, Edit, Bash, Glob.

---

### Task 1: Write the full SKILL.md

**Files:**
- Modify: `skills/company-research/SKILL.md:1-37` (replace entire file)

**Context for the implementer:**
- Read `integrations/specs/company-research-spec.md` for the full spec
- Read `skills/daily-digest/SKILL.md` for the established pattern (frontmatter format, "Before You Start" structure, batching protocol, state update pattern)
- Read `skills/cover-letter/SKILL.md` for the `output/{company-slug}/` convention and how it references `config/candidate.md`
- Read the current stub at `skills/company-research/SKILL.md` to see what's being replaced

- [ ] **Step 1: Write the SKILL.md frontmatter**

Replace the entire file. The frontmatter sets up the skill metadata:

```yaml
---
name: company-research
description: >
  Deep-dive research on a target company from a job posting URL. Produces a
  lean, positioning-focused brief that maps the candidate's strengths to the
  company's challenges. Output saved to output/{company-slug}/company-research.md.
  Triggers: "research this company", "tell me about [company]", "company deep dive"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---
```

- [ ] **Step 2: Write the skill title and introduction**

```markdown
# Company Research

Takes a job posting URL, researches the company, and produces a positioning-focused
brief that other skills (cover-letter, why-this-company, interview-prep) can reference.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error to the user
2. Read `config/candidate.md` — candidate name, core strengths, accomplishments
3. Read `config/search.md` — company types of interest, to contextualize fit
4. Accept the job posting URL from the user
```

- [ ] **Step 3: Write the Company Extraction section**

```markdown
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
```

- [ ] **Step 4: Write the Research Queries section**

```markdown
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
```

- [ ] **Step 5: Write the Output Brief section**

```markdown
---

## Output Brief

Write the research brief to `output/{company-slug}/company-research.md`.

If `output/{company-slug}/` does not exist, create the directory first.

### Brief Structure

Use this exact structure:

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

### Positioning Quality Rules

The Positioning section is the core value of this brief. Requirements:

- Each bullet MUST reference a specific accomplishment or strength from `config/candidate.md`
- Each bullet MUST connect that accomplishment to something specific about this company
- Generic statements like "your leadership experience is relevant" are NOT acceptable
- Example of good: "Your experience reducing deployment cycles from 3 months to 15 minutes maps directly to {Company}'s stated priority of shipping velocity — their eng blog mentions quarterly releases as a pain point"
- Example of bad: "Your engineering leadership background would be valuable here"
```

- [ ] **Step 6: Write the State Update section**

```markdown
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
add a new entry under today's date section with the `RESEARCHED` flag:

```
## {YYYY-MM-DD}
- {Company} | {Title} | {URL} | RESEARCHED
```

If no seen-postings file exists at all, create `output/YYYY-MM-DD-seen-postings.md`
with the new entry.

**Do not** update `preferences.md` or `applications.md`. Research is not a
pipeline event.
```

- [ ] **Step 7: Write the Error Handling section**

```markdown
---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| URL returns 404 or is unparseable | Stop: "Could not access that posting. Is the URL correct?" |
| Cannot determine company name | Stop: "Could not identify the company from this page. Try providing the company name directly." |
| Research queries return thin results | Write the brief with gaps noted in "Gaps & Open Questions" — don't fail, don't retry |
| `output/{company-slug}/` doesn't exist | Create it before writing the brief |
| Seen-postings file doesn't exist | Create `output/YYYY-MM-DD-seen-postings.md` with the new entry |
```

- [ ] **Step 8: Verify the complete SKILL.md**

Run these checks:

```bash
# Verify the file exists and has substantial content (stub was 37 lines)
wc -l skills/company-research/SKILL.md
# Expected: 120-160 lines

# Verify frontmatter is valid (has opening and closing ---)
head -10 skills/company-research/SKILL.md

# Verify key sections are present
grep -c "## Before You Start\|## Company Extraction\|## Research Queries\|## Output Brief\|## State Update\|## Error Handling" skills/company-research/SKILL.md
# Expected: 6

# Verify it references config files
grep -c "config/candidate.md\|config/search.md" skills/company-research/SKILL.md
# Expected: at least 3

# Verify allowed-tools in frontmatter
grep "allowed-tools" skills/company-research/SKILL.md
# Expected: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
```

- [ ] **Step 9: Run existing validators**

```bash
node scripts/validate-config.js
# Expected: ✓ Config valid

node scripts/validate-structure.js
# Expected: ✓ Structure valid
```

Both should pass — we didn't change structure or config, only the content of an existing SKILL.md.

- [ ] **Step 10: Commit**

```bash
git add skills/company-research/SKILL.md
git commit -m "feat(skills): implement company-research skill

Replaces the placeholder stub with a full skill definition that:
- Takes a job posting URL and extracts company identity
- Batches 6 research queries (4 WebSearch + 2 WebFetch)
- Produces a positioning-focused brief at output/{company-slug}/company-research.md
- Annotates seen-postings with RESEARCHED flag

Spec: integrations/specs/company-research-spec.md"
```

---

### Task 2: Update the spec status

**Files:**
- Modify: `integrations/specs/company-research-spec.md:3`

- [ ] **Step 1: Update the spec status line**

Change line 3 from:
```
**Status**: Approved — pending implementation
```
To:
```
**Status**: Implemented
```

- [ ] **Step 2: Commit**

```bash
git add integrations/specs/company-research-spec.md
git commit -m "docs: mark company-research spec as implemented"
```
