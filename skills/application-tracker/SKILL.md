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
alerts, and summary views. Three modes: **add**, **update**, and **view**.

---

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

## Phase 0a — Load State

Read `skills/_shared/state-io.md` and execute the **read** pattern for `applications`.
If no file exists, treat as empty pipeline.

If `integrations/config/notes-config.md` exists, read it to get `plugin_root`
and `default_folder` for Apple Notes sync later.

---

## Mode Detection

Infer the mode from the user's message — do not ask which mode to use.

| Signal | Mode |
|--------|------|
| "track", "add to pipeline", "I applied to", mentions a new company + role | **Add** |
| "update", "mark as", "heard back", "I had an interview", "got rejected", "got an offer", mentions an existing pipeline company | **Update** |
| "show pipeline", "pipeline summary", "where am I", "application status", no specific company context | **View** |

When the message could be either add or update, check if the company already
exists in the pipeline. If it does, switch to update. If not, switch to add.

---

## Mode 1: Add

Read `skills/application-tracker/pipeline-schema.md` for stage definitions and
state file schema.

**Required inputs** — ask for what you don't have: company name (required),
role title (required), job posting URL (recommended), date applied (default:
today), contacts (optional), notes (optional).

1. Check if company + role already exists (case-insensitive). If duplicate, warn and switch to update.
2. Check for research brief at `output/{company-slug}/company-research.md`.
3. Determine initial stage: user says applied → `Applied`; tracking/interested → `Discovery`; research brief exists → `Research`; default → `Applied`.
4. Create entry in Active Applications using schema from `pipeline-schema.md`.
5. Write state file (update in place, refresh `Last updated` timestamp).
6. If Apple Notes configured, proceed to Apple Notes Sync below.

---

## Mode 2: Update

Read `skills/application-tracker/pipeline-schema.md` for stage inference table.

**Required inputs**: company name (fuzzy match against active apps), new stage
or activity description.

1. Find matching application by company name (case-insensitive substring). If ambiguous (two roles at same company), ask user to clarify.
2. Determine what changed: explicit stage name → transition; activity description → infer stage from `pipeline-schema.md`; note only → keep stage, update last activity.
3. Append history entry with today's date, stage, and detail.
4. Update entry fields: stage, last activity date, next action.
5. If new stage is `Closed`: ask for/infer close reason, add one-sentence summary, move entry from Active to Closed Applications.
6. Write the state file.
7. If Apple Notes configured, proceed to Apple Notes Sync below.

---

## Mode 3: View

Read `skills/application-tracker/pipeline-schema.md` for rendering template and
stage groupings.

1. If no state file exists, report: "No application pipeline found. Say 'track application' to start tracking."
2. Parse all entries from Active and Closed sections.
3. For each active entry, calculate days since last activity date.
4. Group and render using the template from `pipeline-schema.md`.
5. If stale applications exist (14+ days), add: "Consider following up on stale applications or marking them as ghosted."

---

## Apple Notes Sync

Read `skills/_shared/apple-notes.md` and execute. Use the **update** (upsert)
operation with title `{prefix} - Applications` where `{prefix}` is the Apple
Notes Prefix from `config/search.md` (default: `Job Search`). Convert the markdown state
file to Apple Notes HTML following the rules in that module.

---

## Cross-Skill Integration

Other skills may read the applications state file directly without invoking
this skill. The state file schema in `pipeline-schema.md` is the contract.

Skills that add notes to existing entries (cover-letter, resume-tailor) should:
1. Glob and read the applications state file
2. Find the matching company entry
3. Append to the Notes field (e.g., "Cover letter generated 2026-03-25")
4. Write the updated file

Do not create new pipeline entries from other skills without user confirmation.
Auto-tracking is OFF by default.
