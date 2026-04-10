# Frontmatter — Structured Metadata for Skill Output Files

All per-company skill output files include a YAML frontmatter block before
the markdown body. This gives downstream skills structured, parseable metadata
without relying on header names or prose conventions.

## Common Base Fields

Every skill output file includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| `skill` | string | Producing skill name (e.g., `company-research`, `resume-tailor`, `cover-letter`) |
| `company` | string | Company display name |
| `slug` | string | Company slug (directory name in `output/`) |
| `role` | string | Role title from the job posting |
| `url` | string | Job posting URL |
| `generated` | date | Date this file was generated (YYYY-MM-DD) |

## Type-Specific Fields

### company-research

| Field | Type | Description |
|-------|------|-------------|
| `rating` | integer 1-5 | Overall fit rating from research scoring |
| `remote` | boolean | Whether the role is remote-eligible |
| `positioning_count` | integer | Number of positioning bullets in the brief |
| `gaps_count` | integer | Number of gaps/open questions |

### resume-tailor

| Field | Type | Description |
|-------|------|-------------|
| `research_date` | date | `generated` date from the company-research brief used (if any) |
| `requirements_matched` | integer | Number of job requirements matched to accomplishments |

### cover-letter

| Field | Type | Description |
|-------|------|-------------|
| `word_count` | integer | Word count of the cover letter body |

## Writing Frontmatter (Producers)

When writing a skill output file, include the frontmatter block before the
markdown body. Use `---` delimiters. Quote any value that contains a colon.

Example:

    ---
    skill: company-research
    company: Natera
    slug: natera
    role: VP of Engineering, UX/Commercial Applications
    url: "https://job-boards.greenhouse.io/natera/jobs/5814300004"
    generated: 2026-04-08
    rating: 4
    remote: true
    positioning_count: 3
    gaps_count: 2
    ---

    # Natera — Research Brief
    ...

## Reading Frontmatter (Consumers)

When reading another skill's output file, check the frontmatter block first:

1. If the file starts with `---`, read the YAML block up to the closing `---`
2. Use frontmatter fields for routing decisions:
   - `generated` — is this research stale? (older than 7 days = suggest re-running)
   - `rating` — should the candidate prioritize this company?
   - `positioning_count` — does the brief have positioning data to use?
3. Then read the prose body for content (Positioning section, Gaps, etc.)

If the file does NOT start with `---`, treat it as a legacy file with no
frontmatter — proceed with header-based reading. This ensures backward
compatibility with files generated before frontmatter was added.

## Central State Files

In addition to per-company skill output files, the three central state files
also use frontmatter. These are managed by the parsers in `scripts/lib/`.

### Shared Fields

| Field            | Type    | Description                                 |
|------------------|---------|---------------------------------------------|
| `format_version` | integer | Format version (currently `1`)              |
| `last_updated`   | date    | Date the file was last written (YYYY-MM-DD) |

### applications.md

| Field          | Type    | Description                                       |
|----------------|---------|---------------------------------------------------|
| `active_count` | integer | Number of active applications (computed on write) |
| `closed_count` | integer | Number of closed applications (computed on write) |

### seen-postings.md and preferences.md

Use only the shared fields (`format_version`, `last_updated`). No computed fields.
