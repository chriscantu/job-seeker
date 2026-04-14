# Pipeline Schema — Stage Definitions, Transitions & State Format

Reference module for the application-tracker skill. Defines the pipeline
stages, close reasons, activity-to-stage inference, and the canonical state
file schema.

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

## Stage Inference from Activity

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

## View Mode Rendering Template

Group active entries by stage category:
- **Early** (Discovery, Research): roles not yet applied to
- **Applied**: waiting to hear back
- **Interviewing** (Screen through Final Round): active interview process
- **Offer/Decision**: end-stage active

Staleness thresholds for active entries:
- 14+ days with no activity: append ` ⚠️`
- 21+ days: append ` 🔴` and suggest following up or marking as ghosted

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

---

## Skill-Generated Notes

Some skills write to the pipeline automatically via `add-note`. These are
informational — they do not change the stage.

| Skill | Note format |
|---|---|
| `/evaluate` | `"Evaluation complete — score: X.X/5, archetype: {archetype}, recommendation: {apply\|borderline\|pass}"` |
| `resume-tailor` | `"Resume tailored {YYYY-MM-DD}"` |
| `cover-letter` | `"Cover letter generated {YYYY-MM-DD}"` |

---

## Privacy Constraints

- Application state files live in `output/` (gitignored)
- Contact names are acceptable (public professionals, not PII)
- Do NOT store recruiter personal phone numbers or email addresses
- Comp discussion details go in Notes field only (not exposed in view summaries)
