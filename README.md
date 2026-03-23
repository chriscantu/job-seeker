# job-seeker

A Claude Code plugin that automates the executive job search lifecycle. Built
for a specific candidate (me), but designed so anyone can fork it, drop in their
resume, and configure it for their own search. Runs in Claude Code CLI on macOS.

## What It Does

Nine skills that cover the full arc of a senior engineering leadership job search:

| Skill | Status | What it does |
|-------|--------|--------------|
| `setup` | Active | First-time configuration wizard and ongoing health check — run this first |
| `daily-digest` | Active | Searches executive job boards (TheirStack API + web search fallback) and writes a deduplicated digest to Apple Notes |
| `why-this-company` | Active | Generates a "Why did you apply?" response for a specific company, grounded in real career history |
| `cover-letter` | Active | Produces a tailored cover letter that maps accomplishments to role requirements |
| `resume-tailor` | Planned | Reorders and emphasizes resume bullets for a specific posting |
| `company-research` | Planned | Deep dive on a target company before applying or interviewing |
| `interview-prep` | Planned | Behavioral and technical interview prep with STAR story mapping |
| `application-tracker` | Planned | Pipeline management across all opportunities |
| `networking-outreach` | Planned | Outreach messages for target companies and contacts |

## Prerequisites

- **macOS** — Apple Notes integration requires `osascript`
- **Claude Code CLI v1.0.33+** — this is a Claude Code plugin, not a standalone app
- **Apple Notes** (optional but default) — digest delivery and state persistence

## Installation

Register the plugin with Claude Code, then run the setup wizard:

```shell
# 1. Clone the repo (private — requires GitHub access)
git clone https://github.com/chriscantu/job-seeker.git

# 2. Add it as a plugin marketplace source in Claude Code
/plugin marketplace add ./job-seeker

# 3. Install the plugin
/plugin install job-seeker@job-seeker-marketplace

# 4. Reload to activate
/reload-plugins
```

Then run `/setup` — it walks you through everything:
- `config/candidate.md` — your profile (name, role, strengths, accomplishments)
- `config/search.md` — target roles, location, comp floor, companies to skip
- `references/resume.pdf` — your canonical resume
- Optional: TheirStack API key for richer job discovery
- Optional: Apple Notes integration for native digest delivery

See `config/candidate.md.example` and `config/search.md.example` for templates.

## How It Works

Each skill is a prompt-based agent defined in `skills/{name}/SKILL.md`. When
invoked in Claude Code, the skill reads the candidate profile from
`config/candidate.md`, follows the voice and quality rules in
[PRINCIPLES.md](PRINCIPLES.md), and produces output to `output/{company}/`.

### State Management

State (which roles have been seen, what interests me, where I've applied)
defaults to **Apple Notes**, read and written via `osascript`. If Apple Notes
is not configured, skills fall back to markdown files in `output/`
(e.g., `output/2026-03-20-seen-postings.md`).

## Project Structure

- `config/` — candidate profile and search preferences (personal values gitignored; `.example` templates committed)
- `skills/` — one subdirectory per skill, each with a SKILL.md
- `references/` — resume, voice guide, writing samples (committed)
- `integrations/` — adapter docs, config, and specs for external systems
- `output/` — generated application materials per company (gitignored)
- [PRINCIPLES.md](PRINCIPLES.md) — voice calibration, quality standards, anti-patterns
- [STRUCTURE.md](STRUCTURE.md) — directory map and file placement rules
- [ROADMAP.md](ROADMAP.md) — what's shipped, what's next, what's cut
- [CONNECTORS.md](CONNECTORS.md) — runtime and integration inventory

## Voice

All outputs are calibrated to sound like me, not a career coach. The voice
guide (`references/voice-guide.md`) was built from my published writing and
defines rules like "teach, don't perform," "we over I," "concrete before
abstract," and "no buzzwords." If an output could have been written by anyone,
it's wrong.
