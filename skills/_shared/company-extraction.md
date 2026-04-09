# Company Extraction

Parse company name and metadata from a job posting URL.

## Extraction Process

WebFetch the job posting URL. From the page content, extract:

| Field | Source |
|-------|--------|
| Company name | Page title, meta tags, or ATS page structure |
| Role title | Job title from the posting |
| Location | Location field from the posting |
| Company website domain | Links on the page, or derive from ATS URL pattern |

## Derive Company Slug

From the company name, derive `{company-slug}`:
- Lowercase
- Replace spaces with hyphens
- Remove special characters (parentheses, ampersands, periods, etc.)

Examples:
- "Maven Clinic" → `maven-clinic`
- "O'Reilly Media" → `oreilly-media`
- "GitLab" → `gitlab`
- "Built In" → `built-in`

## Create Output Directory

If `output/{company-slug}/` does not exist, create it. All per-company
artifacts (resumes, cover letters, research briefs) go in this directory.

## Error Handling

| Condition | Action |
|-----------|--------|
| URL returns 404 or is unparseable | Stop: "Could not access that posting. Is the URL correct?" |
| Company name cannot be determined | Stop: "Could not identify the company from this page. Try providing the company name directly." |
