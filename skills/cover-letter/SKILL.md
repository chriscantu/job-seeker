---
name: cover-letter
description: >
  Generate a tailored cover letter for a specific company and role.
  Triggers: "cover letter", "write a cover letter for [company]",
  "application letter", "apply to [company]". Produces a professional
  .docx cover letter (plus .md source) that maps the candidate's specific
  accomplishments to the role requirements.
---

# Cover Letter Generator

Creates a tailored, executive-level cover letter that maps the candidate's specific
accomplishments to a role's requirements. Every letter should feel like it
could only have been written for this specific role.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read these additional files:
- `references/resume.md` — canonical markdown resume for full detailed accomplishments
- `references/voice-guide.md` — always read; the abstract rules for Chris's voice.
- Glob `references/writing-samples/*.md` (skip `README.md`) — read every sample.
  These are Chris's **actual published prose**. Do not just absorb the gist —
  study the sentence-level texture: he writes in "we," names problems plainly
  ("Building a trusting organization is a nebulous task"), uses dry one-line
  asides ("The list of people I naturally trust is tiny."), and leads with the
  concrete number before the meaning. Your letter must read like the same person
  wrote it. If the directory has no samples, fall back to `references/voice-guide.md`
  alone, but the abstract guide is weaker calibration than the samples — say so.

Check if a `why-this-company` output already exists for this company
(`output/{company-slug}/`). If so, read it to avoid duplicating research.

Also check for `output/{company-slug}/company-research.md`. If it exists,
read its frontmatter (see `skills/_shared/frontmatter.md`):
- `generated` — if older than 7 days, suggest re-running company-research
- `rating` — use for context on company fit
Then read the prose body for positioning context.

## Required Inputs

Ask the user for what you don't already have:
- **Company name** (required)
- **Role title** (required)
- **Job posting URL** (strongly recommended — fetch and read to extract requirements)
- **Specific points to emphasize** (optional — the candidate may want to highlight certain experience)
- **Format preference** (optional — default is .docx + .md source)

## Phase 1 — Company Extraction (URL cases)

If a job posting URL was provided:

Read `skills/_shared/company-extraction.md` and execute.

## Research Phase

If a `why-this-company` response was already generated for this role, reuse
that research. Otherwise:

1. Fetch and read the job posting if a URL was provided
2. WebSearch the company for mission, stage, recent news, engineering culture
3. Identify the 3-4 key requirements from the posting that most closely
   match the candidate's experience

## Writing the Cover Letter

### Tone
Executive, confident, specific. Not formal-stiff — conversational-professional.
Think "senior leader writing to a peer" not "applicant pleading for consideration."

### Structure

**Opening paragraph** — Lead with the strongest connection point.
Not "I am writing to express my interest in..." — that's dead on arrival.
Instead, open with a specific accomplishment or insight that immediately
demonstrates fit.

Example opening (note the voice — "we," concrete number first, no aphoristic
flourish, no "exactly the kind of problem I've spent my career solving" closer):
"When we cut localization deployment at Procore from six months to minutes, it
opened $12M in revenue across European and Asian markets in the first year. Most
of that work was getting eight teams to trust a new deployment path — the pipeline
was the easy part. [Company] looks to be at a similar point with [specific
challenge]."

**Body paragraphs (2)** — Map the candidate's experience to role requirements.
Each paragraph should follow: [Role requirement] → [the candidate's specific
accomplishment with numbers] → [How this translates to value for this company]

Pull from the `## Accomplishments` section of `config/candidate.md`. Map each
listed accomplishment to the most relevant requirement area from the job posting.
Prefer accomplishments with specific numbers — any bullet without a number is
weak evidence.

**Closing paragraph** — Forward-looking. What the candidate will bring to this specific
company and role. End with a clear call to action.

### What to Avoid
- Generic phrases: "I am a passionate leader" / "I thrive in fast-paced environments"
- Repeating the resume bullet-for-bullet — the letter should tell a narrative
- Underselling: own the candidate's actual scope — team size, org scale, company stage
- Overselling: Don't claim CTO-level scope; be honest about Director-level experience with VP-level ambition

