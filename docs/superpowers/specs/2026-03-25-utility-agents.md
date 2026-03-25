# Design Spec: Utility Agents — Voice Auditor + URL Verifier

**Date**: 2026-03-25
**Status**: Draft
**Author**: Chris Cantu + Claude

---

These two agents extract existing logic from skills into reusable,
independently invocable components. Neither introduces new behavior —
they formalize patterns that already exist in the codebase.

---

# Part 1: Voice Auditor Agent

## Problem

The `linkedin-article` skill has a voice audit phase (Phase 4, step 3) that
checks written output against `references/voice-guide.md` and
`skills/linkedin-article/references/voice-audit.md`. But four other skills
produce written output that should meet the same voice standards:

- `cover-letter` — formal letter, needs voice compliance
- `why-this-company` — narrative response, same voice rules
- `networking-outreach` — messages in Chris's voice (when implemented)
- `interview-prep` — STAR stories should sound like Chris (when implemented)

Currently, only `linkedin-article` audits. The others rely on general
instructions in PRINCIPLES.md ("Voice: Friendly pragmatist...") without
a structured check.

## Decision

Extract the voice audit into a standalone agent that any skill can invoke
after drafting written output.

### Agent Contract

**Input**: Text to audit (the draft output from any skill)

**Output**: A structured audit table + pass/fail verdict

```markdown
## Voice Audit — {Skill Name} for {Company}

| Check | Status | Notes |
|-------|--------|-------|
| No buzzwords | ✓ | Clean |
| Quantified claims | ✗ | Para 2 says "improved performance" — needs a number |
| "We" for team, "I" for decisions | ✓ | Correct usage |
| Concrete before abstract | ✓ | Leads with specifics |
| Executive level tone | ✓ | Reads as peer-to-peer |
| No performative enthusiasm | ✓ | No "passionate about" |
| Mission connection is genuine | ✓ | Grounded in Babylon experience |

**Verdict**: FAIL — 1 issue to fix
**Fix**: Replace "improved performance" in paragraph 2 with specific metric
from resume (e.g., "reduced deployment cycle from 6 months to minutes")
```

### Agent Definition

**File**: `.claude-plugin/agents/voice-auditor.md`

```yaml
name: voice-auditor
description: >
  Audits written output against the candidate's voice guide and quality
  standards. Checks for buzzwords, quantified claims, tone, executive
  level, and genuine mission alignment. Returns a structured pass/fail
  table with specific fix suggestions. Use after drafting cover letters,
  why-this-company responses, LinkedIn articles, or any external-facing
  written content.
allowed-tools: Read, Glob
```

**System prompt outline**:
1. Read `references/voice-guide.md` — full voice calibration
2. Read `skills/linkedin-article/references/voice-audit.md` — audit checklist
3. Read `PRINCIPLES.md` — quality standards (especially "Writing Quality")
4. Apply each check against the provided text
5. Return the audit table with verdict and fix suggestions

### How Skills Invoke It

After drafting output, before presenting to the user:

```
1. Draft the output (cover letter, why-this-company, etc.)
2. Dispatch voice-auditor agent with the draft text
3. If verdict is PASS → present to user
4. If verdict is FAIL → apply suggested fixes, re-audit, then present
   both the final draft and the audit table
```

### Skill Changes Required

| Skill | Change |
|-------|--------|
| `linkedin-article` | Replace inline audit (Phase 4 step 3) with agent invocation |
| `cover-letter` | Add audit step after "Writing the Cover Letter" |
| `why-this-company` | Add audit step after "Writing the Response" |
| `networking-outreach` | Add audit step when implemented |
| `interview-prep` | Add audit for STAR story narratives when implemented |

---

# Part 2: URL Verifier Agent

## Problem

The daily-digest skill's Phase 2 contains ~60 lines of URL verification
logic: routing URLs to the correct ATS API (Greenhouse, Lever, Ashby),
handling fallbacks to WebFetch, interpreting responses, and marking
closed postings. This logic is:

1. **Complex**: Three different API contracts, each with different response
   shapes and failure modes
2. **Buried in one skill**: If another skill or command needs to check if
   a posting is open, it has to reimplement the routing logic
3. **Error-prone**: The most common daily-digest bugs have been in URL
   verification (stale postings, JS-rendered pages, API field mismatches)

## Decision

Extract URL verification into a standalone agent. The agent takes a list of
URLs, routes each to the appropriate verification method, and returns
structured results.

### Agent Contract

**Input**: A list of job posting URLs to verify

**Output**: A structured verification report

