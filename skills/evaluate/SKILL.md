---
name: evaluate
description: >
  Structured fit analysis of a job posting against the candidate's background.
  Produces a scored evaluation across 6 blocks: role summary + archetype detection,
  CV match, level strategy, comp research, personalization plan, and interview prep.
  Output saved to output/{company-slug}/evaluation.md. STAR+R stories appended to
  output/story-bank.md.
  Triggers: "evaluate this role", "is this a good fit", "score this job",
  "how do I match", "evaluate", "is this worth applying to"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Evaluate

Takes a job posting and produces a structured fit analysis across 6 blocks with a
global 1–5 score and a recommendation (apply / borderline / pass).

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Read these files in the same parallel batch:
- `references/resume.md` — markdown resume for exact line citations (Block B)
- `skills/evaluate/scoring-rules.md` — scoring dimensions and weights
- `skills/evaluate/archetypes.md` — VPE archetype definitions and proof points

Accept the job posting URL or pasted JD from the user. If neither is provided, ask:
> "Paste the job URL or the job description and I'll run a full evaluation."

## Phase 1 — Fetch and Extract

Read `skills/_shared/company-extraction.md` and execute to derive `{company-slug}`
and create `output/{company-slug}/` if it doesn't exist.

If a URL was provided: WebFetch the posting page to extract the full JD text.
If WebFetch fails (404, redirect loop, anti-bot block, or returns no parseable JD
content), stop and inform the user:
> "Could not fetch the posting at {URL}. Paste the job description directly and
> I'll run the evaluation."
If a raw JD was pasted: use it directly.

Extract and note: role title, seniority level, remote policy, team size (if
mentioned), location, and the full requirements list.

## Phase 2 — Block A: Role Summary + Archetype Detection

Classify the role into one of the 6 VPE archetypes from `skills/evaluate/archetypes.md`.
If the role fits two archetypes, name both and identify the primary.

Output a summary table:

| Field | Value |
|---|---|
| Title | |
| Level | VP / Senior Director / Director / Head of Eng |
| Remote | Full remote / Hybrid / Onsite |
| Team Size | N engineers or "not specified" |
| Archetype | Primary (+ secondary if hybrid) |
| TL;DR | One sentence — what this role actually is |

**Archetype signal:** Show the detected archetype and preliminary signal, then
continue immediately — do NOT wait for a reply:

> "Detected archetype: **{Archetype}** — {preliminary signal}. Running full
> evaluation now. If the archetype looks off, reply with a correction and I'll
> re-score blocks B and C."

If the user replies with a correction before blocks B–F complete, re-run blocks
B and C with the corrected archetype. Otherwise proceed with the detected archetype.

**Preliminary signal** (show inline in the notice above):
- "Strong signal" — archetype is DX/Platform or Transformation (primary strengths)
- "Solid match" — archetype is Platform-Scale or Turnaround (strong adjacent)
- "Stretch" — archetype is Early-Stage Builder or AI-Integrated (emerging)

This is directional only. Full score comes after all blocks.

## Phase 3 — Blocks B through F

Run all 5 blocks in sequence. Reference `skills/evaluate/scoring-rules.md` for
scoring criteria throughout.

### Block B — CV Match

Read `references/resume.md`. For each JD requirement:
1. Find the closest matching line in the resume
2. Quote it **exactly** — exact text, no paraphrasing
3. Rate the match: **Direct**, **Adjacent**, or **Gap**

For each Gap, classify it as **Hard blocker** or **Nice-to-have**, and provide a
concrete mitigation strategy: adjacent experience to highlight, framing approach,
or honest acknowledgment of the gap.

Output as a table:

| JD Requirement | Resume Match (exact quote) | Match Type | Gap Strategy |
|---|---|---|---|

Compute Block B score (1–5) per `scoring-rules.md`.

### Block C — Level Strategy + Growth Signal

1. Compare the role's seniority level to the target level in `config/search.md`
2. Provide archetype-specific positioning advice from `skills/evaluate/archetypes.md`:
   which proof points to lead with, how to frame the candidate's background
3. If the role is below target level: include a "downlevel contingency" — whether to
   accept, what to negotiate (review timeline, criteria for promotion)

**Compute Growth Signal score (1–5)** using the Growth Signal scale in
`skills/evaluate/scoring-rules.md`. Record this score explicitly — it feeds
the global score in Phase 4.

Do not skip this block. Even when the level exactly matches the target, the
Growth Signal score must be computed and stated.

### Block D — Comp Research

Issue these WebSearch queries in a single parallel batch:

```
[WebSearch: "{role title}" "{company name}" salary site:glassdoor.com]
[WebSearch: "{role title}" VP OR "Senior Director" compensation site:levels.fyi]
[WebSearch: "{role title}" salary "{location or remote}" site:linkedin.com/salary]
```

Synthesize into a table:

| Source | Range | Data Quality | Notes |
|---|---|---|---|
| Glassdoor | | | |
| Levels.fyi | | | |
| LinkedIn Salary | | | |
| **Estimate** | **$X–$Y** | | Weighted synthesis |

Compare estimate to the comp floor in `config/search.md`. State clearly:
- Above floor / At floor / Below floor / Insufficient data

**If data is thin** (common for VP roles at smaller companies): write
"Insufficient public data for a reliable estimate" and note what adjacent data
was found. Default Block D score to 3. Never fabricate a range.

