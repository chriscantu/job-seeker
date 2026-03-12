# job-seeker — Product Roadmap

**Format**: Near-Term / Long-Term / Won't Do / Open Questions / Deferred
**Last updated**: 2026-03-12
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

## Near-Term — v0.4 (Queued)

### 3. Activate Planned Skills

Four skills are stubbed in `plugin.json` but have empty or placeholder SKILL.md
files. Activate in priority order:

| Skill | Why Now |
|-------|---------|
| `application-tracker` | Pipeline is growing — tracking applications in Apple Notes manually is breaking down |
| `resume-tailor` | Cover letters are live; resume customization is the natural next step |
| `company-research` | Pre-application research improves cover letter and why-this-company quality |
| `interview-prep` | Needed before any screens begin |
| `networking-outreach` | Lower priority until applications are flowing |

Each skill requires a spec in `integrations/specs/` before implementation.

### 4. Apple Notes State Layer

Formalize the three Apple Notes state notes as a proper read/write layer:

| Note | Purpose |
|------|---------|
| `Job Search - Seen Postings` | Deduplication log — every role ever surfaced |
| `Job Search - Preferences` | Source effectiveness, liked/passed signals |
| `Job Search - Applications` | Application pipeline tracker |

Define a schema for each note (fields, format, update rules) so all skills
read and write consistently. Spec required before implementation.

---

## Long-Term — v1.0+

Strategic investments for when the search is active and the pipeline needs
more structure.

### Application Pipeline as a First-Class Object

Today, application state lives in an Apple Note. As the pipeline grows past
10 active applications, a structured format (YAML front matter in the note,
or a dedicated `memory/applications/` file per company) will be needed to
support queries like "what's in phone screen?", "where am I with Maven Clinic?",
and "what follow-ups are due this week?".

**Trigger**: More than 8 active applications being tracked simultaneously.

### Interview Prep Memory

When interview prep is active for a role, store the STAR stories, behavioral
question answers, and company research in a per-company memory file
(`memory/applications/{company}/`). This allows continuity across sessions —
Claude doesn't start from scratch every time.

**Dependency**: Application tracker must be live and schema-stable first.

### Networking CRM Layer

Track networking contacts, outreach sent, responses received, and follow-up
dates in a structured format. The `networking-outreach` skill today generates
a draft — it doesn't track whether it was sent or what happened next.

**Trigger**: Active networking effort with 10+ contacts in flight.

### Offer Comparison Tool

When multiple offers arrive, a structured comparison across comp (base, bonus,
equity, vesting), role scope, mission fit, and team quality. Outputs a
decision-quality summary, not a recommendation.

**Trigger**: First offer in hand.

---

## Won't Do (Explicit Cuts)

Considered and deliberately excluded to keep the plugin focused on Chris's job
search, not on building general-purpose tooling.

| Item | Reason |
|------|--------|
| Auto-apply to jobs | Applications require human judgment and personalization — never automate the submission |
| LinkedIn automation | ToS violation risk; manual LinkedIn search is the right boundary |
| Recruiter email auto-reply | Responses to recruiters require tone judgment — always draft, never send |
| Multi-user support | This plugin is calibrated to Chris specifically — generalization would degrade quality |
| Job board scraping / crawling | Brittle, against ToS on most boards; WebSearch + WebFetch on direct URLs is sufficient |
| Salary negotiation scripting | Too high-stakes to automate — provide frameworks, not scripts |
| Cowork support | Cowork's Linux VM has no path to osascript. Claude Code on macOS is the only supported runtime. |

---

## Open Questions

1. **Apple Notes vs. local files as source of truth**: The current design treats
   Apple Notes as the source of truth with `memory/` as a local mirror. Is this
   the right call? If Notes sync is slow or unavailable, the skill degrades.
   Alternative: local `memory/` as primary, Notes as a read-friendly view.

2. **Daily digest scheduling**: Claude Code supports scheduled tasks on macOS
   where osascript is available. Once v0.3 is validated interactively, automated
   morning delivery is achievable. Deferred until manual flow is confirmed stable.

3. **Skill activation order**: Should `application-tracker` or `resume-tailor`
   come first? Tracking applications provides immediate value; resume tailoring
   compounds as applications increase.

4. **State note schema**: Should the three Apple Notes state notes use plain
   text (current), structured HTML sections (queryable by title), or a separate
   memory file format (`.md` with YAML front matter)? Decision affects all
   skills that read/write state.

5. **When does this plugin get retired?**: The plugin exists to support an
   active job search. When Chris lands a role, most skills become irrelevant.
   Plan for a clean wind-down — archiving applications, exporting the
   pipeline summary, clearing seen-postings state.

---

## Deferred Low-Impact Items

| Item | Description | Why Deferred |
|------|-------------|--------------|
| CHANGELOG.md | Version history lives only in git log. | Low priority while the plugin is single-user and actively evolving. |
| README.md polish | User-facing README could be cleaner. | Low priority while the plugin is single-user and actively evolving. |

---

## Technical Debt (surfaced in v0.3 code review)

Low-priority cleanup items identified during PR review. None block functionality.

| Item | File | Description |
|------|------|-------------|
| `plugin_root` tilde expansion | `integrations/config/notes-config.md` + `SKILL.md` | The `~` in `plugin_root` may not expand inside double-quoted `osascript` arguments. Add an explicit expansion note to SKILL.md or store an absolute path in config. |
| Redundant `set name` in update script | `scripts/apple_notes_update.applescript` | `set name of n to noteTitle` after `set body` is usually a no-op (title already matches), but it fires a modification event and creates a retry-on-success risk if it fails after the body write succeeds. Evaluate removing it. |
| `account` field unused in scripts | `integrations/config/notes-config.md` | Config declares `account: iCloud` but scripts iterate all folders globally. Add account-scoped lookup or document the field as reserved for future multi-account support. |
| Spec `Files Changed` section stale | `integrations/specs/apple-notes-integration-spec.md` | The "Files Changed" pre-implementation list diverges from what actually shipped. Git is the canonical diff record — consider removing or archiving this section from the spec. |
