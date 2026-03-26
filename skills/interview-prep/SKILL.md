---
name: interview-prep
description: >
  Behavioral and technical interview preparation with STAR story mapping.
  Triggers: "prep me for an interview", "interview prep", "practice interview questions"
---

# Interview Prep

Prepares the candidate for behavioral and technical interviews by mapping their
experience to likely questions using the STAR framework.

## Status: Planned

This skill is stubbed for future development.

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, experience, core strengths, accomplishments
3. Read `config/search.md` — target roles
4. Read `references/resume.pdf` — for STAR story material

## Intended Behavior

1. Accept company name and role details
2. Generate likely behavioral questions for VP/Senior Director level
3. Map each question to the candidate's strongest STAR stories
4. Cover: leadership philosophy, delivery transformation, scaling teams,
   conflict resolution, cross-functional influence, technical strategy
5. Include company-specific questions based on research brief
6. Output as a study guide saved to `output/{company-slug}/interview-prep.md`

## Key Frameworks

- STAR (Situation, Task, Action, Result)
- Leadership competency mapping
- Company values alignment