### Structural AI Tells & Cadence

Read `skills/_shared/anti-slop-tells.md` and apply it before presenting. The
structural-tell blocklist (cleft sentences, antithesis flourishes, aphoristic
closers, crutch metaphors, hedge preambles, em-dash sandwiches), the cadence guard
against choppiness, and the voice anchors all live there — shared across every prose
skill so the guidance stays in one place. The `What to Avoid` items above are the
cover-letter-specific additions (scope honesty, no resume regurgitation); the shared
module covers the structural tells common to all written output.

## Output

All files go in `output/{company-slug}/` (e.g., `output/natera/`).

1. Write the cover letter source:
   ```
   output/{company-slug}/{Name}_CoverLetter_{Company}.md
   ```
   Where `{Name}` is from `config/candidate.md` with spaces replaced by underscores.

   Include a frontmatter block before the letter body (see
   `skills/_shared/frontmatter.md` for the schema). The `word_count` field is
   the word count of the letter body (excluding frontmatter). The docx
   generation script strips frontmatter automatically before parsing.

   **Markdown formatting contract** — the docx generator renders these, so use
   them (and only them) for a clean, readable letter:
   - `# Candidate Name` on its own line → letterhead (large, bold, dark blue).
   - A contact line directly under it (`email | City, ST | linkedin/...`) →
     rendered as a gray sub-line.
   - `---` on its own line → a thin horizontal rule. Use one after the contact
     line and one after the `RE:` block.
   - The recipient block carries a `RE: {Role}` line, which renders bold.
   - `**bold**` inline → bold run. Use it **sparingly** — emphasize exactly one
     anchor metric per body paragraph (e.g. `**from 1% to 95%**`), nothing more.
     Bolding whole sentences or every number reads junior; one metric per
     paragraph aids skim without shouting.
   - Body paragraphs are separated by blank lines; keep each paragraph on logical
     prose, not hard-wrapped fragments.
2. Generate the .docx:
   ```fish
   bun scripts/generate_coverletter_docx.ts \
     output/{company-slug}/{Name}_CoverLetter_{Company}.md \
     output/{company-slug}/{Name}_CoverLetter_{Company}.docx
   ```
   If the script exits non-zero, show the error and leave the .md in place.
3. The `output/` directory is gitignored — generated materials stay local

## Quality Checks

Before presenting:
- Does every paragraph contain at least one specific number?
- Is the opening sentence compelling enough to keep reading?
- Does it address the top 3 requirements from the job posting?
- Is it under 400 words? (Executives don't read long cover letters)
- Would the candidate be comfortable sending this as-is?
- **Anti-slop pass** — re-read against `skills/_shared/anti-slop-tells.md`. Zero cleft
  sentences, ≤1 antithesis flourish, no italicized aphoristic closer, no crutch
  metaphor that you've used in another letter. Read the letter aloud in your head:
  does it sound like the person who wrote the two HomeAway blog posts, or like a
  generic AI? If the latter, rewrite the offending sentences before presenting.

## State Update

Read `skills/_shared/state-io.md` and execute — append to `seen-postings`.

After generating, append to the seen-postings state file with
`posted:YYYY-MM-DD` if the posting date is visible on the job page. If unknown,
use `discovered:YYYY-MM-DD` (today's date) instead — every entry must have one
or the other so all roles can be aged:

```
- {Company} | {Title} | cover letter generated | {date} | posted:YYYY-MM-DD
```

### Applications Pipeline (if tracked)

If the company has an entry in the applications pipeline, record the cover letter:

```fish
bun scripts/state.ts add-note applications --company "{company}" --note "Cover letter generated {YYYY-MM-DD}"
```

If the command exits non-zero (no matching application entry), this is expected
for roles not yet in the pipeline. Log a note to the user:

> "No application entry found for {company} — skipping pipeline update.
> Run /application-tracker to add it."

Do not fail the skill run.
