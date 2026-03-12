# job-seeker — Product Roadmap

**Format**: Near-Term / Long-Term / Won't Do / Open Questions / Deferred
**Last updated**: 2026-03-11
**Owner**: Cantu

For a full history of what has shipped, see [CHANGELOG.md](CHANGELOG.md).

---

## Near-Term — v0.3 (In Progress)

### 1. Apple Notes Integration Rewrite (Direct Script Pattern)

**Spec**: `integrations/specs/apple-notes-integration-spec.md`
**Status**: Spec complete, implementation in progress

Replace the broken MCP server approach with direct AppleScript calls, mirroring
the proven eisenhower plugin pattern. The MCP server was never invoked at runtime
— Cowork does not launch custom plugin MCP servers. The eisenhower pattern (direct
`osascript` calls from skill instructions, no background daemon) is the correct
architecture for all macOS native app integrations.

**Deliverables**:
- `scripts/apple_notes_create.applescript`
- `scripts/apple_notes_read.applescript`
- `scripts/apple_notes_update.applescript`
- `scripts/apple_notes_list.applescript`
- `integrations/adapters/apple-notes.md` — field mapping, invocation, error handling
- `integrations/config/notes-config.md.example` — plugin_root, folder, account
- `integrations/docs/apple-notes-test-protocol.md` — manual test protocol
- Updated `skills/daily-digest/SKILL.md` — remove MCP references, add direct calls
- Removal of `scripts/apple-notes-mcp/` and `.mcp.json`

**Dependency**: None. Unblocked.

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

---

## Open Questions

1. **Apple Notes vs. local files as source of truth**: The current design treats
   Apple Notes as the source of truth with `memory/` as a local mirror. Is this
   the right call? If Notes sync is slow or unavailable, the skill degrades.
   Alternative: local `memory/` as primary, Notes as a read-friendly view.

2. **Daily digest scheduling**: The digest currently requires an interactive
   Cowork session. A scheduled task could run it automatically each morning —
   but scheduled tasks run in the Linux VM without osascript access. Is there
   a path to automated delivery once the direct-script pattern is validated?

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
| Remove `.mcp.json` from repo | The file is untracked but exists in the working directory. Should be deleted and added to `.gitignore`. | Blocked on completing the Apple Notes rewrite first — want to verify the replacement works before removing the old approach entirely. |
| Remove `scripts/apple-notes-mcp/` | Full MCP server directory. Untracked, not committed. | Same as above — delete after v0.3 is validated. |
| `skills/daily-digest/SKILL.md` MCP references | Still references MCP tools in some sections. Needs full rewrite to direct-script pattern. | Spec is complete; implementation is next in queue. |
| README.md for the plugin | No user-facing README exists. Useful once the plugin is shared or reinstalled. | Low priority while the plugin is single-user and actively evolving. |
