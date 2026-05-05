# job-seeker — Product Roadmap

**Format**: Near-Term / Long-Term / Won't Do / Open Questions / Deferred
**Last updated**: 2026-03-26
**Owner**: Cantu

For a full history of what has shipped, see [CHANGELOG.md](CHANGELOG.md).

---

## Near-Term — v0.3 (Complete)

### 1. Claude Code Migration + Apple Notes Integration

**Status**: Shipped

Resolved the fundamental architectural mismatch: the plugin was built for
Cowork but Cowork runs in a Linux VM with no path to `osascript`. Decision:
abandon Cowork, run exclusively in Claude Code CLI on macOS where `osascript`
is in PATH and callable via the Bash tool — matching the eisenhower pattern.

**Shipped**:
- `scripts/apple_notes_create.applescript` — creates digest note; dedup replaces
- `scripts/apple_notes_read.applescript` — reads state notes as plaintext
- `scripts/apple_notes_update.applescript` — upserts state notes
- `scripts/apple_notes_list.applescript` — lists notes in a folder
- `integrations/adapters/apple-notes.md` — field mapping, invocation, error handling
- `integrations/config/notes-config.md.example` — plugin_root, folder, account
- `integrations/docs/apple-notes-test-protocol.md` — 10-step manual test protocol
- `integrations/specs/apple-notes-integration-spec.md` — spec before implementation
- `CONNECTORS.md` — runtime documented: Claude Code on macOS, Bash/osascript
- `PRINCIPLES.md` — hard rule added: Claude Code only, no Cowork
- `STRUCTURE.md`, `README.md`, `CLAUDE.md` — updated throughout
- `skills/daily-digest/SKILL.md` — full rewrite: Bash tool, direct osascript
- Deleted: `scripts/apple-notes-mcp/`, `.mcp.json`, `scripts/build-plugin.sh`,
  `scripts/setup-mcp.sh`, stale planning docs

**Validation complete**: All 10 steps of the test protocol passed (2026-03-11).
Two bugs were found and fixed in the same PR: note-matching always returned the
first note (broken `lower()` helper); update script silently renamed notes on body
write. Protocol caveats documented in `integrations/docs/apple-notes-test-protocol.md`.

---

### 2. CHANGELOG.md

Create a CHANGELOG.md to separate shipping history from forward-looking plans,
matching the eisenhower pattern. Version history currently lives only in git log.

---

## Near-Term — v0.4 (In Progress)

### 3. Activate Planned Skills

Skills stubbed in `plugin.json` with placeholder SKILL.md files. Activate in
priority order:

