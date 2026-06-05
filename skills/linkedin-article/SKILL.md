---
name: linkedin-article
description: This skill should be used when the user wants to write LinkedIn content — posts, articles, or thought leadership pieces. Common triggers include "write a LinkedIn post", "draft a LinkedIn article", "create LinkedIn content", "draft a post about [topic]", "I want to write about", "help me with a LinkedIn piece", "LinkedIn thought leadership", or "publish on LinkedIn". The skill pressure-tests the thesis, researches supporting data, drafts in the candidate's authentic voice, audits against voice rules, sources images, and exports publication-ready content.
---

# LinkedIn Article Skill

Write LinkedIn content (posts, articles, or both) grounded in the candidate's
authentic voice, backed by data, and structured for maximum engagement.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Then read these additional files:
- `references/voice-guide.md` — the candidate's writing voice rules
- `skills/_shared/anti-slop-tells.md` — structural AI-tell blocklist + cadence guard
  shared across all prose skills; apply it when drafting and auditing
- Glob `references/writing-samples/*.md` (skip `README.md`) — the candidate's real
  published prose; study sentence-level texture, not just gist

> **Path note:** Files prefixed with `references/` or `config/` above are at the
> **project root**, not inside this skill's local `references/` directory. This
> skill's own reference files are at `skills/linkedin-article/references/`.

## Phase 1: Pressure Test the Hypothesis

When the user brings a topic or hypothesis:

1. **Clarify the thesis.** Ask what specific claim or argument they want to make. Push past vague ideas to a concrete, defensible position.

2. **Probe the foundation.** Ask three questions:
   - What personal experience or observation drives this? (Lived experience, industry pattern, or intuition?)
   - Who is the audience, and what is their familiarity with the topic?
   - What tone — cautionary, practical, provocative, or a blend?

3. **Challenge assumptions.** Play devil's advocate. Identify the strongest counterargument to the thesis and surface it. The article will be stronger if it acknowledges and addresses the opposing view rather than ignoring it.

4. **Sharpen the thesis.** Refine the hypothesis into a single sentence that can anchor the entire piece. Confirm with the user before proceeding.

## Phase 2: Research Supporting Data

Search for data that supports (or challenges) the thesis:

1. **Find primary sources.** Use WebSearch to locate studies, reports, and published data. Prioritize:
   - Peer-reviewed research or industry reports (Gartner, Forrester, DORA, etc.)
   - Data from product analytics platforms (Pendo, Amplitude, etc.)
   - Named studies with sample sizes and methodology
   - Avoid anecdotal blog posts or unsourced claims

2. **Evaluate relevance.** For each data point, assess:
   - Does it directly support the thesis, or is it tangentially related?
   - Is the connection obvious to the reader, or does it require a logical bridge?
   - If a bridge is needed, is it honest and defensible?

3. **Present a data summary.** Show the user a table of findings with source, stat, and how it connects to the thesis. Let them choose which data to include.

4. **Be honest about gaps.** If no data directly supports the thesis, say so. Identify where the argument relies on logical extension vs. hard evidence, and frame the article accordingly.

## Phase 3: Determine Format

Ask the user which output format to produce:
- **Post only** — punchy, under 2,200 characters (platform max is 3,000, but brevity wins), optimized for feed visibility
- **Article only** — 800-1,500 words, structured with headers and images
- **Both (teaser post + full article)** — teaser hooks in the feed, article provides depth

Consult `references/linkedin-formats.md` for format constraints and structure guidance.

## Phase 4: Draft in the Candidate's Voice

1. **Read the voice guide.** Before writing, re-read `references/voice-guide.md`. Internalize the rules — especially "we" over "I", concrete before abstract, and no buzzwords.

2. **Write the first draft.** Follow the structure from `references/linkedin-formats.md` for the chosen format.

3. **Audit against the voice guide.** After drafting, perform a voice audit using the checklist in `references/voice-audit.md` — which now includes the structural AI-tell rows from `skills/_shared/anti-slop-tells.md` (cleft sentences, antithesis flourishes, aphoristic closers, crutch metaphors, hedge preambles, staccato cadence). Present the audit table to the user. Fix any failures before presenting the final draft.

4. **Iterate with the user.** Present the draft and audit together. Incorporate feedback. Re-audit after significant changes.

## Phase 5: Add References

1. **Inline links.** Every claim backed by external data must include a hyperlink at the point of reference.
2. **Sources section.** Add a sources section at the bottom of articles with linked citations.
3. **Verify links.** Use WebFetch to confirm linked URLs are accessible and point to the expected content.

## Phase 6: Source and Embed Images

For articles (not posts), find and embed supporting visuals:

1. **Identify image opportunities.** Each major section (H2) should have a visual if a relevant one exists. Prioritize sections that introduce a framework, reference external data, or explain a concept.

2. **Source images.** Follow the priority order in `references/image-sourcing.md`:
   - Official source images first (framework authors, report publishers)
   - Creative Commons diagrams
   - Screenshots from free/public resources
   - Author-created or AI-generated as fallback

3. **Download and embed.** Save images to `output/linkedin/images/`, verify they're valid, and embed with markdown image syntax and attribution captions.

4. **Handle gated content.** If the best visual is behind a paywall or login, add a blockquote with download instructions and attribution line for the user to complete manually.

## Phase 7: Export

Save deliverables to `output/linkedin/`:

| Format | Filename Pattern |
|--------|-----------------|
| Teaser post | `output/linkedin/{slug}-teaser.md` |
| Full article | `output/linkedin/{slug}-article.md` |
| Images | `output/linkedin/images/{descriptive-name}.png` |

Create the `output/linkedin/` directory if it doesn't exist. Create `output/linkedin/images/` if images are included.

## Additional Resources

### Reference Files

- **`references/linkedin-formats.md`** — Character limits, structure templates, algorithm tips for posts vs. articles
- **`references/voice-audit.md`** — Post-draft voice audit checklist and anti-patterns
- **`references/image-sourcing.md`** — How to find, download, and attribute images

### Examples

Calibration examples from a real session — read before drafting to match tone, structure, and length:
- **`examples/sample-article.md`** — Full article with images, references, and voice-audited copy
- **`examples/sample-teaser.md`** — Teaser post that hooks with data and drives to the article

### Project Files (not bundled — read from project root)

- **`references/voice-guide.md`** — Candidate's writing voice calibration
- **`config/candidate.md`** — Candidate background and expertise
