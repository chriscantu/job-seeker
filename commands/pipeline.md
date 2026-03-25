---
name: pipeline
description: >
  Show a summary of all active job applications with stages, staleness
  warnings, and next actions. Triggers: /pipeline, "show pipeline",
  "where am I", "application status"
allowed-tools: Read, Glob, Bash
---

# Pipeline Summary

Show a quick view of the current application pipeline.

## Steps

1. Glob `output/*-applications.md`, sort descending, read the most recent file.
   If no file exists, report: "No application pipeline found. Use the
   application-tracker skill to start tracking."

2. Parse the Active Applications and Closed Applications sections.

3. For each active application, calculate days since last activity.
   Flag staleness:
   - 14+ days with no activity: ⚠️
   - 21+ days: 🔴

4. Render a compact summary table:

```
Application Pipeline — {date}
─────────────────────────────────────────────────
Applied (N)
  {Company} — {Role}           {Stage}  │ {days} days {⚠️ if stale}

Interviewing (N)
  {Company} — {Role}           {Stage}  │ Next: {date or action}

Closed (N)
  {Company} — {Role}           {Reason} │ {close date}
─────────────────────────────────────────────────
{total} total │ {active} active │ {stale} stale
```

5. If there are stale applications (14+ days), add a suggestion:
   "Consider following up on stale applications or marking them as ghosted."
