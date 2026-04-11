# Job Seeker — Plugin Instructions

## Purpose

This plugin automates and assists with every phase of an executive job search
lifecycle — from role discovery through offer negotiation. It is designed for
engineering leaders seeking Senior Director / VP of Engineering roles at
mission-driven, growth-stage or midsize companies. See `config/candidate.md`
for the current candidate's profile.

## Principles (Read First)

Before creating files or running any skill, read `PRINCIPLES.md`.
It defines the quality standards, personalization rules, and privacy
constraints that govern all work in this plugin.

---

## Candidate Profile

Read `config/candidate.md` for the full candidate profile (name, current role,
target roles, experience, strengths, education, location, email, accomplishments).

## Search Preferences

Read `config/search.md` for target role titles, location constraints, comp floor,
company types, sources, and companies to skip.

---

## State Management

State persists in date-prefixed markdown files in `output/` (gitignored):

| File pattern | Purpose |
|-------------|---------|
| `output/*-seen-postings.md` | Deduplication log — every role ever surfaced |
| `output/*-preferences.md` | Interest signals, liked/passed roles, source effectiveness |
| `output/*-applications.md` | Application pipeline tracker |

Skills glob for the most recent file of each type. If none exists, create one
with today's date: `output/YYYY-MM-DD-{type}.md`.

Apple Notes is an optional personal integration — `daily-digest` also writes
there when `integrations/config/notes-config.md` is present. It is not required
for the plugin to function. See `integrations/adapters/apple-notes.md` to enable it.

---

## Resume

The canonical resume lives at `references/resume.pdf`. Every skill that needs
resume context should read this file rather than hardcoding experience details.
Read `config/candidate.md` for a quick profile reference, but the resume
is the source of truth for detailed accomplishments.

---

## Skill Routing (AI — match user intent to slash command)

All skills are registered as slash commands in `.claude/commands/`.
Use `/skill-name` for direct invocation or match natural language below:

| User says (any of these) | Run this command |
|--------------------------|------------------|
| digest, daily scan, job search, new roles, check for roles | `/daily-digest` |
| scan email, check mail, inbox scan, any job emails | `/scan-email` |
| research, tell me about, company deep dive | `/company-research` |
| tailor resume, customize resume | `/resume-tailor` |
| cover letter, application letter | `/cover-letter` |
| why this company, why am I applying | `/why-this-company` |
| track application, update pipeline, where am I | `/application-tracker` |
| prep me, interview questions, practice interview | `/interview-prep` |
| draft follow-ups, follow up on applications, any stale apps, what needs follow-up | `/follow-up` |
| linkedin post, linkedin article, thought leadership | `/linkedin-article` |
| draft outreach, reach out to, networking message | `/networking-outreach` |
| setup, configure, get started, what's missing | `/setup` |

## Commands

| Command | Purpose |
|---------|---------|
| `/pipeline` | Quick view of all active applications — stages, staleness, next actions |
| `/is-open <url>` | Check if a single job posting URL is still accepting applications |
| `/stats` | Search effectiveness — source performance, TheirStack credits, digest history |

## Hooks

| Event | Behavior |
|-------|----------|
| Session Start | Shows one-line pipeline summary (last digest date, active apps, stale alerts) |
| Pre Write/Edit | PII guard — blocks writes containing phone numbers, personal emails, SSNs, or street addresses to non-allowlisted paths (files outside output/, references/, config/, .claude/, /tmp/) |
| Stop | Checks if skill state was persisted; warns if state files may be stale |
