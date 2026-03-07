---
name: daily-digest
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest via Apple Notes. Runs
  automatically at 7am weekdays via scheduled task, but can also be
  triggered manually with "run my job digest", "check for new roles",
  "any new jobs today", or "job search update". Uses persistent state
  in Apple Notes to avoid showing duplicate postings and to learn from
  Chris's interest signals over time.
---

# Daily Job Digest

Searches executive job boards, filters against Chris's criteria, deduplicates
against previously seen postings, and writes a formatted Apple Note.

## Before You Start

1. Read `CLAUDE.md` for candidate profile and filter criteria
2. Read the `Job Search - Seen Postings` Apple Note — do NOT resurface any role already listed
3. Read the `Job Search - Preferences` Apple Note — use interest signals to weight searches

## Filter Criteria

**Include:**
- Titles: Senior Director of Engineering, VP of Engineering, Head of Engineering,
  SVP Engineering, VP Platform Engineering, VP Developer Experience
- Location: Remote, Hybrid (Austin TX area OK)
- Company type: Mission-driven, growth-stage, midsize
- Comp: $250K+ total likely

**Exclude:**
- Relocation required outside Austin
- 100% in-office downtown Austin
- IC/Staff Engineer roles
- Junior Director at very large companies
- Consulting or contract

## Search Strategy

Vary queries each run. Mix approaches — don't repeat the same searches daily:
- Major boards (Indeed, LinkedIn, Glassdoor, Built In)
- Mission-driven boards (Tech Jobs for Good, Purpose Jobs, Wellfound)
- Industry-specific (healthcare tech, EdTech, construction tech, PropTech)
- Austin-area hybrid roles specifically

Weight effort toward sources that have historically produced relevant results
(check `Preferences` note for source effectiveness data).

## Output

Write an Apple Note using HTML formatting. See the scheduled task prompt
for the exact HTML template. Key rules:
- Use `<h1>`, `<h2>`, `<p>`, `<b>`, `<table>`, `<ul>` tags — plain text renders as a wall
- Include clickable links via `<a href="">` tags
- Monday digests include the manual-check reminder for walled-garden sites

## State Updates

After writing the digest:
1. Update `Job Search - Seen Postings` — add all new roles
2. Update `Job Search - Preferences` — update source effectiveness counts
