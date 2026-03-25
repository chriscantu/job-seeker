# Job Seeker — Plugin Instructions

## Purpose

This plugin is a job search platform for Chris Cantu, an Engineering Director
seeking Senior Director / VP of Engineering roles at mission-driven, growth-stage
or midsize companies. It automates and assists with every phase of the executive
job search lifecycle.

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

Apple Notes integration is Chris's personal layer — `daily-digest` also writes
there when `integrations/config/notes-config.md` is present. See
`integrations/adapters/apple-notes.md` to enable it as a new user.

---

## Resume

The canonical resume lives at `references/resume.pdf`. Every skill that needs
resume context should read this file rather than hardcoding experience details.
Read `config/candidate.md` for a quick profile reference, but the resume
is the source of truth for detailed accomplishments.

---

## Skill Invocation

| Skill | Trigger Phrases |
|-------|----------------|
| `daily-digest` | "run my job digest", "check for new roles", "job search" *(interactive only — requires macOS/osascript for Apple Notes)* |
| `why-this-company` | "why this company", "why am I applying to", "application response" |
| `cover-letter` | "cover letter", "write a cover letter for" |
| `resume-tailor` | "tailor my resume", "customize resume for" |
| `company-research` | "research this company", "tell me about [company]", "company deep dive" |
| `interview-prep` | "prep me for interview", "interview questions", "practice interview" |
| `application-tracker` | "track application", "update pipeline", "where am I with" |
| `networking-outreach` | "draft outreach", "reach out to", "networking message" |
| `setup` | "setup", "configure job seeker", "check my setup", "get started", "what's missing" |
| `linkedin-article` | "write a LinkedIn post", "LinkedIn article", "create LinkedIn content", "draft a post about", "LinkedIn thought leadership" |

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
| Pre Write/Edit | PII guard — blocks writes containing phone numbers or addresses to non-gitignored files |
| Stop | Checks if skill state was persisted; warns if state files may be stale |
