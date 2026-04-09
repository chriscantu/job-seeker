# Design Spec: TheirStack + ATS API Integration

**Date**: 2026-03-15
**Status**: Draft
**Author**: Chris Cantu + Claude

---

## Problem

The daily-digest skill's current discovery and verification pipeline has a ~20%
hit rate. Two root causes:

1. **Discovery precision**: WebSearch (Google) returns tangential results for
   broad executive role queries. No filtering by company size, funding stage,
   or posting recency at the search level.
2. **Verification accuracy**: WebFetch fails on JS-rendered ATS pages
   (Greenhouse), gets 403s (Wellfound), and cannot distinguish open from
   closed postings reliably.

Target: 85-90% hit rate (roles surfaced are relevant and verified open).

---

## Decision

**TheirStack API as primary discovery source.** Chosen over Apify LinkedIn
Scraper and SerpApi Google Jobs because:

- Aggregates 321K+ job sites (not limited to one board like LinkedIn)
- Supports regex title matching, company size, funding stage, and recency
  filters that map directly to search.md criteria
- 200 free credits/month (vs. Apify's ~16 CU or SerpApi's 100 searches)
- Structured JSON output eliminates parsing issues
- No scraping gray area (API-based, not browser automation)

**Direct ATS APIs for verification.** Greenhouse, Lever, and Ashby expose free,
public, no-auth JSON APIs for their job boards. These return definitive
open/closed status, replacing WebFetch for the three most common ATS platforms
in the target market.

### Alternatives considered

| Option | Why not |
|--------|---------|
| Apify LinkedIn Scraper | Limited to one board, 16 CU/month ceiling, scraping gray area |
| SerpApi Google Jobs | 100 searches/month ceiling, no company size/funding stage filters |
| LinkedIn job alert emails via Gmail MCP | User doesn't use Gmail; alerts have high false-positive rate; email clutter |
| Browser automation (Claude in Chrome) | Fragile, hard to automate reliably, LinkedIn ToS concerns |

---

## Architecture

### Current flow

```
daily-digest
  -> Phase 1: WebSearch (all sources, every day)
  -> Phase 2: WebFetch (every URL)
  -> Phase 3: Compose + write Apple Notes + state files
```

### New flow

```
daily-digest
  -> Phase 1: Discovery
       -> TheirStack API (daily, if credits available)
       -> WebSearch niche boards (Mon + Thu only)
       -> WebSearch fallback (only when TheirStack credits exhausted)
  -> Phase 2: Deduplicate + Verify
       -> Deduplicate against seen-postings (unchanged)
       -> Route by URL domain:
            greenhouse.io  -> Greenhouse API (free, structured JSON)
            lever.co       -> Lever API (free, structured JSON)
            ashbyhq.com    -> Ashby API (free, structured JSON)
            other          -> WebFetch fallback
  -> Phase 3: Compose + write (unchanged)
```

### What changes

- Phase 1 swaps from "WebSearch every day" to "TheirStack daily + WebSearch
  2x/week for niche boards"
- Phase 2 adds domain-based routing to ATS APIs before falling back to WebFetch
- SKILL.md gains TheirStack as an allowed tool pattern (WebFetch to their API)
- State files gain a credit tracking section in preferences.md

### What does not change

- Apple Notes output format and HTML template
- State file format (seen-postings, preferences)
- Deduplication logic
- Comp/location/title filtering in the skill
- Fallback behavior when Apple Notes write fails
- Phase 3 compose and write

---

## Component Design

### 1. TheirStack config

**File**: `integrations/config/theirstack-config.md` (gitignored)

```
# TheirStack Configuration

api_key: tsk_xxxxxxxxxxxxxxxx
base_url: https://api.theirstack.com/v1
daily_credit_budget: 8
```

**Template**: `integrations/config/theirstack-config.md.example` (committed)

Pattern matches `notes-config.md` / `notes-config.md.example`.

### 2. TheirStack adapter

**File**: `integrations/adapters/theirstack.md`

Documents the API contract, field mapping, error handling, and rate limits.
Same pattern as `integrations/adapters/apple-notes.md`.

**API call**:

All query parameters are derived from `config/search.md` at runtime. The skill
reads Target Role Titles, Location Constraints, Remote Preference, and Company
Types — never hardcodes them. The example below shows what the constructed
request looks like given the current search.md values:

```
POST https://api.theirstack.com/v1/jobs/search
Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json
Body:
  job_title_pattern: "{regex built from Target Role Titles in search.md}"
  company_size: ["{mapped from Company Types in search.md — see size mapping below}"]
  location: "{see location mapping below}"
  remote: {see location mapping below}
  posted_after: "{yesterday's date, YYYY-MM-DD}"
  limit: 10
```

**Company size mapping** (derived from "Company Types" field in search.md):

