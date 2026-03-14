---
name: company-research
description: >
  Deep dive research on a target company before applying or interviewing.
  Triggers: "research this company", "tell me about [company]", "company deep dive"
---

# Company Research

Produces a comprehensive research brief on a target company to inform
application materials and interview preparation.

## Status: Planned

This skill is stubbed for future development.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, core strengths, previous companies
3. Read `config/search.md` — company types of interest, comp floor

## Intended Behavior

1. Research company mission, products, recent news, funding, leadership
2. Identify engineering culture signals (blog posts, tech talks, open source)
3. Map company challenges to Chris's strengths
4. Surface any red flags or concerns
5. Output a structured research brief saved to `output/{company-slug}/company-research.md`

## Key Sources

- Company website, engineering blog, careers page
- Glassdoor/Blind reviews (engineering-specific)
- Recent press, funding announcements
- LinkedIn profiles of engineering leadership
- GitHub/open source presence
