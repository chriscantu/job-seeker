# TheirStack + ATS API Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace WebSearch-only discovery with TheirStack API as primary source and add direct ATS API verification for Greenhouse, Lever, and Ashby to improve hit rate from ~20% to 85-90%.

**Architecture:** TheirStack API fires daily via WebFetch, returning structured JSON filtered by title regex, company size, location, and recency. ATS URL routing dispatches Greenhouse/Lever/Ashby postings to their respective free public APIs instead of WebFetch, giving definitive open/closed status. WebSearch covers niche boards 2x/week and serves as a full fallback when TheirStack credits are exhausted.

**Tech Stack:** Markdown skill files (Claude Code), WebFetch for API calls, existing state file pattern (`output/*-preferences.md` for credit tracking).

**Spec:** `docs/superpowers/specs/2026-03-15-theirstack-ats-integration-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `integrations/config/theirstack-config.md.example` | Committed template — shows structure, placeholder values |
| Create | `integrations/config/theirstack-config.md` | Gitignored — real API key and settings (user sets this up) |
| Create | `integrations/adapters/theirstack.md` | API contract, field mapping, error handling reference |
| Create | `integrations/adapters/ats-apis.md` | Greenhouse/Lever/Ashby endpoint reference + URL routing logic |
| Modify | `skills/daily-digest/SKILL.md` | Add TheirStack Phase 1a, ATS routing in Phase 2, budget check in Before You Start |

---

## Chunk 1: Config and Adapter Files

### Task 1: Create TheirStack config example

**Files:**
- Create: `integrations/config/theirstack-config.md.example`

- [ ] **Step 1: Create the example config file**

  `integrations/config/theirstack-config.md.example`:

  ```markdown
  # TheirStack Configuration

  # API key from https://theirstack.com/dashboard/api-keys
  # Rename this file to theirstack-config.md and add your key.
  # This file is gitignored — never commit the real key.
  api_key: tsk_xxxxxxxxxxxxxxxx

  # TheirStack API base URL (do not change)
  base_url: https://api.theirstack.com/v1

  # Maximum TheirStack credits to spend per day.
  # Free tier: 200 credits/month. Setting 8 gives ~25 days of coverage.
  daily_credit_budget: 8
  ```

- [ ] **Step 2: Verify the file exists and matches the pattern in notes-config.md.example**

  Run: `cat integrations/config/theirstack-config.md.example`
  Expected: File shows `api_key`, `base_url`, `daily_credit_budget` fields with comments.

- [ ] **Step 3: Commit**

  ```
  git add integrations/config/theirstack-config.md.example
  git commit -m "feat: add TheirStack config template"
  ```

---

### Task 2: Create TheirStack adapter reference

**Files:**
- Create: `integrations/adapters/theirstack.md`

- [ ] **Step 1: Create the adapter file**

  `integrations/adapters/theirstack.md`:

  ````markdown
  # Adapter: TheirStack Jobs API (v1)

  **System**: TheirStack (https://theirstack.com)
  **Access method**: REST API via WebFetch
  **Auth required**: Bearer token in Authorization header
  **Direction**: Read-only (job discovery)
  **Status**: Active

  ---

  ## How It Works

  The daily-digest skill calls the TheirStack `/jobs/search` endpoint to
  discover executive engineering roles. TheirStack aggregates 321K+ job sites
  and supports regex title matching, company size filtering, and recency
  filtering — enabling high-precision queries that WebSearch cannot match.

  All query parameters are derived from `config/search.md` at runtime.
  The skill never hardcodes search criteria.

  ---

  ## Configuration (from `integrations/config/theirstack-config.md`)

  ```
  api_key: tsk_xxxxxxxxxxxxxxxx
  base_url: https://api.theirstack.com/v1
  daily_credit_budget: 8
  ```

  `api_key` — obtain from https://theirstack.com/dashboard/api-keys
  `base_url` — do not change
  `daily_credit_budget` — credits to spend per day (200 credits/month free tier)

  ---

  ## API Call

  All parameters are derived from `config/search.md` at runtime.

  ```
  POST {base_url}/jobs/search
  Headers:
    Authorization: Bearer {api_key}
    Content-Type: application/json
  Body:
    job_title_pattern: "{regex from Target Role Titles in search.md}"
    company_size: ["51-500", "501-1000"]
    location: "Austin, TX"
    remote: true
    posted_after: "{YYYY-MM-DD of yesterday}"
    limit: 10
  ```

  > **Implementation note (from live API validation):** The parameters above were
  > found to be unsupported. The actual API uses:
  > - `job_title_or`: array of title strings (not a regex)
  > - `posted_at_gte`: date string (not `posted_after`)
  > - `company_size`, `location`, `remote` are NOT supported query params — filter post-retrieval
  > See `integrations/adapters/theirstack.md` for the validated API contract.

  ### Query Parameter Construction

  **job_title_pattern** — build a regex from the Target Role Titles list in
  search.md. Join titles with `|`. Example for current search.md:
  ```
  "Senior Director.*Engineering|VP.*Engineering|Head.*Engineering|SVP.*Engineering|VP.*Platform Engineering|VP.*Developer Experience"
  ```

  **company_size** — derived from "Company Types: Mission-driven, growth-stage,
  midsize" in search.md:

  | search.md term | TheirStack value | Rationale |
  |---------------|-----------------|-----------|
  | growth-stage  | "51-500"        | Series A-C companies scaling engineering |
  | midsize       | "501-1000"      | Established but not enterprise-scale |
  | mission-driven| (not filterable)| Assessed in Phase 3 for star rating and "Why this fits" |

  **location + remote** — derived from Location Constraints in search.md:

  | search.md field          | TheirStack param | Value         |
  |--------------------------|-----------------|---------------|
  | Remote Preference        | `remote`        | `true`        |
  | Hybrid (Austin TX area)  | `location`      | `"Austin, TX"`|
  | Relocation required: No  | (Phase 3 filter)| —             |
  | 100% in-office: No       | (Phase 3 filter)| —             |

  Setting both `remote: true` and `location: "Austin, TX"` captures remote-anywhere
  AND Austin-hybrid roles. Relocation-required and in-office-only roles are filtered
  during Phase 3 compose, not at the API level.

  ---

  ## Field Mapping

  | TheirStack field | Digest field | Notes |
  |-----------------|-------------|-------|
  | `job_title`     | Title       | Direct map |
  | `company_name`  | Company     | Direct map |
  | `location`      | Location    | Direct map |
  | `url`           | Link        | Verify via ATS API or WebFetch before use |
  | `posted_at`     | (internal)  | Used to confirm recency |
  | `company_size`  | (internal)  | Already filtered in query |

  ---

  ## Budget Tracking

  After each TheirStack call, append to `output/*-preferences.md`:

  ```
  ### TheirStack Credits
  - YYYY-MM-DD: credits_used=N, month_total=N, month_limit=200
  ```

  **Budget check (runs at Phase 1 start):**

  1. Read most recent `output/*-preferences.md`
  2. Find the `### TheirStack Credits` section
  3. Sum all entries for the current calendar month to get `month_total`
  4. If `month_total + daily_credit_budget >= 200` → skip TheirStack, use WebSearch fallback
  5. If `month_total + daily_credit_budget < 200` → proceed with TheirStack

  ---

  ## Error Handling

  | HTTP status | Action |
  |-------------|--------|
  | 200         | Parse `data` array, proceed to verification |
  | 401         | Log "TheirStack API key invalid — check theirstack-config.md", fall back to WebSearch |
  | 402         | Log "TheirStack credits exhausted for this period", fall back to WebSearch |
  | 429         | Log "TheirStack rate limited", fall back to WebSearch |
  | 5xx         | Log "TheirStack server error: {status}", fall back to WebSearch |
  | Timeout     | Log "TheirStack request timed out", fall back to WebSearch |

  All errors are non-blocking. The digest always runs even if TheirStack is
  unavailable. Failures are logged to the console — never silently swallowed.

  ---

  ## Credit Cost Reference

  TheirStack charges credits per result returned (not per query). Approximate costs:
  - 1-5 results: ~3-4 credits
  - 6-10 results: ~5-8 credits
  - `limit: 10` with `daily_credit_budget: 8` gives ~1-2 calls per day safely

  Check https://theirstack.com/pricing for current credit costs.
  ````

- [ ] **Step 2: Verify the file structure matches apple-notes.md pattern**

  Run: `ls integrations/adapters/`
  Expected: `apple-notes.md  theirstack.md`

- [ ] **Step 3: Commit**

  ```
  git add integrations/adapters/theirstack.md
  git commit -m "feat: add TheirStack adapter reference doc"
  ```

---

### Task 3: Create ATS APIs adapter reference

**Files:**
- Create: `integrations/adapters/ats-apis.md`

- [ ] **Step 1: Create the adapter file**

  `integrations/adapters/ats-apis.md`:

  ````markdown
  # Adapter: ATS Verification APIs

  **Systems**: Greenhouse, Lever, Ashby (public job board APIs)
  **Access method**: REST API via WebFetch
  **Auth required**: None — all are public endpoints
  **Direction**: Read-only (job verification)
  **Status**: Active

  ---

  ## Purpose

  These APIs replace WebFetch HTML parsing for the three most common ATS
  platforms used by growth-stage and midsize companies. Direct API calls
  return structured JSON with definitive open/closed status — eliminating
  false positives from stale Google-indexed postings and JS-rendered pages.

  ---

  ## URL Routing Logic

  The daily-digest skill inspects each result URL and routes to the appropriate
  verification method. Check these patterns in order:

  | URL pattern | Verification method |
  |-------------|-------------------|
  | `boards.greenhouse.io/{company}/jobs/{id}` | Greenhouse API |
  | `job-boards.greenhouse.io/{company}/jobs/{id}` | Greenhouse API (same endpoint) |
  | `jobs.lever.co/{company}/{id}` | Lever API |
  | `jobs.ashbyhq.com/{company}` | Ashby API |
  | Anything else | WebFetch (existing behavior) |

  ---

  ## Greenhouse

  **Endpoint**: `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}`

  **Extract from URL**: Parse `{company}` and `{id}` from the URL path.
  - `boards.greenhouse.io/acme/jobs/123456` → company=`acme`, id=`123456`
  - `job-boards.greenhouse.io/acme/jobs/123456` → same extraction

  **Response (open posting)**:
  ```json
  {
    "id": 123456,
    "title": "VP of Engineering",
    "location": { "name": "Remote" },
    "content": "...",
    "updated_at": "2026-03-14T12:00:00Z"
  }
  ```

  **Interpretation**:
  - 200 with job object → posting is open ✅
  - 404 → posting is closed or never existed ❌ — mark as CLOSED in seen-postings
  - Any other error → fall back to WebFetch for this URL

  **No auth required.**

  ---

  ## Lever

  **Endpoint**: `GET https://api.lever.co/v0/postings/{company}/{id}`

  **Extract from URL**: Parse `{company}` and `{id}` from `jobs.lever.co/{company}/{id}`.

  **Response (open posting)**:
  ```json
  {
    "id": "abc-123",
    "text": "VP of Engineering",
    "categories": { "team": "Engineering", "location": "Remote" },
    "urls": { "apply": "https://jobs.lever.co/acme/abc-123/apply" }
  }
  ```

  **Interpretation**:
  - 200 with posting object → posting is open ✅
  - 404 → posting is closed ❌ — mark as CLOSED in seen-postings
  - Any other error → fall back to WebFetch for this URL

  **No auth required.**

  ---

  ## Ashby

  **Endpoint**: `POST https://api.ashbyhq.com/posting-api/job-board/{company}`

  **Extract from URL**: Parse `{company}` from `jobs.ashbyhq.com/{company}`.
  Note: Ashby URLs do not include a job ID in the path — the endpoint returns
  ALL open postings for the company, and the skill must match by title.

  **Request body**: `{}` (empty JSON object — no filters needed)

  **Response**:
  ```json
  {
    "jobs": [
      {
        "id": "abc-123",
        "title": "VP of Engineering",
        "locationName": "Remote",
        "teamName": "Engineering",
        "jobUrl": "https://jobs.ashbyhq.com/acme/abc-123"
      }
    ]
  }
  ```

  **Title matching**: Search the `jobs` array for an entry whose `title` matches
  the role being verified. Use case-insensitive comparison. If a match is found,
  the posting is open. If not found in the array, the posting is closed.

  **Interpretation**:
  - 200 + title found in `jobs` array → posting is open ✅
  - 200 + title NOT found → posting is closed ❌ — mark as CLOSED in seen-postings
  - 404 → company board does not exist ❌
  - Any other error → fall back to WebFetch for this URL

  **No auth required.**

  ---

  ## Error Handling (all ATS APIs)

  | Scenario | Action |
  |----------|--------|
  | API returns 200 + job data | Posting is open — use structured fields for digest |
  | API returns 404 | Posting is closed — mark CLOSED in seen-postings, exclude from digest |
  | API returns 5xx | Log error, fall back to WebFetch for this URL |
  | Network timeout | Log error, fall back to WebFetch for this URL |
  | JSON parse failure | Log error, fall back to WebFetch for this URL |

  All fallbacks are non-blocking. WebFetch handles any URL the ATS APIs cannot.

  ---

  ## Batching

  Issue ALL verification calls (ATS API + WebFetch) in a single parallel batch,
  matching the existing batching protocol in `skills/daily-digest/SKILL.md`.
  Do not verify URLs one at a time.
  ````

- [ ] **Step 2: Verify file exists**

  > **Implementation note (from live API validation):**
  > - Ashby: endpoint is GET, not POST. No request body.
  > - Ashby fields: `location` and `team` (not `locationName`/`teamName`)
  > - Lever fields: `hostedUrl` and `applyUrl` at top level (not `urls.apply` nested)
  > See `integrations/adapters/ats-apis.md` for the validated API contracts.

  Run: `ls integrations/adapters/`
  Expected: `apple-notes.md  ats-apis.md  theirstack.md`

- [ ] **Step 3: Commit**

  ```
  git add integrations/adapters/ats-apis.md
  git commit -m "feat: add ATS verification APIs adapter reference doc"
  ```

---

### Task 4: Create real TheirStack config (gitignored, user-facing)

**Files:**
- Create: `integrations/config/theirstack-config.md`

- [ ] **Step 1: Copy example to real config**

  Run: `cp integrations/config/theirstack-config.md.example integrations/config/theirstack-config.md`

- [ ] **Step 2: Verify it is gitignored**

  Run: `git status integrations/config/theirstack-config.md`
  Expected: file does NOT appear (gitignored by `integrations/config/*.md` pattern)
  If it appears, investigate `.gitignore` before proceeding.

- [ ] **Step 3: ⛔ STOP — human action required before continuing**

  This step requires the user to manually obtain a TheirStack API key.
  Do NOT proceed to Step 4 until the user confirms the key is ready.

  Notify the user:
  > "Please visit https://theirstack.com/dashboard/api-keys, create a free
  > account if you haven't already, and copy your API key (it starts with `tsk_`).
  > Reply with the key and I'll add it to the config file."

  Wait for the user's response before continuing.

- [ ] **Step 4: Edit the config file with the real key**

  Edit `integrations/config/theirstack-config.md`:
  - Replace `tsk_xxxxxxxxxxxxxxxx` with the real API key provided by the user
  - Leave `base_url` and `daily_credit_budget` as-is

- [ ] **Step 5: Verify config is NOT staged**

  Run: `git status`
  Expected: `integrations/config/theirstack-config.md` does not appear in output.

---

## Chunk 2: Update daily-digest SKILL.md

### Task 5: Add TheirStack setup step to "Before You Start"

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

The current "Before You Start" section has 6 numbered steps. Step 6 is the
optional Apple Notes config check (confirmed in file at lines 65-67). Add the
TheirStack config check as step 7, appended after step 6.

- [ ] **Step 1: Confirm step 6 location in the file**

  Read `skills/daily-digest/SKILL.md` lines 55-70. Confirm step 6 ends with
  "Skip this step if the file does not exist." and is followed by a blank line
  and `---`. This is the exact insertion point.

- [ ] **Step 2: Add the TheirStack setup step**

  After the existing step 6 (Apple Notes config check), append step 7:

  ```markdown
  7. (Optional — TheirStack only) If `integrations/config/theirstack-config.md`
     exists, read it to get `api_key`, `base_url`, and `daily_credit_budget`.
     Then check budget: read `output/*-preferences.md` (most recent), find the
     `### TheirStack Credits` section, and sum all entries for the current
     calendar month to get `month_total`. If `month_total + daily_credit_budget
     >= 200`, set `use_theirstack = false` (budget exhausted, fall back to
     WebSearch). Otherwise set `use_theirstack = true`. Skip this step entirely
     if the config file does not exist (`use_theirstack = false`).
  ```

- [ ] **Step 3: Verify the file looks correct**

  Read `skills/daily-digest/SKILL.md` "Before You Start" section.
  Expected: 7 numbered steps, step 7 references `theirstack-config.md` and
  `use_theirstack` flag.

- [ ] **Step 4: Commit**

  ```
  git add skills/daily-digest/SKILL.md
  git commit -m "feat: add TheirStack budget check to daily-digest setup"
  ```

---

### Task 6: Replace Phase 1 with TheirStack + niche board strategy

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

Replace the current "Phase 1 — Parallel Searches" section with three sub-phases:
1a (TheirStack), 1b (niche boards Mon/Thu), 1c (WebSearch fallback).

- [ ] **Step 1: Read the current Phase 1 section**

  Read `skills/daily-digest/SKILL.md` "Batching Protocol" section to confirm
  current Phase 1 text.

- [ ] **Step 2: Replace Phase 1 content**

  Replace the `### Phase 1 — Parallel Searches (single message, all calls at once)`
  section with:

  ````markdown
  ### Phase 1 — Discovery (single message per sub-phase, all calls at once)

  #### Phase 1a — TheirStack API (if `use_theirstack` is true)

  Issue a single WebFetch call to the TheirStack API with criteria from
  `config/search.md`. See `integrations/adapters/theirstack.md` for the full
  request format, field mapping, and error handling.

  Build the request body at runtime from search.md:
  - `job_title_pattern`: regex from Target Role Titles (join with `|`)
  - `company_size`: `["51-500", "501-1000"]`
  - `location`: hybrid city from Location Constraints (e.g., `"Austin, TX"`)
  - `remote`: `true` (Remote Preference = "Remote or Hybrid")
  - `posted_after`: yesterday's date in `YYYY-MM-DD` format
  - `limit`: `10`

  On any non-200 response, log the error and set `use_theirstack = false` so
  Phase 1c runs instead.

  After a successful call, append credit usage to `output/*-preferences.md`:
  ```
  ### TheirStack Credits
  - {YYYY-MM-DD}: credits_used={N}, month_total={running_total}, month_limit=200
  ```

  #### Phase 1b — Niche board supplement (Monday and Thursday only)

  Check `date +%A` to determine the current day. If Monday or Thursday, issue
  these WebSearch queries in parallel (single message):

  ```
  [WebSearch: site:techjobsforgood.com "VP Engineering" OR "Senior Director Engineering" remote]
  [WebSearch: site:purpose.jobs "VP Engineering" OR "Senior Director Engineering"]
  [WebSearch: site:builtin.com/jobs Austin "VP Engineering" OR "Senior Director Engineering"]
  ```

  Wait for all results before merging with Phase 1a results.

  #### Phase 1c — WebSearch fallback (only when `use_theirstack` is false)

  If TheirStack is unavailable or budget is exhausted, issue ALL search queries
  simultaneously (same as original Phase 1):

  ```
  [WebSearch: Ashby VP Engineering remote]
  [WebSearch: Greenhouse VP Engineering remote]
  [WebSearch: Lever healthcare VP Engineering]
  [WebSearch: EdTech VP Engineering remote]
  [WebSearch: Lever climate/sustainability VP Engineering]
  [WebSearch: Mission-driven VP Engineering remote]
  ```

  Wait for all results before proceeding.
  ````

- [ ] **Step 3: Verify Phase 1 section reads correctly**

  Read the Batching Protocol section of `skills/daily-digest/SKILL.md`.
  Expected: Three sub-phases (1a, 1b, 1c) with clear trigger conditions.

- [ ] **Step 4: Commit**

  ```
  git add skills/daily-digest/SKILL.md
  git commit -m "feat: replace Phase 1 WebSearch with TheirStack + niche board strategy"
  ```

---

### Task 7: Update Phase 2 to route ATS URLs to direct APIs

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

Add ATS URL routing before the WebFetch fallback in Phase 2.

- [ ] **Step 1: Read the current Phase 2 section**

  Read the `### Phase 2 — Parallel URL Verification` section in SKILL.md.

- [ ] **Step 2: Replace Phase 2 content**

  Replace the Phase 2 section with:

  ````markdown
  ### Phase 2 — Parallel URL Verification (single message, all calls at once)

  After collecting candidates from Phase 1, group URLs by domain and issue ALL
  verifications simultaneously in one message. See
  `integrations/adapters/ats-apis.md` for full endpoint details and response
  interpretation.

  **For each URL, determine the verification method:**

  | URL contains | Method |
  |-------------|--------|
  | `boards.greenhouse.io` or `job-boards.greenhouse.io` | `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` |
  | `jobs.lever.co` | `GET https://api.lever.co/v0/postings/{company}/{id}` |
  | `jobs.ashbyhq.com` | `POST https://api.ashbyhq.com/posting-api/job-board/{company}` (match by title in response) |
  | Anything else | WebFetch (existing behavior) |

  Issue all verification calls as a single parallel batch:
  ```
  [WebFetch: greenhouse API for url1] [WebFetch: lever API for url2] [WebFetch: url3] ...
  ```

  **Interpreting results:**
  - 200 + job data → posting is open, include in digest
  - 404 → posting is closed — mark as `CLOSED` in Seen Postings note, exclude
  - API error → fall back to WebFetch for that URL only
  - WebFetch returns 404 or "no longer accepting" text → mark CLOSED, exclude

  Wait for all results before composing the digest.
  ````

- [ ] **Step 3: Verify Phase 2 section reads correctly**

  Read the Phase 2 section in SKILL.md.
  Expected: URL routing table, parallel batch instruction, and result
  interpretation for all four cases (open, closed, API error, WebFetch).

- [ ] **Step 4: Commit**

  ```
  git add skills/daily-digest/SKILL.md
  git commit -m "feat: add ATS API routing to Phase 2 URL verification"
  ```

---

### Task 8: Update Search Strategy section

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

The Search Strategy section currently describes the WebSearch-only approach.
Update it to describe TheirStack as primary and WebSearch as fallback.

- [ ] **Step 1: Read the current Search Strategy section**

  Read the `## Search Strategy` section in SKILL.md.

- [ ] **Step 2: Replace Search Strategy content**

  Replace the `## Search Strategy` section with:

  ```markdown
  ## Search Strategy

  **Primary (daily):** TheirStack API — see Phase 1a above. Covers 321K+ job
  sites with structured filters for title, company size, location, and recency.

  **Supplement (Mon + Thu):** WebSearch against niche mission-driven boards
  (Tech Jobs for Good, Purpose Jobs, Built In Austin) — see Phase 1b above.

  **Fallback (when TheirStack unavailable or credits exhausted):** Full WebSearch
  across all sources — see Phase 1c above. Vary queries each run:
  - Major boards (Indeed, LinkedIn, Glassdoor, Built In)
  - Mission-driven boards (Tech Jobs for Good, Purpose Jobs, Wellfound)
  - Industry-specific (healthcare tech, EdTech, construction tech, PropTech)
  - Austin-area hybrid roles specifically

  Weight effort toward sources that have historically produced relevant results
  (check Preferences note for source effectiveness data).
  ```

- [ ] **Step 3: Verify the section reads correctly**

  Read `## Search Strategy` in SKILL.md.
  Expected: TheirStack listed as primary, niche boards as supplement, full
  WebSearch as fallback.

- [ ] **Step 4: Commit**

  ```
  git add skills/daily-digest/SKILL.md
  git commit -m "feat: update Search Strategy to reflect TheirStack as primary source"
  ```

---

## Chunk 3: Validation

### Task 9: Validate TheirStack API call

- [ ] **Step 1: Run a test API call via WebFetch**

  Use WebFetch to POST to `https://api.theirstack.com/v1/jobs/search` with:
  ```json
  {
    "job_title_pattern": "VP.*Engineering|Senior Director.*Engineering",
    "company_size": ["51-500", "501-1000"],
    "location": "Austin, TX",
    "remote": true,
    "posted_after": "2026-03-14",
    "limit": 5
  }
  ```
  Include `Authorization: Bearer {api_key}` header (read from theirstack-config.md).

- [ ] **Step 2: Verify response structure**

  Expected: 200 response with a `data` array containing job objects with
  `job_title`, `company_name`, `location`, `url`, `posted_at` fields.

  If 401: API key is wrong — re-check theirstack-config.md and repeat Task 4.
  If 402: Account not set up correctly — check TheirStack dashboard.
  If 4xx/5xx other: Add a `## Known Issues` section to
  `integrations/adapters/theirstack.md` documenting the error and any
  workaround found, then commit:
  ```
  git add integrations/adapters/theirstack.md
  git commit -m "docs: add TheirStack API validation notes"
  ```

- [ ] **Step 3: Verify field mapping**

  Confirm at least one result has all fields from the TheirStack field mapping
  table in `integrations/adapters/theirstack.md`.

---

### Task 10: Validate ATS verification APIs

- [ ] **Step 1: Test Greenhouse API with a known open posting**

  Find any open Greenhouse role (e.g., search for a company that uses Greenhouse).
  Call: `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}`
  Expected: 200 with job object containing `title`, `location`.

- [ ] **Step 2: Test Greenhouse API with a closed/invalid posting**

  Use a made-up ID, e.g.: `GET https://boards-api.greenhouse.io/v1/boards/stripe/jobs/999999999`
  Expected: 404 response.

- [ ] **Step 3: Test Lever API**

  Find any open Lever role and call: `GET https://api.lever.co/v0/postings/{company}/{id}`
  Expected: 200 with posting object.

- [ ] **Step 4: Test Ashby API**

  Find a company using Ashby (e.g., search jobs.ashbyhq.com for a known company).
  Call: `POST https://api.ashbyhq.com/posting-api/job-board/{company}` with `{}` body.
  Expected: 200 with `jobs` array.

  Verify that title matching works: find a title in the array and confirm a
  case-insensitive search for that title finds it.

- [ ] **Step 5: Commit validation notes**

  If any API behaved unexpectedly, add a note to `integrations/adapters/ats-apis.md`
  under a `## Known Issues` section, then:

  ```
  git add integrations/adapters/ats-apis.md
  git commit -m "docs: add ATS API validation notes"
  ```

  If all APIs behaved as expected, no commit needed.

---

### Task 11: End-to-end digest run

- [ ] **Step 1: Test fallback behavior (budget exhaustion)**

  Temporarily add a fake high-credit entry to the most recent `output/*-preferences.md`:
  ```
  ### TheirStack Credits
  - 2026-03-01: credits_used=8, month_total=195, month_limit=200
  ```

  Trigger: "run my job digest"

  Expected: `month_total (195) + daily_credit_budget (8) = 203 >= 200` → Phase 1a
  is skipped, Phase 1c (full WebSearch) fires instead. Confirm in the digest
  footer or console output that TheirStack was not called.

  After verifying, remove the fake entry from preferences.md.

- [ ] **Step 2: Run daily-digest with TheirStack enabled**

  Trigger: "run my job digest"

  Expected behaviour:
  - Skill reads `theirstack-config.md` and sets `use_theirstack = true`
  - Phase 1a fires a TheirStack WebFetch call
  - Phase 2 routes Greenhouse/Lever/Ashby URLs to their respective APIs
  - Digest output written (Apple Notes if configured, or `output/digest-{date}.html` fallback)
  - `output/*-preferences.md` has a new `### TheirStack Credits` entry

  Note: Apple Notes output requires `integrations/config/notes-config.md` to
  exist. If it does not, verify the fallback HTML file at `output/digest-{date}.html`.

- [ ] **Step 3: Verify digest quality**

  Check the digest (Apple Notes or HTML fallback):
  - All roles have direct ATS or company URLs (no aggregator links)
  - All roles are verified open (no 404s surfaced)
  - Star ratings and "Why this fits" text are present
  - At least one TheirStack-sourced role appears (confirm via URL pattern)

- [ ] **Step 4: Verify credit tracking**

  Read `output/*-preferences.md`.
  Expected: New entry under `### TheirStack Credits` with today's date and
  `credits_used`, `month_total`, `month_limit` fields.

- [ ] **Step 5: Final commit (if any remaining changes)**

  ```
  git add -p
  git commit -m "chore: post-validation cleanup"
  ```

---

## PR Checklist

Before opening the PR, verify:

- [ ] All 4 new files exist: `theirstack-config.md.example`, `theirstack.md`, `ats-apis.md`, and the gitignored `theirstack-config.md`
- [ ] `theirstack-config.md` does NOT appear in `git status` (gitignored)
- [ ] `skills/daily-digest/SKILL.md` has all three changes: step 7 in Before You Start, new Phase 1 (1a/1b/1c), new Phase 2 routing table
- [ ] End-to-end digest ran successfully with TheirStack enabled
- [ ] Credit tracking entry exists in preferences.md
- [ ] Open the PR against `main` with title: `feat: TheirStack primary discovery + ATS API verification`