```markdown
## URL Verification Report — {date}

| # | Company | URL | Method | Status | Details |
|---|---------|-----|--------|--------|---------|
| 1 | Acme | boards.greenhouse.io/acme/jobs/123 | Greenhouse API | ✅ Open | VP of Engineering, Remote |
| 2 | Beta Co | jobs.lever.co/beta/abc-123 | Lever API | ❌ Closed | 404 |
| 3 | Gamma | gamma.com/careers/456 | WebFetch | ✅ Open | Page confirms active posting |
| 4 | Delta | jobs.ashbyhq.com/delta | Ashby API | ⚠️ Unverifiable | Title match failed, WebFetch also inconclusive |

Summary: 2 open, 1 closed, 1 unverifiable
```

### Routing Logic

Identical to `integrations/adapters/ats-apis.md` — the agent reads this
file as its routing reference:

| URL Pattern | Method |
|-------------|--------|
| `boards.greenhouse.io/{co}/jobs/{id}` | Greenhouse API |
| `job-boards.greenhouse.io/{co}/jobs/{id}` | Greenhouse API |
| `jobs.lever.co/{co}/{id}` | Lever API |
| `jobs.ashbyhq.com/{co}` | Ashby API |
| Anything else | WebFetch |

### Agent Definition

**File**: `.claude-plugin/agents/url-verifier.md`

```yaml
name: url-verifier
description: >
  Verifies whether job posting URLs are still active by routing each URL
  to the appropriate ATS API (Greenhouse, Lever, Ashby) or falling back
  to WebFetch. Returns a structured report with open/closed/unverifiable
  status for each URL. Used by daily-digest Phase 2, the /is-open command,
  and any skill that needs to confirm a posting is live before generating
  application materials.
allowed-tools: Read, WebFetch, Bash
```

**System prompt outline**:
1. Read `integrations/adapters/ats-apis.md` — routing logic and API contracts
2. For each URL:
   a. Match against URL patterns to determine verification method
   b. Call the appropriate API or WebFetch
   c. Interpret the response per the rules in ats-apis.md
   d. Record result
3. Return the verification report

### Batching

The agent MUST issue all verification calls in parallel (single message
with multiple WebFetch calls). This matches the existing batching protocol
in the daily-digest skill and is critical for performance — verifying 10
URLs sequentially would be painfully slow.

### How Skills/Commands Invoke It

**From daily-digest (Phase 2)**:
```
1. Collect candidate URLs from Phase 1
2. Dispatch url-verifier agent with the URL list
3. Read verification report
4. Include only ✅ Open URLs in the digest
5. Mark ❌ Closed URLs in seen-postings state
6. Add ⚠️ Unverifiable URLs to digest footer
```

**From `/is-open` command**:
```
1. User provides a single URL
2. Dispatch url-verifier agent with [url]
3. Report the result
```

### Skill Changes Required

| Skill/Command | Change |
|---------------|--------|
| `daily-digest` | Replace inline Phase 2 with agent invocation |
| `/is-open` command | Invoke agent with single URL |
| `cover-letter` | Optional: verify posting URL is still open before writing |

---

## Shared Considerations

### Both agents follow these patterns:

1. **Read-only reference files**: Both agents read adapter/reference docs
   to determine their behavior — they don't hardcode API contracts or
   voice rules
2. **Structured output**: Both return markdown tables that are human-readable
   and parseable by calling skills
3. **No state mutation**: Neither agent writes to state files (seen-postings,
   preferences, applications). The calling skill decides what to do with
   the results.
4. **Fail gracefully**: If the voice-auditor can't read the voice guide,
   it reports that and skips the audit rather than blocking. If the
   url-verifier encounters an unexpected error, it marks the URL as
   unverifiable rather than crashing.

### Registration

Both agents must be registered in `plugin.json`:

```json
"agents": [
  { "file": ".claude-plugin/agents/voice-auditor.md" },
  { "file": ".claude-plugin/agents/url-verifier.md" }
]
```

(Along with `company-researcher` from the companion spec.)

---

## Success Criteria

### Voice Auditor
1. Catches all anti-patterns listed in PRINCIPLES.md "Anti-patterns" section
2. Produces specific, actionable fix suggestions (not just "fix this")
3. LinkedIn-article voice audit results are identical whether using the
   inline audit or the agent

### URL Verifier
1. Correctly routes Greenhouse, Lever, and Ashby URLs to their APIs
2. Falls back to WebFetch for unknown URL patterns
3. All verification calls are batched (parallel, single message)
4. daily-digest Phase 2 results are identical whether using inline logic
   or the agent