The search.md field "Company Types: Mission-driven, growth-stage, midsize"
maps to TheirStack's company_size filter as follows:

| search.md term | TheirStack company_size | Rationale |
|---------------|------------------------|-----------|
| growth-stage | "51-500" | Series A-C companies scaling engineering |
| midsize | "501-1000" | Established but not enterprise-scale |
| mission-driven | (not filterable) | Qualitative attribute — not a TheirStack filter. Mission alignment is assessed during Phase 3 compose, where the skill evaluates company mission for the digest's "Why this fits" and star rating fields. |

These ranges target companies large enough to need VP-level engineering
leadership but small enough that the role shapes culture rather than
maintaining it (per search.md Notes). If the user's Company Types preference
changes, update this mapping accordingly.

**Location and remote mapping** (derived from Location Constraints in search.md):

search.md has a multi-part Location Constraints structure. The skill maps it
to TheirStack query parameters as follows:

| search.md field | Value | TheirStack parameter | Mapped value |
|----------------|-------|---------------------|-------------|
| Remote Preference | "Remote or Hybrid" | `remote` | `true` |
| Remote | Yes | (covered by remote=true) | — |
| Hybrid (Austin TX area) | Yes | `location` | `"Austin, TX"` |
| Relocation required | No | (no filter needed) | — |
| 100% in-office | No | (no filter needed) | — |

The skill sets `remote: true` to include remote roles regardless of location,
AND sets `location: "Austin, TX"` to also capture hybrid roles in the Austin
area. This combination ensures both remote-anywhere and Austin-hybrid postings
appear in results. Roles requiring relocation or 100% in-office are filtered
out during Phase 3 compose (not at the API level, since TheirStack cannot
express negative location constraints).

**Field mapping to digest format**:

| TheirStack field | Digest field | Notes |
|-----------------|-------------|-------|
| job_title | Title | Direct map |
| company_name | Company | Direct map |
| location | Location | Direct map |
| url | Link | Verify via ATS API or WebFetch before use |
| posted_at | (internal) | Used for recency filtering |
| company_size | (internal) | Already filtered in query |

**Error handling**:

| HTTP status | Action |
|-------------|--------|
| 200 | Parse results, proceed to verification |
| 401 | Log "TheirStack API key invalid", fall back to WebSearch |
| 429 | Log "TheirStack rate limited", fall back to WebSearch |
| 402 | Log "TheirStack credits exhausted", fall back to WebSearch |
| 5xx | Log error, fall back to WebSearch |

Errors are non-blocking. The digest always runs even if TheirStack is
unavailable.

### 3. ATS verification APIs adapter

**File**: `integrations/adapters/ats-apis.md`

Documents endpoints, field mappings, and error handling for Greenhouse, Lever,
and Ashby public APIs.

**URL pattern matching**:

| URL pattern | Verification method |
|-------------|-------------------|
| `boards.greenhouse.io/{company}/jobs/{id}` | `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` |
| `job-boards.greenhouse.io/{company}/jobs/{id}` | Same as above (extract company + id) |
| `jobs.lever.co/{company}/{id}` | `GET https://api.lever.co/v0/postings/{company}/{id}` |
| `jobs.ashbyhq.com/{company}` | `POST https://api.ashbyhq.com/posting-api/job-board/{company}` (returns all open postings; match by title to verify) |
| Everything else | WebFetch (current behavior) |

**Verification logic**:

- 200 response with job data = posting is open, extract structured fields
- 404 response = posting is closed, mark as CLOSED in seen-postings
- Any other error = fall back to WebFetch for that URL

No auth required for any of these APIs. They are public job board endpoints.

### 4. Budget tracking

**Location**: `output/*-preferences.md` (existing state file)

New section appended after each TheirStack call:

```
### TheirStack Credits
- 2026-03-15: credits_used=7, month_total=87, month_limit=200
```

**Budget check logic** (runs at start of Phase 1):

1. Read most recent preferences.md
2. Parse TheirStack Credits section for current month's running total
3. If running total + daily_credit_budget >= 200: skip TheirStack, use
   WebSearch fallback
4. If running total + daily_credit_budget < 200: proceed with TheirStack

### 5. Daily execution flow

**Every day**:

1. Check TheirStack credit budget
2. If credits available: call TheirStack API with search.md criteria
3. If Monday or Thursday: also run WebSearch against niche boards
   (Tech Jobs for Good, Purpose Jobs, Built In)
4. Merge all results
5. Deduplicate against seen-postings
6. Verify each result via URL domain routing (ATS APIs or WebFetch)
7. Compose digest and write to Apple Notes + state files

**When credits exhausted** (end of month):

1. Skip TheirStack
2. Run full WebSearch (same as current behavior)
3. Continue with dedup, verify, compose as normal

