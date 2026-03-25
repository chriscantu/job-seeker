# Design Spec: Company Researcher Agent

**Date**: 2026-03-25
**Status**: Draft
**Author**: Chris Cantu + Claude

---

## Problem

Four skills need company research — `why-this-company`, `cover-letter`,
`interview-prep`, and the stubbed `company-research` skill. Each re-implements
the same WebSearch + analysis pattern independently, leading to:

1. **Duplicated research**: Applying to a company triggers research in
   `why-this-company`, then again in `cover-letter`, then again in
   `interview-prep`. Same searches, different sessions.
2. **Inconsistent depth**: Each skill defines its own research scope. Cover
   letter research focuses on requirements mapping; why-this-company focuses
   on mission alignment. Neither gets the full picture.
3. **No caching**: Research results live only in session context. If you
   run `cover-letter` today and `interview-prep` tomorrow, the research
   starts from scratch.

**Target**: A single agent that produces a comprehensive, cached research
brief reusable across all downstream skills.

---

## Decision

Build a `company-researcher` agent that autonomously produces a structured
research brief saved to `output/{company-slug}/company-research.md`. Skills
check for an existing brief before invoking the agent — if one exists and is
recent (< 7 days), skip the research phase.

This also **implements the stubbed `company-research` skill** — the skill
becomes a thin wrapper that invokes the agent and presents results.

### Alternatives Considered

| Option | Why Not |
|--------|---------|
| Shared research function in a utility file | Skills are markdown-driven, not code — no shared function mechanism |
| Research once in `daily-digest`, embed in digest | Bloats the digest; research depth needed for applications exceeds what's useful in a daily scan |
| Let each skill keep its own research | Status quo — duplicated work, inconsistent quality |

---

## Agent Contract

### Inputs

The agent receives these via its prompt:

| Parameter | Required | Source |
|-----------|----------|--------|
| `company_name` | Yes | User or calling skill |
| `role_title` | No | User or calling skill |
| `job_posting_url` | No | User or calling skill |

### Outputs

A markdown file at `output/{company-slug}/company-research.md` with this structure:

```markdown
# {Company Name} — Research Brief

**Generated**: {YYYY-MM-DD}
**Role context**: {role_title if provided, else "General"}
**Source URL**: {job_posting_url if provided}

## Company Overview
- **Mission**: {1-2 sentence mission statement}
- **Stage**: {Startup / Growth / Enterprise} — {Series X, revenue stage, public}
- **Size**: {employee count or range}
- **Founded**: {year}
- **HQ**: {location}
- **Funding**: {total raised, last round details}

## Engineering Organization
- **Eng team size**: {estimate if available}
- **Tech stack signals**: {from job postings, blog, open source}
- **Engineering blog/talks**: {URLs if found}
- **Open source presence**: {GitHub org, notable repos}

## Culture Signals
- **Glassdoor/Blind**: {rating, key themes from engineering reviews}
- **Leadership**: {VP Eng / CTO name if findable, background}
- **Values**: {stated company values}
- **Red flags**: {any concerns from reviews, news, layoffs}

## Recent News
- {date}: {headline + 1-sentence summary}
- {date}: {headline + 1-sentence summary}

## Fit Analysis
Maps to `config/candidate.md` strengths:

| Candidate Strength | Company Need | Connection Strength |
|-------------------|-------------|-------------------|
| {strength from config} | {matching challenge} | Strong / Moderate / Weak |

### Genuine Connection Points
- {Specific thread connecting candidate experience to company mission}

### Gaps or Concerns
- {Honest assessment of weak alignment areas}
```

### Caching Rules

1. Before running research, check for `output/{company-slug}/company-research.md`
2. If the file exists, read the `**Generated**` date
3. If < 7 days old → skip research, return existing brief
4. If >= 7 days old → re-run research, overwrite the file
5. If the calling skill provides a `role_title` different from the cached
   brief's `**Role context**`, re-run to incorporate role-specific context

---

## Agent Definition

### File Location

`.claude-plugin/agents/company-researcher.md`

### Frontmatter

```yaml
name: company-researcher
description: >
  Autonomously researches a target company — mission, stage, engineering
  culture, recent news, leadership — and produces a structured research
  brief at output/{company-slug}/company-research.md. Checks for cached
  briefs before running. Used by why-this-company, cover-letter,
  interview-prep, and company-research skills.
allowed-tools: Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, Bash
```

### System Prompt Outline

1. Read `config/candidate.md` for candidate strengths and background
2. Read `config/search.md` for company type preferences
3. Check cache (see Caching Rules above)
4. If research needed:
   a. If `job_posting_url` provided, WebFetch the posting
   b. WebSearch company: mission, funding, stage, size, recent news
   c. WebSearch engineering culture: blog posts, tech talks, GitHub
   d. WebSearch Glassdoor/Blind for engineering-specific reviews
   e. WebSearch leadership: VP Eng / CTO background
5. Synthesize into the output template
6. Write to `output/{company-slug}/company-research.md`

### How Skills Invoke It

Skills that need research add this to their workflow:

```
1. Derive {company-slug} from company name (lowercase, no spaces)
2. Glob output/{company-slug}/company-research.md
3. If exists and recent (< 7 days) → read it, skip agent
4. If missing or stale → dispatch company-researcher agent with:
   - company_name: {name}
   - role_title: {title}
   - job_posting_url: {url if available}
5. Read the generated brief
6. Use brief data in skill-specific output
```

---

## Skill Changes Required

| Skill | Change |
|-------|--------|
| `company-research` | Replace stub with thin wrapper: invoke agent, present brief to user |
| `why-this-company` | Replace inline research phase with agent invocation + cache check |
| `cover-letter` | Replace inline research phase with agent invocation + cache check |
| `interview-prep` | When implemented: use agent instead of inline research |
| `networking-outreach` | When implemented: use agent for contact/company context |

---

## Privacy Constraints

- The agent MUST NOT include candidate PII in the research brief
- The brief is about the *company*, not the candidate
- The Fit Analysis section references strengths by label only (e.g.,
  "delivery transformation") — no personal details, comp, or contact info
- Research briefs live in `output/` (gitignored)

---

## Success Criteria

1. Running `why-this-company` then `cover-letter` for the same company
   does NOT trigger duplicate web searches
2. Research brief contains all sections from the template
3. Cache hit skips research entirely (no WebSearch calls)
4. Cache miss or stale brief triggers fresh research
5. Brief is usable by a human without running any skill (standalone value)
