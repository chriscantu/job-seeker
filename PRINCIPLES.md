# Principles

These principles govern all skills, scripts, and outputs in the job-seeker
plugin. Read this file fully before producing any deliverable.

---

## Runtime: Claude Code on macOS

This plugin runs exclusively in Claude Code CLI on macOS. Native app
integration (Apple Notes, Calendar) uses `osascript` called directly via
the Bash tool — no MCP servers, no background daemons, no Cowork.

---

## How We Work

- **JS/TS only** — All scripts in `scripts/` run via `node`. No Python.
  AppleScript files are exempt (macOS-native, no JS equivalent).
- **Don't duplicate config** — Candidate profile and search preferences live in
  `config/candidate.md` and `config/search.md`. Skills read them; they don't
  hardcode them. Never copy profile data into a skill file.
- **Small commits** — Commit after each logical unit. Show the diff, get sign-off.
- **No deviations without approval** — Architectural changes, new dependencies,
  and new patterns require explicit user confirmation.

---

## Output Directory

All generated deliverables go in `output/` under a **per-company subdirectory**.

```
output/
  natera/
    {Name}_Resume_Natera.md
    {Name}_Resume_Natera.docx
    {Name}_CoverLetter_Natera.md
    {Name}_CoverLetter_Natera.docx
    why-this-company-natera.md
```

- Company slug = lowercase, no spaces (e.g., `natera`, `gitlab`)
- All artifacts for one company go in one directory — no splitting by type
- Filename convention: `{Name}_{ArtifactType}_{Company}.{ext}` — where `{Name}` is
  the candidate's name from `config/candidate.md` with spaces replaced by underscores
- Default format is `.docx` (+ `.md` source) — no PDF exports

---

## State Continuity

`output/` markdown files are the source of truth for state that persists across
sessions (seen postings, preferences, applications). Skills read the most recent
`output/*-{state-type}.md` file via glob before acting and append to it after
completing. If no file exists, create one with today's date prefix:
`output/YYYY-MM-DD-{state-type}.md`.

Apple Notes is an optional personal integration — `daily-digest` writes there
as a secondary layer when `integrations/config/notes-config.md` is configured,
but it is not required for the plugin to function. New users: see
`integrations/adapters/apple-notes.md` to enable it.

State files live at the `output/` root. Per-company artifacts (cover letters,
resumes) live in `output/{company-slug}/`. Both patterns coexist with no conflict.

Every skill reads relevant state before acting and writes state after completing.
Never show a role that's already been seen. Never ask for information that's
already stored. Respect the candidate's time.

---

## Privacy

- Never include current compensation in external-facing documents
- Never mention active job searching in shareable outputs
- Personal contact info only where explicitly needed
- Config files with personal values are gitignored; only `.example` templates
  are committed

---

## Writing Quality

All outputs — cover letters, "why this company" responses, interview prep —
must meet these standards. See `references/voice-guide.md` for full calibration.

**Voice:** Friendly pragmatist. Teach, don't perform. "We" for team work,
"I" for personal decisions. Concrete before abstract. No buzzwords.

**Quantify everything.** Vague claims like "improved team performance" are
unacceptable when "reduced deployment cycle from 6 months to minutes" is
available. Every paragraph should contain at least one specific number.

**Respect the level.** The candidate is interviewing for Senior Director and
VP roles. Write like a leader who partners with VPs and shapes company
direction — not like a senior engineer applying for a staff role.

**Mission alignment is not performative.** Connect genuine career threads to
the company's mission. If the connection is thin, say so honestly rather
than manufacturing enthusiasm.

**Anti-patterns:**
- "I'm passionate about driving organizational excellence"
- "I'm uniquely positioned to leverage my experience"
- "I've been fortunate enough to lead..."
- Anything that sounds like a LinkedIn influencer or a career coach