**Budget math**:

- Daily ceiling: 8 credits
- Monthly budget: 200 credits (free tier)
- 200 / 8 = 25 days of coverage
- Typical month has ~22 weekdays, leaving buffer for retries

---

## Changes to daily-digest SKILL.md

The following sections of `skills/daily-digest/SKILL.md` need updates:

### Before You Start (add step)

After step 5 (read preferences), add:

> 6. If `integrations/config/theirstack-config.md` exists, read it to get
>    `api_key`, `base_url`, and `daily_credit_budget`. Check credit budget
>    against current month's usage in preferences.md. Set `use_theirstack`
>    flag accordingly.

### Batching Protocol - Phase 1 (replace)

Replace the current Phase 1 search strategy with:

> **Phase 1a -- TheirStack discovery** (if `use_theirstack` is true):
>
> Issue TheirStack API call via WebFetch with search criteria from search.md.
>
> **Phase 1b -- Niche board supplement** (Monday and Thursday only):
>
> Issue WebSearch queries for niche boards in parallel:
> ```
> [WebSearch: "Tech Jobs for Good" VP Engineering]
> [WebSearch: "Purpose Jobs" VP Engineering]
> [WebSearch: "Built In Austin" VP Engineering]
> ```
>
> **Phase 1c -- WebSearch fallback** (only when TheirStack unavailable):
>
> Fall back to the current full WebSearch strategy.

### Batching Protocol - Phase 2 (update)

Add URL domain routing before WebFetch:

> Before issuing WebFetch calls, group URLs by domain. For Greenhouse, Lever,
> and Ashby URLs, use their respective public APIs via WebFetch. Issue all
> verification calls in parallel.

### Search Strategy (update)

Add TheirStack as the primary source. Keep the existing WebSearch strategy
as fallback documentation.

### allowed-tools (no change)

TheirStack and ATS API calls are made via the existing WebFetch tool (HTTP
GET/POST to API endpoints). No new tools needed.

---

## New Files

| File | Purpose | Committed? |
|------|---------|-----------|
| `integrations/config/theirstack-config.md` | API key + settings | No (gitignored) |
| `integrations/config/theirstack-config.md.example` | Template for setup | Yes |
| `integrations/adapters/theirstack.md` | API contract + field mapping | Yes |
| `integrations/adapters/ats-apis.md` | ATS verification API reference | Yes |

---

## Modified Files

| File | Change |
|------|--------|
| `skills/daily-digest/SKILL.md` | Add TheirStack Phase 1a, ATS routing in Phase 2, budget check in setup |
| `config/search.md` | No change needed (skill reads existing fields) |

Note: `.gitignore` already covers `integrations/config/*.md` via an existing
glob pattern — no change needed.

---

## Error Handling

All errors are non-blocking, matching the existing pattern from
`integrations/adapters/apple-notes.md`:

- TheirStack failure -> fall back to WebSearch. Log error. Digest still runs.
- ATS API failure -> fall back to WebFetch for that URL. Log error.
- Budget exhausted -> skip TheirStack, use WebSearch. No error needed.
- All sources fail -> digest reports "no new roles found today" rather than
  crashing.

Failures are never silently swallowed. The user always knows when a source
is unavailable.

---

## Testing Plan

1. **TheirStack API validation**: Run a single API call with current search.md
   criteria and verify response structure matches expected field mapping
2. **ATS API validation**: Test each ATS endpoint (Greenhouse, Lever, Ashby)
   with a known open posting and a known closed/404 posting
3. **Budget tracking**: Run digest twice, verify credit counts accumulate
   correctly in preferences.md
4. **Fallback behavior**: Temporarily set daily_credit_budget to 0, verify
   WebSearch fallback activates
5. **Ashby title matching**: Verify that Ashby verification correctly matches
   target titles from a full board listing (Ashby returns all open postings,
   unlike Greenhouse/Lever which return by ID). Test with a board that has
   many postings to confirm partial-match accuracy.
6. **End-to-end**: Run full daily-digest with TheirStack enabled, verify digest
   output matches expected format and quality

---

## Interactive Visualization

An interactive flow diagram is available at:
`docs/superpowers/visualizations/source-priority-flow.html`

Serve locally with: `bunx http-server docs/superpowers/visualizations -p 8123`

Features:
- Click any node for detailed documentation
- Simulate day scenarios (Tuesday, Monday, end-of-month) to see which paths
  activate and budget impact

---

## Success Criteria

- Hit rate improves from ~20% to 85-90% (roles surfaced are relevant and open)
- Monthly cost stays at $0 (TheirStack free tier + free ATS APIs)
- Digest run time is comparable or faster (fewer WebFetch calls that fail)
- No regression in Apple Notes output quality
- Graceful degradation when TheirStack is unavailable