Compute Block D score (1–5) per `scoring-rules.md`.

### Block E — Personalization Plan

Output two lists.

**Top 5 resume changes for this JD:**

| # | Section | Current text | Proposed change | JD keyword targeted |
|---|---|---|---|---|

**Top 5 cover letter hooks:**

| # | JD angle | Proof point to pair | One-sentence framing |
|---|---|---|---|

Check `output/{company-slug}/company-research.md` — if it exists, use it for company
context rather than repeating research.

### Block F — Interview Prep + Story Bank

Read `output/story-bank.md`. If it doesn't exist, create it as an empty file with
this header:

```markdown
# STAR+R Story Bank

Stories accumulate across sessions. Each story is tagged and tracked for reuse.
```

For each of the 6–8 most important JD requirements:

1. Search existing stories in `output/story-bank.md` by tags
2. If a matching story exists: surface it with a suggested framing adjustment for
   this role — note it as **existing**
3. If no match: generate a new STAR+R story from `references/resume.md` —
   note it as **new**

**Before appending any new story**, check whether `output/story-bank.md` already
contains a `## {Story Title}` heading with that exact title. If it does, do not
append — update the existing story in place instead. This prevents duplicates when
the same role is re-evaluated.

Output as a table:

| JD Requirement | Story Title | Situation | Task | Action | Result | Reflection | Source |
|---|---|---|---|---|---|---|---|

**Reflection**: what was learned or what would be done differently. This signals
seniority — junior candidates describe what happened, senior candidates extract lessons.

After the table, append all **new** stories to `output/story-bank.md`:

```markdown
## {Story Title}
**Situation:** ...
**Task:** ...
**Action:** ...
**Result:** ...
**Reflection:** ...
**Tags:** [{archetype}] [{theme: e.g., "team-scaling", "ci-cd", "stakeholder-management"}]
**used_for:** []
```

## Phase 4 — Score + Output

Compute the global score using `skills/evaluate/scoring-rules.md`. Display the
score card:

```
## Evaluation Score

| Dimension | Score | Weight |
|---|---|---|
| CV Match | X / 5 | 40% |
| Growth Signal | X / 5 | 35% |
| Comp Alignment | X / 5 | 25% |
| Red Flag Deduction | −X.X | |
| **Global** | **X.X / 5.0** | |

**Recommendation: apply / borderline / pass**
```

Before writing, check whether `output/{company-slug}/evaluation.md` already exists.
If it does, read the `generated` field from its frontmatter and compare to today's date:
- **Within 7 days**: prompt the user —
  > "An evaluation for {Company} already exists from {generated date}. Overwrite
  > it, or review the existing one? (overwrite / show existing)"
  If user says "show existing": display it and stop. If "overwrite": proceed.
- **Older than 7 days**: overwrite silently (the existing evaluation is stale).

Write `output/{company-slug}/evaluation.md`:

Frontmatter:
```yaml
---
skill: evaluate
company: {Company Name}
slug: {company-slug}
role: {Role Title}
url: "{Original posting URL}"
archetype: {Confirmed Archetype}
score: {X.X}
recommendation: apply | borderline | pass  # must be lowercase
generated: {YYYY-MM-DD}
---
```

Body: Full block output (A–F) followed by the score card.

## Phase 5 — Pipeline Registration

Register the role in the application pipeline. Use single-quoted JSON to avoid
shell interpolation issues with special characters in company names and URLs:

```bash
bun scripts/state.js create applications \
  '{"company":"{Company}","title":"{Role}","stage":"Discovery","url":"{URL}"}'
```

If the command exits non-zero: check whether it was a duplicate-entry error by
inspecting the stderr output for the text "already exists". If it contains
"already exists", skip silently — the entry is already registered. If stderr
contains any other message, log it to the user:

> "Pipeline registration failed for {Company}: {stderr message}. To register
> manually, run: `bun scripts/state.js create applications
> '{\"company\":\"{Company}\",\"title\":\"{Role}\",\"stage\":\"Discovery\",\"url\":\"{URL}\"}'`"

Then continue — do not block the skill.

Then record the evaluation result:

```bash
bun scripts/state.js add-note applications \
  --company "{Company}" \
  --note "Evaluation complete — score: {X.X}/5, archetype: {archetype}, recommendation: {apply|borderline|pass}"
```

If `add-note` exits non-zero, log the full error to the user:

> "Could not record evaluation note for {Company}: {stderr message}. To add it
> manually, run: `bun scripts/state.js add-note applications --company
> \"{Company}\" --note \"Evaluation complete — score: {X.X}/5, archetype:
> {archetype}, recommendation: {recommendation}\"`"

Then continue — do not block.

### Seen-Postings Update

Read `skills/_shared/state-io.md` and execute the **append** pattern for `seen-postings`.

Find the seen-postings line matching the company name or URL and append
`| EVALUATED:{X.X}:{apply|borderline|pass}` to that line (e.g., `| EVALUATED:3.8:apply`).

If the company is NOT in seen-postings (URL came from outside the digest), add
a new entry under today's date section with the flag:

```
## YYYY-MM-DD
- {Company} | {Role Title} | {URL} | discovered:YYYY-MM-DD | EVALUATED:{X.X}:{recommendation}
```
