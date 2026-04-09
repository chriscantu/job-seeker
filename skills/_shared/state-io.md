# State I/O — Read and Write State Files

State persists in date-prefixed markdown files in `output/`. This module defines
the canonical patterns for reading and writing all state file types.

## Supported State Files

| Type | File pattern | Purpose |
|------|-------------|---------|
| `seen-postings` | `output/*-seen-postings.md` | Deduplication — every role ever surfaced |
| `preferences` | `output/*-preferences.md` | Interest signals, source effectiveness, last run date |
| `applications` | `output/*-applications.md` | Application pipeline tracker |

## Reading State

For each state file type needed by the current skill:

1. Glob `output/*-{type}.md`, sort descending by filename
2. Read the most recent file (first in sorted order)
3. If no file exists, treat as empty — no prior state of that type

### Dedup Set (seen-postings)

When reading `seen-postings`, build a set of all known URLs from all entries.
This set is used to prevent resurfacing roles already seen.

Skills that need richer dedup (e.g., company+title fuzzy matching) should state
the extension in their orchestrator after referencing this module.

### Last Run Date (preferences)

When reading `preferences`, parse the most recent `## YYYY-MM-DD` section header
to get the last run date. If no preferences file exists, the last run date is null.

## Writing State

### Append Pattern

1. Glob `output/*-{type}.md`, sort descending
2. If a file exists, append new entries to it
3. If no file exists, create `output/YYYY-MM-DD-{type}.md` (today's date)

### Entry Format (seen-postings)

New entries go under a `## YYYY-MM-DD` date header:

```
## YYYY-MM-DD
- {Company} | {Title} | {URL} | posted:YYYY-MM-DD
```

- `posted:YYYY-MM-DD` — the original publish date from ATS API or page metadata
- `discovered:YYYY-MM-DD` — fallback when the posted date cannot be determined
  (use today's date)
- Every entry MUST have either `posted:` or `discovered:` so all roles can be aged

### Optional Metadata Flags

Skills may append additional flags after the date field:

- `source:email-{source_label}` — which email alert source found this role
- `RESEARCHED` — company research brief has been generated
- `RESUME TAILORED` — resume has been tailored for this role
- `APPLYING` — candidate is applying to this role

### Entry Format (preferences)

```
## YYYY-MM-DD
### Source Effectiveness
- {Source}: {N} relevant roles found
```

Skills may add additional subsections (e.g., `### TheirStack Credits`,
`### Email Scan`) as appropriate.

### Entry Format (applications)

The applications state file uses a different structure from the append-only
types. See `skills/application-tracker/pipeline-schema.md` for the full schema.

**CLI subcommands for applications:**

```bash
# Read all entries (or filter by stage)
bun scripts/state.js read applications
bun scripts/state.js read applications --stage Applied

# Create a new pipeline entry
bun scripts/state.js create applications '{"company":"...","title":"...","stage":"Applied","url":"..."}'

# Transition to a new stage
bun scripts/state.js update applications --company "Company Name" --stage Screen --detail "Phone screen with recruiter"

# Append a note (e.g., after generating a cover letter or tailoring a resume)
bun scripts/state.js add-note applications --company "Company Name" --note "Cover letter generated 2026-04-09"
```

The `update` and `add-note` commands find entries by case-insensitive substring
match on company name. They auto-timestamp `lastActivity` and append to the
entry's history log. If no matching entry is found, the command exits non-zero.

Skills that call `add-note` as a side effect (e.g., cover-letter, resume-tailor)
should treat a non-zero exit as non-fatal — log a note and continue.
