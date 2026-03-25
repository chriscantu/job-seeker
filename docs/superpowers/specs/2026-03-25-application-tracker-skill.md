# Design Spec: Application Tracker Skill

**Date**: 2026-03-25
**Status**: Implemented
**Author**: Chris Cantu + Claude

---

## Problem

Every skill in the plugin references the application tracker as "deferred to
the `application-tracker` skill" — but it doesn't exist yet. This creates
three gaps:

1. **No pipeline visibility**: Chris has no single view of where each
   application stands. State is scattered across seen-postings (discovery),
   why-this-company outputs (research), and cover letter outputs (applied).
2. **No staleness detection**: Applications that go silent for 2+ weeks
   aren't surfaced. Without tracking, opportunities quietly die.
3. **No lifecycle closure**: The plugin handles discovery → research → apply
   but has no way to record outcomes (offer, rejection, withdrawal).

**Target**: A skill that maintains a unified application pipeline with stage
transitions, staleness alerts, and summary views.

---

## Decision

Implement `application-tracker` as a full skill backed by a state file at
`output/*-applications.md`. The skill supports three modes: **add** (new
application), **update** (stage transition), and **view** (pipeline summary).

### State File Location

Primary: `output/*-applications.md` (same glob pattern as other state files)
Secondary: Apple Notes `{prefix} - Applications` (if notes-config exists)

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Track in seen-postings | Different concern — seen-postings is dedup, not pipeline |
| External tool (Notion, Trello) | Adds a dependency; state should live where the plugin can read it |
| JSON state file | Markdown is readable by humans and Claude; no parsing scripts needed |

---

## Pipeline Stages

```
Discovery → Research → Applied → Screen → Interview (1) →
Interview (2+) → Final Round → Offer → Decision → Closed
```

### Stage Definitions

| Stage | Meaning | Entry Trigger |
|-------|---------|--------------|
| Discovery | Role identified in digest | `daily-digest` adds to seen-postings |
| Research | Company research brief generated | `company-research` or `why-this-company` runs |
| Applied | Application submitted | User confirms submission |
| Screen | Recruiter/phone screen scheduled or completed | User update |
| Interview (1) | First substantive interview | User update |
| Interview (2+) | Additional interview rounds | User update |
| Final Round | Final/panel/exec interview | User update |
| Offer | Offer received | User update |
| Decision | Offer accepted or negotiating | User update |
| Closed | Terminal state — any reason | User update with close reason |

### Close Reasons

- `accepted` — Offer accepted
- `declined` — Chris declined the offer
- `rejected` — Company rejected at any stage
- `withdrawn` — Chris withdrew the application
- `ghosted` — No response after 3+ weeks in any active stage
- `closed` — Role was filled or removed

---

## State File Schema

```markdown
# Application Pipeline

Last updated: {YYYY-MM-DD}

## Active Applications

### {Company} — {Role Title}
- **Stage**: {current stage}
- **Applied**: {YYYY-MM-DD}
- **Last activity**: {YYYY-MM-DD} — {what happened}
- **Next action**: {what needs to happen next}
- **Contacts**: {names/roles if known}
- **URL**: {job posting URL}
- **Notes**: {freeform}

#### History
- {YYYY-MM-DD}: {stage} — {detail}
- {YYYY-MM-DD}: {stage} — {detail}

---

## Closed Applications

### {Company} — {Role Title}
- **Stage**: Closed ({reason})
- **Applied**: {YYYY-MM-DD}
- **Closed**: {YYYY-MM-DD}
- **Summary**: {1-sentence outcome}

#### History
- {YYYY-MM-DD}: {stage} — {detail}
```

---

## Skill Modes

### Mode 1: Add (`track application`, `add to pipeline`)

**Inputs** (ask for what's missing):
- Company name (required)
- Role title (required)
- Job posting URL (recommended)
- Date applied (default: today)
- Any contacts (optional)
- Notes (optional)

**Behavior**:
1. Check if company+role already exists in pipeline → warn if duplicate
2. Check if a `company-research.md` brief exists → link if so
3. Add entry to Active Applications section
4. Set stage to `Applied` (or earlier if not yet applied)
5. Write state file
6. Write to Apple Notes if configured

### Mode 2: Update (`update pipeline`, `where am I with {company}`)

**Inputs**:
- Company name (required — fuzzy match against active applications)
- New stage or activity update

**Behavior**:
1. Find the matching application (fuzzy match on company name)
2. If ambiguous, ask user to clarify
3. Append to History log
4. Update current stage, last activity date, next action
5. If stage is terminal (Closed), move to Closed Applications section
6. Write state file + Apple Notes

### Mode 3: View (`show pipeline`, `pipeline summary`, `where am I`)

**Output format**:

```
Application Pipeline — {date}
─────────────────────────────────────────────────
Applied (2)
  Natera — VP Engineering        Applied Mar 10  │ 15 days ⚠️
  GitLab — Sr Dir Engineering    Applied Mar 20  │ 5 days

Interviewing (1)
  Headspace — VP Engineering     Interview 1     │ Next: Mar 27

Closed (1)
  Crane — VP Engineering         Rejected        │ Mar 18
─────────────────────────────────────────────────
4 total │ 3 active │ 1 stale (2+ weeks)
```

**Staleness rules**:
- ⚠️ after 14 days with no activity in any active stage
- 🔴 after 21 days — suggest marking as ghosted or following up

---

## Cross-Skill Integration

### Skills that write to the tracker

| Skill | When | What it writes |
|-------|------|---------------|
| `daily-digest` | Role surfaced | Discovery entry (if auto-tracking enabled) |
| `why-this-company` | User says "yes, apply" | Research → Applied transition |
| `cover-letter` | Letter generated | Notes: "Cover letter generated" |
| `resume-tailor` | Resume customized | Notes: "Resume tailored" |

### Skills that read from the tracker

| Skill | What it reads |
|-------|--------------|
| `interview-prep` | Current stage, contacts, history — to tailor prep |
| `networking-outreach` | Contacts, stage — to craft contextual outreach |
| `daily-digest` | Active companies — to deprioritize roles at companies already in pipeline |

**Note on auto-tracking**: Discovery-stage auto-tracking (every digest role
creates a pipeline entry) could generate noise. Default: OFF. Only create
entries when the user explicitly says to track a role. Skills add notes to
existing entries but don't create new ones without user confirmation.

---

## SessionStart Hook Integration

The `SessionStart` hook (see quick wins) reads the applications state file
to show the pipeline one-liner:

```
📋 Last digest: Mar 24 | Active applications: 3 | Stale (2+ weeks): 1 (Natera)
```

This creates passive visibility without requiring the user to invoke the skill.

---

## Privacy Constraints

- Application state files live in `output/` (gitignored)
- Contact names are acceptable (they're public professionals, not PII)
- Do not store recruiter personal phone numbers or email addresses
- Comp discussion details stay in Notes (not exposed in summary views)

---

## Success Criteria

1. `show pipeline` renders a clean summary table of all active applications
2. Updating a stage appends to history and updates the summary
3. Stale applications (14+ days) are flagged in the summary view
4. Other skills can read pipeline state without invoking the tracker
5. Apple Notes sync works when configured (optional)
6. `/pipeline` command (quick win) is a thin alias for Mode 3
