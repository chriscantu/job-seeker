# job-seeker

A Claude Code plugin that automates the executive job search lifecycle. Built for a specific candidate (me), not as a general-purpose tool. Runs in Claude Code CLI on macOS — not Cowork.

## What It Does

Eight skills that cover the full arc of a senior engineering leadership job search:

| Skill | Status | What it does |
|-------|--------|--------------|
| `daily-digest` | Active | Searches executive job boards every weekday morning and writes a digest to Apple Notes with deduplication |
| `why-this-company` | Active | Generates a "Why did you apply?" response for a specific company, grounded in real career history |
| `cover-letter` | Active | Produces a tailored cover letter that maps accomplishments to role requirements |
| `resume-tailor` | Planned | Reorders and emphasizes resume bullets for a specific posting |
| `company-research` | Planned | Deep dive on a target company before applying or interviewing |
| `interview-prep` | Planned | Behavioral and technical interview prep with STAR story mapping |
| `application-tracker` | Planned | Pipeline management across all opportunities |
| `networking-outreach` | Planned | Outreach messages for target companies and contacts |

## How It Works

Each skill is a prompt-based agent defined in `skills/{name}/SKILL.md`. When invoked in Claude Code, the skill reads the candidate profile from `CLAUDE.md`, follows the voice and quality rules in `PRINCIPLES.md`, and produces output to `output/{company}/`.

State (which roles have been seen, what interests me, where I've applied) lives in Apple Notes, read and written via `osascript` through the Bash tool. Local `memory/` files are mirrors, not source of truth.

## Project Structure

- `CLAUDE.md` — candidate profile, skill triggers, state management
- `PRINCIPLES.md` — voice calibration, quality standards, anti-patterns
- `STRUCTURE.md` — directory map and file placement rules
- `skills/` — one subdirectory per skill, each with a SKILL.md
- `references/` — resume, voice guide, writing samples (committed)
- `output/` — generated application materials per company (gitignored)
- `memory/` — runtime state mirrors (gitignored)

## Voice

All outputs are calibrated to sound like me, not a career coach. The voice guide (`references/voice-guide.md`) was built from my published writing and defines rules like "teach, don't perform," "we over I," "concrete before abstract," and "no buzzwords." If an output could have been written by anyone, it's wrong.
