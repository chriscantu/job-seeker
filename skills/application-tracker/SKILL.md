---
name: application-tracker
description: >
  Pipeline management across all job opportunities.
  Triggers: "track this application", "application status", "where am I in the pipeline"
---

# Application Tracker

Manages the full application pipeline from discovered → applied → interviewing
→ offer → decision.

## Status: Planned

This skill is stubbed. Implementation spec: v0.4 Item 3 (separate spec required).

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name
3. Read `config/search.md` — target roles
4. Glob `output/*-applications.md`, sort descending, read most recent for current pipeline.
   If no file exists, treat as empty pipeline.

## Intended Behavior

1. Maintain pipeline state in `output/*-applications.md`
2. Track: company, role, stage, date applied, next action, contacts
3. Support stage transitions with date logging
4. Surface stale applications (no movement in 2+ weeks)
5. Generate weekly pipeline summary

## Pipeline Stages

Discovery → Research → Applied → Screen → Interview Round 1 →
Interview Round 2+ → Final Round → Offer → Decision → Closed
