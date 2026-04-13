# job-seeker

A Claude Code plugin that automates the executive job search lifecycle. Built
for a specific candidate (me), but designed so anyone can fork it, drop in their
resume, and configure it for their own search. Runs in Claude Code CLI.

## What It Does

Twelve skills that cover the full arc of a senior engineering leadership job search:

| Skill | Status | What it does |
| ----- | ------ | ------------ |
| `setup` | Active | First-time configuration wizard and ongoing health check — run this first |
| `daily-digest` | Active | Searches executive job boards (TheirStack API + web search fallback) and writes a deduplicated digest to `output/` (and Apple Notes if configured) |
| `scan-email` | Active | Scans Apple Mail for job alert emails (Indeed, LinkedIn, Wellfound, etc.), extracts postings, and trashes processed alerts |
| `company-research` | Active | Deep-dive research on a target company from a job posting URL, producing a positioning-focused brief consumed by other skills |
| `resume-tailor` | Active | Reorders and emphasizes resume bullets for a specific posting, exports to docx |
| `cover-letter` | Active | Produces a tailored cover letter that maps accomplishments to role requirements |
| `why-this-company` | Active | Generates a "Why did you apply?" response for a specific company, grounded in real career history |
| `interview-prep` | Active | Behavioral and technical interview prep with STAR story mapping, backed by Apple Calendar interview lookup |
| `follow-up` | Active | Drafts follow-up emails for stale applications and creates Gmail drafts via `scripts/gmail.js` |
| `application-tracker` | Active | Pipeline management across all opportunities — add, update, and view stages with staleness alerts |
| `linkedin-article` | Active | Drafts LinkedIn posts and articles in the candidate's voice, backed by data and voice-rule audits |
| `networking-outreach` | Planned | Outreach messages for target companies and contacts |

## Prerequisites

- **Claude Code CLI v1.0.33+** — this is a Claude Code plugin, not a standalone app
- **macOS** (optional) — required only for Apple Notes integration via `osascript`

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
- Optional: Gmail OAuth for `follow-up` (see [Gmail Integration](#gmail-integration) below)

See `config/candidate.md.example` and `config/search.md.example` for templates.

## How It Works

Each skill is a prompt-based agent defined in `skills/{name}/SKILL.md`. When
invoked in Claude Code, the skill reads the candidate profile from
`config/candidate.md`, follows the voice and quality rules in
[PRINCIPLES.md](PRINCIPLES.md), and produces output to `output/{company}/`.

### State Management

State (which roles have been seen, what interests me, where I've applied)
persists in date-prefixed markdown files in `output/` (gitignored) —
`output/*-seen-postings.md`, `output/*-preferences.md`, and
`output/*-applications.md`. Skills glob for the most recent file of each
type.

Apple Notes is an optional secondary layer: when
`integrations/config/notes-config.md` is present, `daily-digest` also writes
the digest to an Apple Notes note via `osascript`. It is not required for
the plugin to function.

### Gmail Integration

The `follow-up` skill creates Gmail drafts via `scripts/gmail.js`, a thin
CLI built on the `googleapis` package. It uses a single OAuth2 flow that
lives in `credentials/` (gitignored):

```shell
# One-time setup — opens a browser window for Google consent
bun scripts/gmail.js auth
```

Prerequisites:

- A Google Cloud project with the Gmail API enabled
- An OAuth 2.0 client (Desktop app type), downloaded as
  `credentials/gmail-client-secret.json`
- Your Google account added as a **test user** on the OAuth consent screen
  (the app stays in Testing mode — restricted scopes like `gmail.modify`
  are not suitable for Production verification for a personal tool)

Commands: `auth`, `profile`, `search`, `create-draft`, `trash`. Run
`bun scripts/gmail.js` with no arguments for full usage. Testing-mode OAuth
tokens expire after 7 days — re-run `auth` weekly.

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
