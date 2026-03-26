---
name: application-tracker
description: >
  Track job applications through the full pipeline from discovery to decision.
  Manages stage transitions, staleness alerts, and pipeline summaries.
  Triggers: "track application", "add to pipeline", "update pipeline",
  "where am I with [company]", "show pipeline", "pipeline summary",
  "mark [company] as [stage]", "I applied to [company]",
  "I had an interview at [company]", "heard back from [company]"
---

# Application Tracker

Maintains a unified application pipeline with stage transitions, staleness
alerts, and summary views. Three modes: **add** (new application), **update**
(stage transition or activity note), and **view** (pipeline summary).

---

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name
3. Read `config/search.md` — target roles (used for stage inference)
4. Glob `output/*-applications.md`, sort descending, read the most recent file.
   If no file exists, treat as empty pipeline.
5. (Optional) If `integrations/config/notes-config.md` exists, read it to get
   `plugin_root` and `default_folder` for Apple Notes sync.

---

## Mode Detection

Infer the mode from the user's message — do not ask which mode to use.

| Signal | Mode |
|--------|------|
| "track", "add to pipeline", "I applied to", mentions a new company + role | **Add** |
| "update", "mark as", "heard back", "I had an interview", "got rejected", "got an offer", mentions an existing pipeline company | **Update** |
| "show pipeline", "pipeline summary", "where am I", "application status", no specific company context | **View** |

When the message could be either add or update, check if the company already
exists in the pipeline. If it does → update. If not → add.

---

## Pipeline Stages

```
Discovery → Research → Applied → Screen → Interview (1) →
Interview (2+) → Final Round → Offer → Decision → Closed
```

### Stage Definitions

| Stage | Meaning |
|-------|---------|
| Discovery | Role identified in digest |
| Research | Company research brief generated |
| Applied | Application submitted |
| Screen | Recruiter/phone screen scheduled or completed |
| Interview (1) | First substantive interview |
| Interview (2+) | Additional interview rounds |
| Final Round | Final/panel/exec interview |
| Offer | Offer received |
| Decision | Offer accepted or negotiating |
| Closed | Terminal state — any reason |

### Close Reasons

- `accepted` — Offer accepted
- `declined` — Candidate declined the offer
- `rejected` — Company rejected at any stage
- `withdrawn` — Candidate withdrew the application
- `ghosted` — No response after 3+ weeks in any active stage
- `closed` — Role was filled or removed

---

## Mode 1: Add

**Required inputs** — ask for what you don't already have:
- Company name (required)
- Role title (required)
- Job posting URL (recommended)
- Date applied (default: today)
- Any contacts (optional)
- Notes (optional)

**Steps**:

1. Check if company + role already exists in the pipeline (case-insensitive match
   on company name). If duplicate found, warn and switch to update mode instead.
2. Check if a company research brief exists at `output/{company-slug}/company-research.md`.
   If so, note it in the entry.
3. Determine initial stage:
   - If user says they applied → `Applied`
   - If user says they're tracking/interested → `Discovery`
   - If research brief exists but no application → `Research`
   - Default: `Applied`
4. Create the entry in the Active Applications section of the state file using
   the schema below.
5. Write the state file.
6. If Apple Notes is configured, sync to `Job Search - Applications` note using
   the update (upsert) script.

---

## Mode 2: Update

**Required inputs**:
- Company name (required — fuzzy match against active applications)
- New stage or activity description

**Steps**:

1. Find the matching application by company name. Use case-insensitive substring
   matching. If multiple matches, pick the closest match. If truly ambiguous
   (e.g., two roles at the same company), ask the user to clarify.
2. Determine what changed:
   - If user specifies a stage name → transition to that stage
   - If user describes an activity (e.g., "had a phone screen") → infer the
     stage from the activity and transition
   - If user just adds a note → keep current stage, update last activity
3. Append a history entry with today's date, stage, and detail.
4. Update the entry's fields: stage, last activity date, next action.
5. If the new stage is `Closed`:
   - Ask for or infer the close reason from context
   - Add a one-sentence summary
   - Move the entry from Active Applications to Closed Applications
6. Write the state file.
7. If Apple Notes is configured, sync.

### Stage Inference from Activity

| User says | Inferred stage |
|-----------|---------------|
| "applied", "submitted application" | Applied |
| "phone screen", "recruiter call", "initial call" | Screen |
| "first interview", "technical interview", "met with hiring manager" | Interview (1) |
| "second interview", "another round", "panel interview" | Interview (2+) |
| "final round", "exec interview", "onsite" | Final Round |
| "got an offer", "they made an offer" | Offer |
| "negotiating", "accepted", "deciding" | Decision |
| "rejected", "ghosted", "withdrew", "position closed" | Closed |

---

## Mode 3: View

No inputs required. Render a pipeline summary from the state file.

**Steps**:

1. If no state file exists, report:
   "No application pipeline found. Say 'track application' to start tracking."
2. Parse all entries from both Active and Closed sections.
3. For each active entry, calculate days since last activity date.
4. Group active entries by stage category:
   - **Early** (Discovery, Research): roles not yet applied to
   - **Applied**: waiting to hear back
   - **Interviewing** (Screen through Final Round): active interview process
   - **Offer/Decision**: end-stage active
5. Flag staleness on active entries:
   - 14+ days with no activity: append ` ⚠️`
   - 21+ days: append ` 🔴` and suggest following up or marking as ghosted
6. Render the summary:

```
Application Pipeline — {today's date}
─────────────────────────────────────────────────
Applied ({count})
  {Company} — {Role}           {Stage} {date}  │ {N} days {⚠️|🔴}

Interviewing ({count})
  {Company} — {Role}           {Stage}         │ Next: {action/date}

Offer ({count})
  {Company} — {Role}           {Stage}         │ {detail}

Closed ({count})
  {Company} — {Role}           {Reason}        │ {close date}
─────────────────────────────────────────────────
{total} total │ {active} active │ {stale} stale (2+ weeks)
```

7. If there are stale applications, add:
   "Consider following up on stale applications or marking them as ghosted."

---

## State File Schema

File location: `output/YYYY-MM-DD-applications.md` (glob for most recent).

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

When creating a new state file, use today's date as the prefix. When updating
an existing file, update it in place (do not create a new file). Update the
`Last updated` timestamp on every write.

---

## Apple Notes Sync

Only if `integrations/config/notes-config.md` exists.

Read `plugin_root` from the config. Use the **update** (upsert) script to sync
the full pipeline state:

```bash
osascript {plugin_root}/scripts/apple_notes_update.applescript "Job Search - Applications" "{html_body}" "{folder}"
```

Convert the markdown state file to Apple Notes HTML following the rules in
`integrations/adapters/apple-notes.md` (use `<div>` wrapping, no `<h1>`/`<h2>`,
styled `<span>` for headings).

Apple Notes sync errors are **non-blocking** — surface the error to the user, then
continue. The markdown state file is the source of truth.

---

## Privacy Constraints

- Application state files live in `output/` (gitignored)
- Contact names are acceptable (public professionals, not PII)
- Do NOT store recruiter personal phone numbers or email addresses
- Comp discussion details go in Notes field only (not exposed in view summaries)

---

## Cross-Skill Integration

Other skills may read the applications state file directly without invoking
this skill. The state file schema above is the contract.

Skills that add notes to existing entries (cover-letter, resume-tailor) should:
1. Glob and read the applications state file
2. Find the matching company entry
3. Append to the Notes field (e.g., "Cover letter generated 2026-03-25")
4. Write the updated file

Do not create new pipeline entries from other skills without user confirmation.
Auto-tracking is OFF by default.