| Skill | Status | Why Now |
| ----- | ------ | ------- |
| `application-tracker` | **Shipped** | Pipeline tracking in structured markdown — replaced manual Apple Notes tracking |
| `company-research` | **Shipped** | Force multiplier — research briefs feed into cover-letter, why-this-company, interview-prep, and resume-tailor |
| `resume-tailor` | **Shipped** | Cover letters are live; resume customization is the natural next step |
| `scan-email` | **Shipped** | Surfaces job alerts from Apple Mail that board searches miss — adapted from eisenhower scan-email pattern |
| `interview-prep` | **Shipped** | STAR story mapping + Apple Calendar adapter for interview lookup (PR #15/#54) |
| `follow-up` | **Shipped** | Drafts stale-application follow-ups via `scripts/gmail.ts` — Gmail CLI replaces MCP for a single OAuth2 flow (PR #55) |
| `linkedin-article` | **Shipped** | Drafts LinkedIn posts and articles in the candidate's voice with voice-rule audits |
| `networking-outreach` | Planned | Lower priority until applications are flowing |

Each skill requires a spec in `integrations/specs/` before implementation.

### 4. State Layer — output/ as Primary *(Shipped)*

**Status**: Shipped (PR #9, 2026-03-25)

State persists in date-prefixed markdown files in `output/` (gitignored):

| File pattern | Purpose |
|-------------|---------|
| `output/*-seen-postings.md` | Deduplication log — every role ever surfaced |
| `output/*-preferences.md` | Interest signals, liked/passed roles, source effectiveness |
| `output/*-applications.md` | Application pipeline tracker |

Apple Notes is an optional secondary layer — `daily-digest` writes there when
`integrations/config/notes-config.md` is present. It is not required for the
plugin to function.

### 5. Candidate-Agnostic Configuration *(Shipped)*

**Status**: Shipped (PR #9, 2026-03-25)

Any job seeker can clone this repo, drop in their resume and writing samples,
fill out `config/candidate.md` and `config/search.md`, and have every skill
work — without touching CLAUDE.md or hardcoded profile strings.

**Shipped**:
- `config/candidate.md.example` + `config/search.md.example` — config templates
- `scripts/validate-config.ts` — validates config presence and required fields
- `scripts/validate-structure.ts` — three-way cross-reference: STRUCTURE.md ↔ filesystem ↔ plugin.json
- All 10 skills updated: config reads in "Before You Start", candidate-agnostic language
- CLAUDE.md, PRINCIPLES.md, STRUCTURE.md — thinned to point at config files
- State layer flipped: `output/` primary, Apple Notes optional secondary
- `memory/job-search/` directory removed (superseded by `output/` state files)
- CI: both validators run in `.github/workflows/ci.yml`

**Spec**: `integrations/specs/candidate-agnostic-config-spec.md`

---

## Long-Term — v1.0+

Strategic investments for when the search is active and the pipeline needs
more structure.

### Application Pipeline as a First-Class Object

Today, application state lives in `output/*-applications.md`. As the pipeline
grows past 10 active applications, a structured format (YAML front matter or
a dedicated file per company) will be needed to support queries like "what's
in phone screen?", "where am I with Maven Clinic?", and "what follow-ups are
due this week?".

**Trigger**: More than 8 active applications being tracked simultaneously.

### Interview Prep Memory

When interview prep is active for a role, store the STAR stories, behavioral
question answers, and company research in a per-company output file
(`output/{company-slug}/interview-prep.md`). This allows continuity across
sessions — Claude doesn't start from scratch every time.

**Dependency**: Application tracker must be live and schema-stable first.

### Networking CRM Layer

Track networking contacts, outreach sent, responses received, and follow-up
dates in a structured format. The `networking-outreach` skill today generates
a draft — it doesn't track whether it was sent or what happened next.

**Trigger**: Active networking effort with 10+ contacts in flight.

### Email Scanning — Apple Mail Integration *(Shipped)*

**Status**: Shipped (2026-03-26)

Scans Apple Mail inbox for job alert emails using osascript (read-only).
Adapted from the eisenhower `scan-email` pattern with architectural
improvements: external AppleScript files (testable, reusable), HTML source
extraction for reliable URL parsing, classification patterns in a reference
file (DRY/Open-Closed), and Apple Mail availability check.

**v1 scope**: Job alert extraction only (Indeed, LinkedIn, Glassdoor,
RemoteHunter, Wellfound, Google Alerts, Otta, ZipRecruiter, Built In, Hired).
Application status tracking and recruiter outreach detection documented as
v2 enhancements.

**Files**: `skills/scan-email/SKILL.md`, `scripts/apple_mail_scan.applescript`,
`scripts/apple_mail_read.applescript`, `references/email-patterns.md`,
`integrations/adapters/apple-mail.md`, `integrations/config/mail-config.md.example`,
`integrations/specs/apple-mail-scan-spec.md`.

**Spec**: `integrations/specs/apple-mail-scan-spec.md`

### Scan Email — Trash Processed Alerts (v1.1) *(Shipped)*

**Status**: Shipped (2026-03-26)

After Phase 6 state writes complete, processed job alert emails are moved
to Trash. Only emails that matched a job alert sender AND had their body
fetched are trashed — skipped/unmatched emails remain in inbox. Trashed
in descending index order to prevent index shifting.

**Files**: `scripts/apple_mail_trash.applescript`, updated SKILL.md Phase 6,
adapter doc, spec, config example, STRUCTURE.md.

### Offer Comparison Tool

When multiple offers arrive, a structured comparison across comp (base, bonus,
equity, vesting), role scope, mission fit, and team quality. Outputs a
decision-quality summary, not a recommendation.

**Trigger**: First offer in hand.

---

## Won't Do (Explicit Cuts)

Considered and deliberately excluded to keep the plugin focused on the active
job search, not on building general-purpose tooling.

| Item | Reason |
|------|--------|
| Auto-apply to jobs | Applications require human judgment and personalization — never automate the submission |
| LinkedIn automation | ToS violation risk; manual LinkedIn search is the right boundary |
| Recruiter email auto-reply | Responses to recruiters require tone judgment — always draft, never send |
| Concurrent multi-user support | Running the plugin for multiple active job seekers simultaneously is out of scope. One instance = one candidate. Portability (clone → configure → use) is v0.4 item #5. |
| Job board scraping / crawling | Brittle, against ToS on most boards; WebSearch + WebFetch on direct URLs is sufficient |
| Salary negotiation scripting | Too high-stakes to automate — provide frameworks, not scripts |
| Cowork support | Cowork's Linux VM has no path to osascript. Claude Code on macOS is the only supported runtime. |

---

## Open Questions

1. **Daily digest scheduling**: Claude Code supports scheduled tasks on macOS
   where osascript is available. Once manual flow is confirmed stable, automated
   morning delivery is achievable.

2. **When does this plugin get retired?**: The plugin exists to support an
   active job search. When the candidate lands a role, most skills become
   irrelevant. Plan for a clean wind-down — archiving applications, exporting
   the pipeline summary, clearing seen-postings state.

### Resolved

| Question | Resolution | Date |
|----------|-----------|------|
| Apple Notes vs. local files as source of truth | `output/` markdown files are primary; Apple Notes is optional secondary | 2026-03-25 |
| State note schema | Date-prefixed markdown in `output/` with section headers per day | 2026-03-25 |
| Skill activation order | application-tracker → company-research → resume-tailor → scan-email (all shipped) | 2026-03-26 |

---

## Deferred Low-Impact Items

| Item | Description | Why Deferred |
|------|-------------|--------------|
| CHANGELOG.md | Version history lives only in git log. | Low priority while the plugin is single-user and actively evolving. |
| README.md polish | User-facing README could be cleaner. | Low priority while the plugin is single-user and actively evolving. |

---

## Technical Debt

Items identified during code review and development. None block functionality.

### Posting Date Tracking *(Shipped)*

**Status**: Shipped (2026-03-26)

All 5 skills that write to `output/*-seen-postings.md` now include a date
field on every entry: `posted:YYYY-MM-DD` (original ATS posting date) or
`discovered:YYYY-MM-DD` (fallback when posting date is unavailable). This
enables tracking discovery lag — how old a posting is when we first find it.

Sources: TheirStack `date_posted`, Greenhouse `updated_at`, Lever `createdAt`.
Ashby public API does not expose posting dates; entries use `discovered:` fallback.

### Hardcoded search queries in daily-digest (surfaced in v0.4)

`skills/daily-digest/SKILL.md` reads filter criteria from `config/search.md` but the
actual search queries (Phases 1b, 1c, LinkedIn automation, weekly reminder
sites) have hardcoded "VP Engineering" / "Senior Director Engineering" titles
and exec-level board URLs. A user targeting different role levels or industries
would get searches that find the wrong roles.

**Fix**: Templatize search queries to use `Target Role Titles` from
`config/search.md`. Make niche board URLs and weekly reminder sites
configurable (or at least documented as "edit these for your search").

**Priority**: Medium — daily-digest works for the current search but isn't
truly portable without this fix.

### v0.3 code review items

| Item | File | Description |
|------|------|-------------|
| `plugin_root` tilde expansion | `integrations/config/notes-config.md` + `SKILL.md` | The `~` in `plugin_root` may not expand inside double-quoted `osascript` arguments. Add an explicit expansion note to SKILL.md or store an absolute path in config. |
| Redundant `set name` in update script | `scripts/apple_notes_update.applescript` | `set name of n to noteTitle` after `set body` is usually a no-op (title already matches), but it fires a modification event and creates a retry-on-success risk if it fails after the body write succeeds. Evaluate removing it. |
| `account` field unused in scripts | `integrations/config/notes-config.md` | Config declares `account: iCloud` but scripts iterate all folders globally. Add account-scoped lookup or document the field as reserved for future multi-account support. |
| Spec `Files Changed` section stale | `integrations/specs/apple-notes-integration-spec.md` | The "Files Changed" pre-implementation list diverges from what actually shipped. Git is the canonical diff record — consider removing or archiving this section from the spec. |
