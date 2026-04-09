# Skill Module Extraction & Decomposition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract ~750 duplicated lines from 11 SKILL.md files into 7 shared modules (`skills/_shared/`), then decompose each skill into an orchestrator + local modules.

**Architecture:** Shared modules under `skills/_shared/` contain canonical logic for preflight, state I/O, ATS verification, URL quality, company extraction, Apple Notes, and batching. Each skill's SKILL.md becomes an orchestrator that issues `Read` directives to shared and local modules on demand per phase. No behavioral changes — identical output before and after.

**Tech Stack:** Markdown instruction files (no code changes). All files are natural-language instructions read by Claude at skill execution time.

---

## File Structure

### New files to create

```
skills/_shared/
  preflight.md              ← config validation + standard reads
  state-io.md               ← glob/read/append patterns for all state files
  ats-verification.md       ← URL routing, API interpretation, posting dates
  url-quality.md            ← aggregator exclusion, URL priority, title normalization
  company-extraction.md     ← parse company name/slug from URLs
  apple-notes.md            ← optional notes integration
  batching.md               ← universal parallel batching rule

skills/daily-digest/
  scoring-rules.md          ← star ratings, comp evaluation
  source-strategy.md        ← TheirStack, niche boards, search queries

skills/scan-email/
  classification-rules.md   ← subject/body pattern matching, sender routing
  body-extraction.md        ← HTML/text parsing, field extraction

skills/resume-tailor/
  tailoring-rules.md        ← section rewriting, keyword matching

skills/application-tracker/
  pipeline-schema.md        ← stage definitions, staleness, transitions
```

### Files to modify (rewrite as orchestrators)

```
skills/daily-digest/SKILL.md
skills/scan-email/SKILL.md
skills/resume-tailor/SKILL.md
skills/application-tracker/SKILL.md
skills/company-research/SKILL.md
skills/cover-letter/SKILL.md
skills/why-this-company/SKILL.md
skills/linkedin-article/SKILL.md
skills/setup/SKILL.md
skills/interview-prep/SKILL.md
skills/networking-outreach/SKILL.md
```

---

### Task 1: Create `skills/_shared/preflight.md`

**Files:**
- Create: `skills/_shared/preflight.md`

- [ ] **Step 1: Create the shared directory and preflight module**

Write `skills/_shared/preflight.md` with the following content:

```markdown
# Preflight — Config Validation & Standard Reads

Every skill executes this module before doing any work.

## Step 1: Validate Configuration

Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the
error to the user. Do not proceed with any subsequent phase.

## Step 2: Read Core Files

Read these files in parallel (single message, all reads at once):

1. **`PRINCIPLES.md`** — quality standards, voice guidelines, privacy constraints.
   These govern all output produced by the skill.
2. **`config/candidate.md`** — candidate name, current role, target roles, core
   strengths, accomplishments, education, location, email.
3. **`config/search.md`** — target role titles, comp floor, location constraints,
   company types, company stage floor, companies to skip, sources, remote
   preference.

All three reads are required. If any file is missing, `validate-config.js` will
have already caught it in Step 1.
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/preflight.md
git commit -m "feat: add shared preflight module (skills/_shared/preflight.md)"
```

---

### Task 2: Create `skills/_shared/batching.md`

**Files:**
- Create: `skills/_shared/batching.md`

- [ ] **Step 1: Write the batching module**

Write `skills/_shared/batching.md`:

```markdown
# Batching Protocol

This rule applies to every phase of every skill that issues multiple tool calls.

## The Rule

**Issue ALL independent tool calls in a single message.** Never issue searches,
fetches, or verifications one at a time — this forces the user to approve each
call individually and creates a terrible experience.

## When This Applies

- **WebSearch** — if a phase requires 3 searches, all 3 go in one message
- **WebFetch** — if verifying 5 URLs, all 5 go in one message
- **ATS API calls** — all verification calls in one parallel batch
- **Body fetches** — all email body reads in one message
- **Any other multi-target operation** — same principle

## How to Batch

If a phase has N independent calls, they go in **one message** with N tool calls,
not N messages with 1 tool call each.

```
[WebSearch: query1] [WebSearch: query2] [WebSearch: query3]
```

Not:
```
[WebSearch: query1]
... wait for approval ...
[WebSearch: query2]
... wait for approval ...
[WebSearch: query3]
```

## Exceptions

- Calls that depend on previous results (e.g., Phase 2 depends on Phase 1 output)
  must be sequential — but within each phase, batch everything.
- If a batch is very large (20+ calls), splitting into 2-3 sub-batches is acceptable
  to avoid timeouts.
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/batching.md
git commit -m "feat: add shared batching protocol module"
```

---

### Task 3: Create `skills/_shared/state-io.md`

**Files:**
- Create: `skills/_shared/state-io.md`

- [ ] **Step 1: Write the state I/O module**

Write `skills/_shared/state-io.md`:

```markdown
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

The applications state file has a different structure — see the
`application-tracker` skill's pipeline-schema module for the full schema.
The state-io module handles glob/read/create; the schema is owned by
application-tracker.
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/state-io.md
git commit -m "feat: add shared state I/O module"
```

---

### Task 4: Create `skills/_shared/url-quality.md`

**Files:**
- Create: `skills/_shared/url-quality.md`

- [ ] **Step 1: Write the URL quality module**

Write `skills/_shared/url-quality.md`:

```markdown
# URL Quality Rules

Direct links only. Aggregator URLs are discovery tools — never use them in output.

## Aggregator Exclusion List

These sites are for discovery only. Never use their URLs in digests, seen-postings,
or any user-facing output:

- EchoJobs
- Jobera
- SimplyHired
- RemoteRocketship
- Generic Glassdoor search pages (individual job pages are acceptable)

If a role is found via an aggregator, find the company's actual careers/application
page before including it.

## URL Priority Tiers

When multiple URLs exist for the same role, prefer in this order:

1. **Direct ATS URL** — `boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`
2. **Company careers page** — `company.com/careers/job-id`
3. **Workday/iCIMS/SmartRecruiters** — direct application links
4. **LinkedIn job posting** — `linkedin.com/jobs/view/123456`
5. **NEVER** — aggregator listing pages

## Common ATS URL Patterns

Recognize these patterns to identify direct ATS links:

| ATS | Pattern |
|-----|---------|
| Greenhouse | `boards.greenhouse.io/{company}/jobs/{id}` or `job-boards.greenhouse.io/{company}/jobs/{id}` |
| Lever | `jobs.lever.co/{company}/{id}` |
| Ashby | `jobs.ashbyhq.com/{company}` (no job ID in path) |
| Workday | `{company}.wd5.myworkdayjobs.com/.../job/{title}_{id}` |
| SmartRecruiters | `jobs.smartrecruiters.com/{company}/{id}` |

## Tracking Redirect Resolution

Email alerts often wrap URLs in tracking redirects (Indeed `rc/clk/`, LinkedIn
`/comm/`, etc.). Before using a URL from an email:

1. Issue a WebFetch on the tracking URL
2. Use the final resolved URL (after redirects) for dedup and display
3. If resolution fails, note "unresolved redirect" and use the original URL

## Title Normalization

Before matching titles against search criteria or displaying them, expand
common abbreviations:

| Abbreviation | Expansion |
|-------------|-----------|
| Sr. / Sr  | Senior |
| Jr. / Jr  | Junior |
| Eng. / Eng  | Engineering |
| Mgr. / Mgr  | Manager |
| Dir. / Dir  | Director |
| VP | VP (no change — already standard) |

Apply normalization before:
- Matching against target role titles from `config/search.md`
- Matching against company skip lists
- Displaying roles in digests or result tables
- Dedup comparisons
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/url-quality.md
git commit -m "feat: add shared URL quality rules module"
```

---

### Task 5: Create `skills/_shared/ats-verification.md`

**Files:**
- Create: `skills/_shared/ats-verification.md`

- [ ] **Step 1: Write the ATS verification module**

Write `skills/_shared/ats-verification.md`:

```markdown
# ATS Verification

Verify job posting URLs are live and open using ATS APIs. Read
`integrations/adapters/ats-apis.md` for full endpoint details, request/response
formats, and error handling reference.

## URL Routing

Inspect each URL and route to the appropriate verification method:

| URL pattern | Method |
|-------------|--------|
| `boards.greenhouse.io/{company}/jobs/{id}` or `job-boards.greenhouse.io/{company}/jobs/{id}` | Greenhouse API |
| `jobs.lever.co/{company}/{id}` | Lever API |
| `jobs.ashbyhq.com/{company}` | Ashby API (match by title in response) |
| Anything else | WebFetch the URL directly |

## Batching

Read `skills/_shared/batching.md` for reference. Issue ALL verification calls
in a single parallel batch — ATS API calls and WebFetch calls together in one
message.

## Interpreting Results

| Result | Action |
|--------|--------|
| 200 + job data | Posting is open — include in results |
| 404 | Posting is closed — mark as `CLOSED` in seen-postings, exclude |
| 5xx / timeout / parse error | Fall back to WebFetch for that URL only |
| WebFetch returns 404 or "no longer accepting" text | Mark CLOSED, exclude |
| WebFetch fallback also fails | Exclude role, note: "Could not verify: {URL}" |

## Posting Date Extraction

During verification, extract the original posting date from each source:

| Source | Field | Notes |
|--------|-------|-------|
| TheirStack | `date_posted` | Structured, reliable |
| Greenhouse API | `updated_at` in job JSON | May reflect edits — use as best estimate |
| Lever API | `createdAt` (epoch ms) | Reliable original post date |
| Ashby API | Not exposed in public posting API | Use TheirStack `date_posted` if available, otherwise omit |
| WebFetch (page scrape) | Look for "Posted on" or date metadata | Best-effort — not always present |

Store as `posted:YYYY-MM-DD` in the seen-postings entry. If the date cannot be
determined, use `discovered:YYYY-MM-DD` (today's date) instead.

## Closed Postings

When a posting is confirmed closed (404 from API or WebFetch), update the
seen-postings entry to include `CLOSED` so the role is never resurfaced:

```
- {Company} | {Title} | {URL} | posted:YYYY-MM-DD | CLOSED
```
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/ats-verification.md
git commit -m "feat: add shared ATS verification module"
```

---

### Task 6: Create `skills/_shared/company-extraction.md`

**Files:**
- Create: `skills/_shared/company-extraction.md`

- [ ] **Step 1: Write the company extraction module**

Write `skills/_shared/company-extraction.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/company-extraction.md
git commit -m "feat: add shared company extraction module"
```

---

### Task 7: Create `skills/_shared/apple-notes.md`

**Files:**
- Create: `skills/_shared/apple-notes.md`

- [ ] **Step 1: Write the Apple Notes module**

Write `skills/_shared/apple-notes.md`:

```markdown
# Apple Notes Integration (Optional)

Optional integration for writing to Apple Notes on macOS. Non-blocking — all
errors are logged, never fatal. Skip this module entirely if Apple Notes is
not configured.

## Configuration Check

Check if `integrations/config/notes-config.md` exists:
- **If absent**: skip all Apple Notes operations silently. Do not warn the user.
- **If present**: read `plugin_root` and `default_folder` from the config file.

## Operations

### Create a Note

Creates a new note (replaces if one with the same title exists):

```bash
osascript {plugin_root}/scripts/apple_notes_create.applescript "{title}" "{html_body}" "{folder}"
```

Use for: new digests, new content that should be a standalone note.

### Update a Note

Updates an existing note (upsert — creates if not found):

```bash
osascript {plugin_root}/scripts/apple_notes_update.applescript "{title}" "{html_body}" "{folder}"
```

Use for: state sync (seen-postings, applications, preferences).

### Read a Note

```bash
osascript {plugin_root}/scripts/apple_notes_read.applescript "{title}" "{folder}"
```

### List Notes

```bash
osascript {plugin_root}/scripts/apple_notes_list.applescript "{folder}"
```

## Note Naming

Use the Apple Notes Prefix from `config/search.md` (default: `Job Search`):
- `{prefix} - Seen Postings`
- `{prefix} - Preferences`
- `{prefix} - Applications`

Digest notes use a date-specific title:
- `Executive Job Digest — {Month Day, Year}`

## HTML Rules

Apple Notes HTML must follow these rules (see `integrations/adapters/apple-notes.md`
for full reference):

- Wrap every line in `<div>` tags
- Use `<div><span style="font-size: 11px"><br></span></div>` for blank lines
- Never put `<a href="">` inside `<table>` cells
- Use `<b><span style="font-size: Xpx">` instead of `<h1>`/`<h2>`/`<h3>`
- No CSS classes, `<style>` blocks, or external stylesheets

## Error Handling

- Check return values: success starts with `success:`, failure starts with `error:`
- On error: log to `output/error-{date}.log`, warn the user, continue skill execution
- **Apple Notes errors are non-blocking** — the `output/` files are the source of truth
- Never silently swallow a write failure — surface the error, then continue
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/apple-notes.md
git commit -m "feat: add shared Apple Notes integration module"
```

---

### Task 8: Decompose `daily-digest` — Extract Local Modules

**Files:**
- Create: `skills/daily-digest/scoring-rules.md`
- Create: `skills/daily-digest/source-strategy.md`

- [ ] **Step 1: Write `scoring-rules.md`**

Write `skills/daily-digest/scoring-rules.md`, extracting star ratings, comp evaluation, and the HTML template from the current SKILL.md:

```markdown
# Daily Digest — Scoring Rules

## Star Ratings

- ⭐⭐⭐⭐⭐ = Perfect match (title, comp, mission, remote all align)
- ⭐⭐⭐⭐ = Strong match (one dimension is a stretch but worth pursuing)
- ⭐⭐⭐ = Worth considering (interesting company but notable gaps)

## Comp Evaluation

Use the "Comp Floor" field from `config/search.md`:
- Roles that meet or exceed the comp floor → include in main digest section
- Roles below comp floor but otherwise strong → include in "Noted But Below
  Comp Target" section
- Roles significantly below comp floor with no mission offset → exclude

## Below-Comp Section

Roles below the comp target but with strong mission alignment or other
compelling factors get a separate section in the digest. Use this judgment:
- Would the candidate consider this role if the mission resonated strongly?
- Is the comp gap narrow enough that negotiation could close it?

## HTML Output Template

The `html_body` uses Apple Notes-compatible HTML so the same content works in
both `output/` and Apple Notes — every line wrapped in `<div>` tags.

Substitute `{Name from config/candidate.md}` with the `Name` field value read
from `config/candidate.md` before constructing the HTML body.

```html
<div><b><span style="font-size: 21px">Executive Job Digest — {Month Day, Year}</span></b></div>
<div><span style="font-size: 11px">Good morning {Name from config/candidate.md} — here are today's executive engineering leadership opportunities:</span></div>
<div><span style="font-size: 11px"><br></span></div>
<div><b><span style="font-size: 15px">🏢 {Company Name}</span></b></div>
<div><b><span style="font-size: 11px">📍 Location:</span></b><span style="font-size: 11px"> {Location}</span></div>
<div><b><span style="font-size: 11px">🎯 Mission:</span></b><span style="font-size: 11px"> {1-sentence company mission}</span></div>
<div><b><span style="font-size: 11px">💰 Comp:</span></b><span style="font-size: 11px"> {Comp range or estimate}</span></div>
<div><b><span style="font-size: 11px">⭐ Fit:</span></b><span style="font-size: 11px"> {⭐⭐⭐⭐⭐ / ⭐⭐⭐⭐ / ⭐⭐⭐} — {one-word reason}</span></div>
<div><b><span style="font-size: 11px">📅 Posted:</span></b><span style="font-size: 11px"> {date posted, e.g. "March 20" or "3 days ago"} {omit line if date unknown}</span></div>
<div><b><span style="font-size: 11px">🔗 Link:</span></b><span style="font-size: 11px"> </span><a href="{DIRECT_COMPANY_URL}"><u><span style="font-size: 11px">View Posting</span></u></a></div>
<div><b><span style="font-size: 11px">Why this fits:</span></b><span style="font-size: 11px"> {1-2 sentences tied to the candidate's specific background}</span></div>
<div><span style="font-size: 11px"><br></span></div>
<!-- Repeat role block above for each role -->

<!-- Below-comp section (if applicable) -->
<div><b><span style="font-size: 15px">📋 Noted But Below Comp Target</span></b></div>
<div><b><span style="font-size: 11px">🏢 {Company}</span></b><span style="font-size: 11px"> — {Title}</span></div>
<div><span style="font-size: 11px">📍 {Location} | 🎯 {Mission} | 💰 ~{Comp}</span></div>
<div><span style="font-size: 11px">🔗 </span><a href="{DIRECT_URL}"><u><span style="font-size: 11px">View Posting</span></u></a></div>
<div><i><span style="font-size: 11px">Worth a look if the mission resonates enough to offset the comp gap.</span></i></div>
<div><span style="font-size: 11px"><br></span></div>

<!-- Monday-only: Manual check reminder -->
<div><b><span style="font-size: 15px">📌 Weekly Reminder — Check These Manually</span></b></div>
<div><span style="font-size: 11px">• LinkedIn Jobs — log in and search "VP Engineering" + "Senior Director Engineering" remote</span></div>
<div><span style="font-size: 11px">• ExecThread — peer-shared confidential roles</span></div>
<div><span style="font-size: 11px">• ExecuNet — members-only executive community</span></div>
<div><span style="font-size: 11px">• Ivy Exec — curated VP/Director postings</span></div>
<div><span style="font-size: 11px">• Korn Ferry — retained executive search</span></div>
<div><span style="font-size: 11px">• BlueSteps/AESC — global executive search network</span></div>
<div><span style="font-size: 11px"><br></span></div>
<div><i><span style="font-size: 11px">Automated by Claude Code | Adjust criteria anytime</span></i></div>
```

### HTML Rules (non-negotiable)

- **Wrap EVERY line in `<div>` tags** — without them, all text collapses into one block
- **Use `<div><span style="font-size: 11px"><br></span></div>`** for blank lines between role cards
- **NEVER put `<a href="">` inside `<table>` cells** — Apple Notes strips those links
- **Use `<a href="URL"><u><span>View Posting</span></u></a>`** for links
- **No `<h1>`/`<h2>`/`<h3>`** — use `<b><span style="font-size: Xpx">` instead
- **No CSS classes, `<style>` blocks, or external stylesheets**
- **Weekly reminder links** — render as plain text with `•` bullets (not `<ul>`/`<li>`)
```

- [ ] **Step 2: Write `source-strategy.md`**

Write `skills/daily-digest/source-strategy.md`, extracting TheirStack, niche board, and WebSearch fallback logic:

```markdown
# Daily Digest — Source Strategy

## Primary: TheirStack API (daily)

If `integrations/config/theirstack-config.md` exists and budget allows:

1. Read the config for `api_key`, `base_url`, and `daily_credit_budget`
2. Check budget: read the `### TheirStack Credits` section from preferences.
   Sum all `credits_used=N` for the current calendar month. If
   `month_total + daily_credit_budget >= 200`, set `use_theirstack = false`.
3. If budget allows, issue a single WebFetch to the TheirStack API.
   See `integrations/adapters/theirstack.md` for the full request format.

Build the request body from `config/search.md`:
- `job_title_or`: array from Target Role Titles
- `posted_at_gte`: `search_since` date (YYYY-MM-DD)
- `limit`: 10

Company size, location, and remote filtering are applied during Phase 3
compose (not supported as API query params).

After a successful call, append credit usage to preferences:
```
### TheirStack Credits
- {YYYY-MM-DD}: credits_used={N}, month_total={N}, month_limit=200
```

On any non-200 response, log to `output/error-{YYYY-MM-DD}.log`, set
`use_theirstack = false`, and proceed to WebSearch fallback.

If 200 but empty `data` array: log "TheirStack returned 0 results",
set `use_theirstack = false`, proceed to WebSearch fallback.

## Supplement: Niche Boards (Monday and Thursday only)

Check `date +%A`. If Monday or Thursday, issue these WebSearch queries
in parallel (single message):

```
[WebSearch: site:techjobsforgood.com "VP Engineering" OR "Senior Director Engineering" remote]
[WebSearch: site:purpose.jobs "VP Engineering" OR "Senior Director Engineering"]
[WebSearch: site:builtin.com/jobs Austin "VP Engineering" OR "Senior Director Engineering"]
```

Wait for all results before merging with TheirStack results.

## Fallback: WebSearch (when TheirStack unavailable)

If `use_theirstack = false` (config missing, budget exhausted, or API error),
issue ALL search queries simultaneously. When `search_since` is older than
yesterday, add `after:{search_since}` to reduce stale results:

```
[WebSearch: Ashby VP Engineering remote after:{search_since}]
[WebSearch: Greenhouse VP Engineering remote after:{search_since}]
[WebSearch: Lever healthcare VP Engineering after:{search_since}]
[WebSearch: EdTech VP Engineering remote after:{search_since}]
[WebSearch: Lever climate/sustainability VP Engineering after:{search_since}]
[WebSearch: Mission-driven VP Engineering remote after:{search_since}]
```

Vary queries each run — major boards, mission-driven boards, industry-specific,
Austin-area hybrid. Weight toward sources with historically high effectiveness
(check preferences for source data).

## search_since Computation

From preferences, parse the most recent `## YYYY-MM-DD` header as `last_run_date`.

- If `last_run_date` exists: `search_since = max(last_run_date, today - 7 days)`
  (7-day cap prevents excessive noise after long gaps)
- If no preferences file: `search_since = yesterday`

## LinkedIn Browser Automation (Optional)

Only when Claude in Chrome browser tools are available AND the user is logged
into LinkedIn AND explicitly enables it:

1. Navigate to LinkedIn Jobs search
2. Search with filters: Senior Director/VP Engineering, Remote, United States
3. Extract job titles, companies, and LinkedIn job URLs
4. For each result, find the direct careers URL
5. Add to digest using URL quality rules

Keep searches light and human-paced (LinkedIn ToS). Limit to 2-3 searches
per session.
```

- [ ] **Step 3: Commit**

```
git add skills/daily-digest/scoring-rules.md skills/daily-digest/source-strategy.md
git commit -m "feat: extract daily-digest local modules (scoring-rules, source-strategy)"
```

---

### Task 9: Rewrite `daily-digest/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace the entire contents of `skills/daily-digest/SKILL.md` with:

```markdown
---
name: daily-digest
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest. Trigger with "run my job
  digest", "check for new roles", "any new jobs today", or "job search
  update". State is persisted in output/ markdown files. When Apple Notes
  is configured, the digest is also written there for a native reading
  experience.
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch
---

# Daily Job Digest

Searches executive job boards, filters against the candidate's criteria,
deduplicates against previously seen postings, and writes the digest to
`output/` (plus Apple Notes when configured).

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Read `skills/_shared/batching.md` for reference — all phases in this skill
follow the batching protocol.

## Phase 0a — State & Optional Config

Read `skills/_shared/state-io.md` and execute the read pattern for:
- `seen-postings` — build dedup set of known URLs. Do NOT resurface any
  role already listed.
- `preferences` — extract interest signals and `last_run_date`.

Read `skills/daily-digest/source-strategy.md` for reference — it defines
how `search_since` is computed from `last_run_date`.

(Optional) If `integrations/config/notes-config.md` exists, read it to get
`plugin_root` and `default_folder` for Apple Notes writes.

(Optional) If `integrations/config/theirstack-config.md` exists, read it
for TheirStack config. Check budget per `source-strategy.md`.

## Filter Criteria

Read from `config/search.md`. Use the following fields to filter:

**Include:**
- Titles: values from "Target Role Titles" section
- Location: values from "Location Constraints" section
- Company type: "Company Types" field
- Comp: "Comp Floor" field — include roles likely to meet or exceed this

**Exclude:**
- Any company listed in "Companies to Skip" field
- Roles that violate location constraints
- IC/Staff Engineer roles
- Consulting or contract
- Postings verified as closed (see Phase 2)

## Phase 1 — Discovery

Read `skills/daily-digest/source-strategy.md` and execute.

This phase produces a raw candidate list from TheirStack, niche boards,
and/or WebSearch fallback. All searches batched per sub-phase.

Wait for all Phase 1 results before proceeding.

## Phase 2 — URL Verification

Read `skills/_shared/url-quality.md` and execute — filter out aggregator
URLs, find direct ATS/company links.

Read `skills/_shared/ats-verification.md` and execute — verify all
candidate URLs in a single parallel batch.

Wait for all verification results before composing the digest.

## Phase 3 — Compose and Write

Read `skills/daily-digest/scoring-rules.md` for star ratings, comp
evaluation, and the HTML template.

Score each verified role, compose the HTML digest, and write to
`output/digest-{date}.html`.

If `use_theirstack` was false due to API error or budget exhaustion (not
simply absent config), add a footer: "Note: TheirStack unavailable today
({reason}) — results sourced from web search only."

## Phase 4 — Apple Notes (optional)

Read `skills/_shared/apple-notes.md` and execute the create operation
for the digest note.

## Phase 5 — State Updates

Read `skills/_shared/state-io.md` and execute the append pattern for:
- `seen-postings` — add all roles from the digest (both included and
  excluded/closed) with posting dates
- `preferences` — append source effectiveness counts

If Apple Notes is configured, read `skills/_shared/apple-notes.md` and
execute the update operation for state notes (Seen Postings, Preferences).

## Error Handling — Apple Notes Write Failure

If the Apple Notes create script returns `error:`:
1. Log to `output/error-{date}.log`
2. The HTML file at `output/digest-{date}.html` is the fallback
3. Tell the user: "Apple Notes write failed — saved HTML fallback.
   Error: {exact message}"
4. Never silently fall back without surfacing the failure
```

- [ ] **Step 2: Verify the frontmatter (name, description, allowed-tools) is preserved**

The frontmatter block must match the original exactly — it controls skill
registration and tool permissions.

- [ ] **Step 3: Commit**

```
git add skills/daily-digest/SKILL.md
git commit -m "refactor: decompose daily-digest into orchestrator + shared modules"
```

---

### Task 10: Decompose `scan-email` — Extract Local Modules

**Files:**
- Create: `skills/scan-email/classification-rules.md`
- Create: `skills/scan-email/body-extraction.md`

- [ ] **Step 1: Write `classification-rules.md`**

Write `skills/scan-email/classification-rules.md`, extracting the classification logic from Phase 2 and Phase 2G:

```markdown
# Scan Email — Classification Rules

Rules for classifying email messages as job alerts vs non-job-related email.
Applied to both Apple Mail and Gmail messages.

## Classification Pipeline

For each message (using subject, sender email, date_received):

### Step 1: Sender Match

Check if the sender's email domain matches any job alert sender pattern
from `references/email-patterns.md` → Job Alert Senders table.

**Special case:** `@google.com` is a conditional match — only classify as
a job alert if the subject also contains "Google Alert" (otherwise it's a
regular Google notification).

If no sender match → skip this message.

### Step 2: Subject Pre-Filter

Check if the subject contains at least one title keyword from
`references/email-patterns.md` → Title Keywords section (cross-referenced
with `config/search.md` Target Role Titles).

Read `skills/_shared/url-quality.md` for title normalization rules.
Normalize abbreviations before matching (e.g., "Sr." → "Senior").

If no title keyword after normalization → skip this message.

### Step 3: Skip Rules

Apply each skip rule from `references/email-patterns.md`:
- Newsletter/digest summaries (subject contains "weekly digest", etc.)
- Marketing/promotional emails
- Emails older than 7 days (compare date_received to today)
- Company already in seen-postings dedup set (fuzzy match on company name
  extracted from subject)

### Step 4: Company Skip

If a company name can be extracted from the subject, check against
`config/search.md` Companies to Skip list.

## Candidate Tagging

Messages that pass all four steps become **candidates** for body fetch.
Tag each candidate with its source:
- Apple Mail candidates: `source: apple-mail`
- Gmail candidates: `source: gmail`

Store the `message_index` (Apple Mail) or `messageId` and `threadId` (Gmail)
for use in body fetch.

## Early Stop

If 20+ candidates have been identified across all batches, stop scanning
remaining batches. This prevents excessive processing when the inbox has
many matching emails.

## Gmail-Specific Notes

- Gmail `internalDate` is a Unix timestamp in milliseconds — convert to a
  date for the 7-day age comparison
- Gmail search queries are constructed from sender domains in
  `references/email-patterns.md`:
  ```
  from:(indeed.com OR indeedmail.com OR linkedin.com OR ...) newer_than:{lookback_days}d
  ```
- Google Alerts use a separate query:
  ```
  from:google.com subject:"Google Alert" newer_than:{lookback_days}d
  ```
```

- [ ] **Step 2: Write `body-extraction.md`**

Write `skills/scan-email/body-extraction.md`, extracting body fetch and URL parsing logic:

```markdown
# Scan Email — Body Extraction

Rules for fetching email bodies and extracting job posting URLs.
Applied to both Apple Mail and Gmail messages.

## Apple Mail Body Fetch

For each Apple Mail candidate, use the `message_index` stored during
classification. **Do NOT re-derive the index** — always use the stored
value. Indices can shift if new mail arrives between phases.

```bash
osascript {plugin_root}/scripts/apple_mail_read.applescript "{account_name}" "{inbox_name}" {message_index}
```

### Parsing Apple Mail Responses

| Response prefix | Action |
|----------------|--------|
| `HTML:` | Extract URLs from HTML `href="..."` attributes |
| `TEXT:` | Extract URLs matching `https?://[^\s<>"]+` |
| `BODY_UNAVAILABLE:` | Add to results: "body unavailable — classified on subject/sender only" |
| `ACCOUNT_NOT_FOUND` or `MAILBOX_NOT_FOUND` | Account lost mid-scan — stop remaining fetches, report error |
| `MESSAGE_NOT_FOUND` | Message moved/deleted since scan — skip, note in results |
| `error:` | Log error, skip message, continue |

## Gmail Body Fetch

For each Gmail candidate, use the stored `messageId`:

```
[gmail_read_message: messageId="{messageId}"]
```

### Parsing Gmail Responses

Gmail MCP returns a structured object with `body`, `headers`, `attachments`.

| Condition | Action |
|-----------|--------|
| `body` contains HTML tags | Extract URLs from `href="..."` attributes |
| `body` is plaintext | Extract URLs matching `https?://[^\s<>"]+` |
| `body` empty or missing | "body unavailable — classified on subject/sender only" |
| MCP call fails | Log error, skip message, continue |

## URL Extraction (Both Sources)

For each email body, extract:

1. **Job URL(s)** — filter for known ATS URL patterns from
   `references/email-patterns.md` → URL Extraction Patterns
2. **Company name** — from email subject, body content, or URL domain
3. **Role title** — from email subject or body content
4. **Location** — if mentioned in the body
5. **Comp range** — if mentioned in the body

### Tracking Redirects

If URLs are tracking redirects (Indeed `rc/clk/`, LinkedIn `/comm/`, etc.),
flag them for redirect resolution in Phase 4. Do not resolve during body
extraction — batch all resolutions together later.

### No URL Found

If no job URL is found in the body despite matching sender/subject patterns,
flag the role for **WebSearch fallback** in Phase 4:

```
[WebSearch: {company} {role_title} careers site:greenhouse.io OR site:lever.co OR site:ashbyhq.com]
```

## Batching

Read `skills/_shared/batching.md` for reference. Issue ALL body fetch calls
in a single message — never one at a time. If some calls fail while others
succeed, process successful results normally and handle failures per the
rules above.
```

- [ ] **Step 3: Commit**

```
git add skills/scan-email/classification-rules.md skills/scan-email/body-extraction.md
git commit -m "feat: extract scan-email local modules (classification-rules, body-extraction)"
```

---

### Task 11: Rewrite `scan-email/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/scan-email/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace the entire contents of `skills/scan-email/SKILL.md` with:

```markdown
---
name: scan-email
description: >
  Scan Apple Mail and/or Gmail for job alert emails from Indeed, LinkedIn,
  Glassdoor, and other sources. Extracts role URLs, deduplicates against
  seen-postings (and cross-deduplicates between sources), verifies via ATS
  APIs, and presents new roles for confirmation. Processed Apple Mail alerts
  are trashed; Gmail alerts are reported for manual cleanup (MCP limitation).
  Output appended to seen-postings and preferences.
  Triggers: "scan my email", "check mail for jobs", "any job emails", "scan inbox"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Scan Email

Scans Apple Mail and/or Gmail for job alert emails, extracts role URLs,
verifies them via ATS APIs, and presents new roles for the user to confirm
before adding to seen-postings. At least one source (Apple Mail or Gmail)
must be configured.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Read `skills/_shared/batching.md` for reference — all phases follow the
batching protocol.

Additionally:
- Read `references/email-patterns.md` — sender domains, title keywords,
  skip rules, URL extraction patterns

## Phase 0a — Source Configuration

Determine available sources:
- **Apple Mail**: Check if `integrations/config/mail-config.md` exists.
  If yes, read `account_name` and `inbox_name`. Set `apple_mail_enabled = true`.
- **Gmail**: Check if `integrations/config/gmail-config.md` exists and
  `enabled: true`. If yes, read `email`, `max_results`, `lookback_days`.
  Set `gmail_enabled = true`.
- If neither source is configured, stop:
  > "No email sources configured. Set up at least one:
  > - Apple Mail: copy `integrations/config/mail-config.md.example` to `mail-config.md`
  > - Gmail: copy `integrations/config/gmail-config.md.example` to `gmail-config.md`
  > See the setup skill for guidance."

Determine `plugin_root`: if `integrations/config/notes-config.md` exists,
read `plugin_root`. Otherwise use the current working directory.

## Phase 0b — State

Read `skills/_shared/state-io.md` and execute the read pattern for:
- `seen-postings` — build dedup set of all known URLs
- `preferences` — for source effectiveness context

Additionally, build dedup tuples of `(company_name_lowercase,
role_title_lowercase)` pairs from seen-postings for fuzzy matching.

Report which sources are active:
> "Scanning: {Apple Mail (account_name/inbox_name) | Gmail (email) | both}"

## Phase 1 — Verify Sources

### Phase 1A: Verify Apple Mail (skip if `apple_mail_enabled = false`)

**Step 1Aa**: Check if Apple Mail is running:
```bash
osascript -e 'tell application "System Events" to (name of processes) contains "Mail"'
```
If `false`, warn and ask to proceed (auto-launch) or skip to Gmail.

**Step 1Ab**: Verify account and mailbox — scan 1 message:
```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" 1 1
```
Handle: valid record (ready), `ACCOUNT_NOT_FOUND`, `MAILBOX_NOT_FOUND`, `error:`.

### Phase 1G: Verify Gmail (skip if `gmail_enabled = false`)

Test connection: `[gmail_get_profile]`. Handle: success (ready), MCP error (skip).

If both sources fail, stop.

## Phase 2 — Apple Mail Metadata Scan (skip if `apple_mail_enabled = false`)

Scan inbox in sequential batches of 10 messages (up to 5 batches = 50 messages):

```bash
osascript {plugin_root}/scripts/apple_mail_scan.applescript "{account_name}" "{inbox_name}" {start} {end}
```

If `NO_MESSAGES`, stop scanning.

Read `skills/scan-email/classification-rules.md` and execute for each record.

## Phase 2G — Gmail Metadata Scan (skip if `gmail_enabled = false`)

Build search queries from sender domains in `references/email-patterns.md`.
Execute via `[gmail_search_messages]`. Paginate if needed.

Read `skills/scan-email/classification-rules.md` and execute for each result.

## Phase 3 — Body Fetch (Apple Mail)

Skip if no Apple Mail candidates.

Read `skills/scan-email/body-extraction.md` and execute for Apple Mail candidates.

## Phase 3G — Body Fetch (Gmail)

Skip if no Gmail candidates.

Read `skills/scan-email/body-extraction.md` and execute for Gmail candidates.

## Phase 4 — Dedup, Filter, and Verify

### Step 4a: Cross-source dedup
Deduplicate across Apple Mail and Gmail. Same URL or same company+title → keep
the entry with more extracted data. Tag survivors with `source: both`.

### Step 4b: Resolve tracking redirects
Read `skills/_shared/url-quality.md` for tracking redirect guidance.
Issue all resolution calls in a single batched message.

### Step 4c: Dedup against seen-postings
Normalize URLs (strip query params, trailing slashes). Check against dedup set.

### Step 4d: Apply search filters
Read `skills/_shared/url-quality.md` and execute title normalization.
Apply filters from `config/search.md`: title exclusions, location constraints,
staffing/aggregator exclusions, company skip list.

### Step 4e: Verify URLs via ATS APIs
Read `skills/_shared/ats-verification.md` and execute.

### Step 4f: WebSearch fallback
For roles with no URL from body extraction:
```
[WebSearch: {company} {role_title} careers site:greenhouse.io OR site:lever.co OR site:ashbyhq.com]
```

## Phase 5 — Present Results

Show a confirmation table:

```
| # | Company | Role | Source | Location | Comp | Link | Status |
|---|---------|------|--------|----------|------|------|--------|
| 1 | TrueML | VP of Software Engineering | Indeed (Gmail) | Remote | $225K-$325K | [View](url) | Verified ✓ |
```

Source column: alert source with email channel in parentheses: `(Mail)`,
`(Gmail)`, or `(both)`.

Show: skipped counts, errors, sources scanned.

Ask for confirmation before writing state.

## Phase 6 — State Updates

After user confirmation:

Read `skills/_shared/state-io.md` and execute the append pattern for:
- `seen-postings` — confirmed roles with `source:email-{source_label}` tags
- `preferences` — per-source effectiveness counts

### Apple Notes sync (optional)
Read `skills/_shared/apple-notes.md` and execute the update operation for
the Seen Postings note.

### Trash Apple Mail alerts
Skip if `apple_mail_enabled = false` or no Apple Mail candidates body-fetched.

Trash in **descending index order** (highest first to prevent index shifting):
```bash
osascript {plugin_root}/scripts/apple_mail_trash.applescript "{account_name}" "{inbox_name}" {index}
```

Handle: `MESSAGE_NOT_FOUND` (skip), `TRASH_NOT_FOUND` (stop all trash calls).

### Gmail cleanup report
Skip if `gmail_enabled = false` or no Gmail candidates body-fetched.

Report processed messages for manual cleanup (Gmail MCP cannot trash).

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Neither source configured | Stop: show config guidance |
| Source config missing | Skip that source, continue with other |
| Apple Mail not running | Warn, ask to proceed or skip |
| Account/mailbox not found | Skip source, continue with other |
| Gmail MCP error | Skip Gmail, continue with Apple Mail |
| Body fetch fails | Classify on subject/sender only |
| Message moved/deleted | Skip, note in results |
| ATS verification fails | WebFetch fallback |
| Redirect resolution fails | Use original URL |
| osascript timeout | Reduce batch size, note slowdown |
| No job emails found | Report per source |

## Key Constraints

- At least one source required
- Apple Mail: read + trash; Gmail: read only
- Cross-source dedup — same role counted once
- 10-message batches (Apple Mail osascript limit)
- 50-message cap per source
- User confirmation required before state writes
- Never fabricate roles
- Graceful degradation between sources

## Future Enhancements

> Not implemented. Documented for when the need arises.

- Application status detection (Greenhouse/Lever/Ashby status change emails)
- Recruiter outreach surfacing
- Gmail trash support (when MCP adds message modification)
```

- [ ] **Step 2: Commit**

```
git add skills/scan-email/SKILL.md
git commit -m "refactor: decompose scan-email into orchestrator + shared modules"
```

---

### Task 12: Decompose `resume-tailor` — Extract Local Module and Rewrite

**Files:**
- Create: `skills/resume-tailor/tailoring-rules.md`
- Modify: `skills/resume-tailor/SKILL.md`

- [ ] **Step 1: Write `tailoring-rules.md`**

Write `skills/resume-tailor/tailoring-rules.md`, extracting Phases 1-3 content rules and the markdown structure spec:

```markdown
# Resume Tailor — Tailoring Rules

## Phase 1: Analyze the Posting

Extract from the job posting (or company-research brief if available):

1. **Top 3-5 requirements** — the capabilities the role most demands
   (e.g., "scaling engineering orgs internationally", "platform migration",
   "CI/CD maturity")
2. **Seniority signals** — scope indicators (budget, team size, org breadth)
3. **Domain context** — industry, tech stack, company stage

## Phase 2: Score and Map Accomplishments

Read the canonical resume (`references/resume.pdf`). For every bullet and
accomplishment:

- Score relevance against the extracted requirements
- **Keep all 6 accomplishment cards** — reorder rows so the most relevant
  cards appear in row 1. Individual card content can be swapped but total
  count stays at 6. Dropping cards makes the resume look thinner.
- Determine bullet reordering within each job entry — most relevant first.
  Do not remove any bullets.

## Phase 3: Rewrite Summary

Draft a 2-3 sentence summary that:

- Leads with the strongest signal for this specific role
- References specific numbers and outcomes from the canonical resume
- Uses the candidate's voice (from `references/voice-guide.md`):
  - Concrete before abstract — lead with the number, then the meaning
  - "We" for team work, "I" for personal decisions
  - No buzzwords, no performative language
  - Friendly pragmatist tone
- Positions at VP/Senior Director scope

**Anti-patterns:**
- "I'm passionate about driving organizational excellence"
- "I'm uniquely positioned to leverage my experience"
- "I've been fortunate enough to lead..."
- Anything that sounds like a LinkedIn influencer or career coach

## Markdown Structure (Critical)

The markdown MUST conform exactly to the structure that
`scripts/generate_resume_docx.js` expects. The parser is rigid.

```
# Candidate Name
**Tagline — e.g., Engineering Leader | Platform & Infrastructure | Scaling Teams**
contact@email.com | City, State | linkedin.com/in/handle

Summary paragraph — 2-3 sentences, rewritten for this role per Phase 3.

---

## Key Accomplishments

| **Label** — description | **Label** — description |
| **Label** — description | **Label** — description |

---

## Professional Experience

### Title | Company

*Location | Date range | Team size context*

**Challenge:** (verbatim from canonical resume — do NOT remove)

**Action:** (verbatim from canonical resume — do NOT remove)

**Results:**

- Bullet point (most relevant to this role first)
- Bullet point
- Bullet point

### Title | Company

*Location | Date range*

- Bullet point
- Bullet point

---

## Education

**Degree**              ← must come first (parser captures as degree)
University Name         ← must come second (parser captures as school)
**Core Expertise:** Comma-separated skills  ← must come last
```

**Order matters in Education.** The parser reads lines sequentially.
Reordering silently corrupts the .docx.

## Content Rules

- Accomplishments table: best-fit 4 items from scoring. `**Bold Label** — description with numbers` format.
- Experience bullets: reordered per scoring. Facts/numbers verbatim from canonical resume. Light phrasing edits allowed: reorder clauses, lead with relevant phrase, echo synonymous keywords. No new claims, no inflated scope.
- Summary: rewritten version from Phase 3
- Education: copied verbatim — ALL degrees, school, full Core Expertise list
- All other content (name, tagline, contact, titles, dates): verbatim

## Key Constraints

- **Never fabricate experience** — only reorder and re-emphasize
- **Never remove sections, bullets, or narrative blocks** — Challenge/Action/Results are core content
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim
- **Education and Core Expertise are verbatim** — no trimming
- **Flag gaps honestly** in the decisions summary
```

- [ ] **Step 2: Rewrite SKILL.md as orchestrator**

Replace `skills/resume-tailor/SKILL.md` with an orchestrator that preserves the frontmatter and uses shared module directives for preflight, company extraction, and state I/O. Keep the Company Research Reuse section, Required Inputs, Phase 4 (generate output including the docx command), the decisions summary, and error handling inline. Reference `skills/resume-tailor/tailoring-rules.md` for Phases 1-3 and the markdown structure.

The orchestrator structure:

```markdown
---
name: resume-tailor
description: >
  (preserve original frontmatter exactly)
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Resume Tailor

(preserve intro paragraph)

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Additionally:
- Read `references/resume.pdf` — canonical resume (source of truth)
- Read `references/voice-guide.md` if it exists — voice calibration
- Glob `references/writing-samples/*.md` — read for tone calibration

## Required Inputs

(preserve as-is)

## Company Research Reuse

(preserve as-is — check for existing company-research.md)

## Phase 1 — Company Extraction

Read `skills/_shared/company-extraction.md` and execute.

## Phase 2 — Analyze, Score, and Rewrite

Read `skills/resume-tailor/tailoring-rules.md` and execute Phases 1-3.

## Phase 3 — Generate Output

### Step 3a: Write the Tailored Markdown

(preserve file path conventions, naming rules)

Read `skills/resume-tailor/tailoring-rules.md` for the required markdown
structure — the parser is rigid.

### Step 3b: Generate the .docx

```fish
set NODE_PATH /opt/homebrew/lib/node_modules
node scripts/generate_resume_docx.js \
  output/{company-slug}/{Name}_Resume_{Company}.md \
  output/{company-slug}/{Name}_Resume_{Company}.docx
```

### Step 3c: Present Tailoring Decisions Summary

(preserve the 5-point summary: requirements, accomplishment changes, bullet
reordering, summary changes, requirement gaps)

## Phase 4 — State Update

Read `skills/_shared/state-io.md` and execute.

Find the seen-postings line matching the company/URL and append
`| RESUME TAILORED`. If not in seen-postings, add a new entry with the flag.

## Error Handling

(preserve error table as-is)
```

- [ ] **Step 3: Commit**

```
git add skills/resume-tailor/tailoring-rules.md skills/resume-tailor/SKILL.md
git commit -m "refactor: decompose resume-tailor into orchestrator + shared modules"
```

---

### Task 13: Decompose `application-tracker` — Extract Local Module and Rewrite

**Files:**
- Create: `skills/application-tracker/pipeline-schema.md`
- Modify: `skills/application-tracker/SKILL.md`

- [ ] **Step 1: Write `pipeline-schema.md`**

Extract the pipeline stages, stage definitions, close reasons, stage inference table, state file schema, and the view mode rendering template from the current SKILL.md into `skills/application-tracker/pipeline-schema.md`.

Include:
- The full stage progression diagram
- Stage definitions table
- Close reasons list
- Stage inference from activity table
- State file schema (full markdown template with Active and Closed sections)
- Privacy constraints for state files

- [ ] **Step 2: Rewrite SKILL.md as orchestrator**

Replace `skills/application-tracker/SKILL.md` preserving frontmatter. Structure:

- Phase 0: preflight + state-io read for `applications`
- Mode Detection (preserve inline — it's orchestration logic)
- Mode 1 (Add), Mode 2 (Update), Mode 3 (View): reference `pipeline-schema.md` for stage definitions and schema
- Apple Notes sync: reference `skills/_shared/apple-notes.md`
- Cross-Skill Integration section (preserve as-is)

- [ ] **Step 3: Commit**

```
git add skills/application-tracker/pipeline-schema.md skills/application-tracker/SKILL.md
git commit -m "refactor: decompose application-tracker into orchestrator + shared modules"
```

---

### Task 14: Rewrite `company-research/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/company-research/SKILL.md`

No local modules needed — remaining content is compact enough inline.

- [ ] **Step 1: Rewrite SKILL.md**

Replace `skills/company-research/SKILL.md` preserving frontmatter. Structure:

- Phase 0: `Read skills/_shared/preflight.md and execute.`
- Phase 0a: Accept the job posting URL from the user
- Phase 1 — Company Extraction: `Read skills/_shared/company-extraction.md and execute.`
- Phase 2 — Research Queries: `Read skills/_shared/batching.md for reference.` Keep the 6 WebSearch/WebFetch queries inline. Keep "No retry logic" rule.
- Phase 3 — Output Brief: Keep the brief structure template, positioning quality rules inline.
- Phase 4 — State Update: `Read skills/_shared/state-io.md and execute.` Keep the RESEARCHED flag logic inline.
- Error handling table (preserve inline)

- [ ] **Step 2: Commit**

```
git add skills/company-research/SKILL.md
git commit -m "refactor: decompose company-research to use shared modules"
```

---

### Task 15: Rewrite `cover-letter/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/cover-letter/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace `skills/cover-letter/SKILL.md` preserving frontmatter. Structure:

- Phase 0: `Read skills/_shared/preflight.md and execute.` Additionally read `references/resume.pdf`, glob writing samples, read voice-guide.
- Phase 0a: Check for existing `why-this-company` output for this company.
- Required Inputs (preserve)
- Phase 1 — Company Extraction: `Read skills/_shared/company-extraction.md and execute.` (for URL-provided cases)
- Phase 2 — Research: Keep research logic inline (it's compact and skill-specific).
- Phase 3 — Writing: Keep all writing rules, tone, structure, anti-patterns inline.
- Phase 4 — Output: Keep docx generation command inline.
- Phase 5 — Quality Checks (preserve)
- Phase 6 — State Update: `Read skills/_shared/state-io.md and execute.`

- [ ] **Step 2: Commit**

```
git add skills/cover-letter/SKILL.md
git commit -m "refactor: decompose cover-letter to use shared modules"
```

---

### Task 16: Rewrite `why-this-company/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/why-this-company/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace preserving frontmatter. Structure:

- Phase 0: `Read skills/_shared/preflight.md and execute.` Additionally read resume, glob writing samples.
- Phase 0a: `Read skills/_shared/state-io.md and execute` read pattern for `preferences`.
- Required Inputs (preserve)
- Phase 1 — Research: Keep research logic inline.
- Phase 2 — Writing: Keep all writing rules inline (hook, bridge, why now).
- Phase 3 — Output Format (preserve)
- Phase 4 — Quality Checks (preserve)
- Phase 5 — State Update: `Read skills/_shared/state-io.md and execute.`

- [ ] **Step 2: Commit**

```
git add skills/why-this-company/SKILL.md
git commit -m "refactor: decompose why-this-company to use shared modules"
```

---

### Task 17: Rewrite `linkedin-article/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/linkedin-article/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace preserving frontmatter. Structure:

- Phase 0 — Prerequisites: `Read skills/_shared/preflight.md and execute.` Additionally read `references/voice-guide.md`.
- Phases 1-7: Keep all workflow phases inline — they're skill-specific and not duplicated elsewhere.
- Additional Resources section (preserve)

The main change is replacing the 3-line prerequisite reads with a single preflight directive plus the voice-guide read.

- [ ] **Step 2: Commit**

```
git add skills/linkedin-article/SKILL.md
git commit -m "refactor: decompose linkedin-article to use shared preflight module"
```

---

### Task 18: Rewrite `setup/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/setup/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace preserving frontmatter. Structure:

- Phase 0: `Read skills/_shared/preflight.md and execute, but display validate-config output even on success — setup's purpose is to show config status.` Do NOT fail-fast on non-zero exit; instead display the output and continue to Phase 1.
- Phase 1 — Status Dashboard: Keep all check logic inline (this IS the skill's core logic).
- Phase 2 — Guided Fix: Keep all guided fix logic inline.
- Phase 3 — Verify: Keep inline.
- Re-run Behavior (preserve)

The main change is replacing the manual config reads with the preflight directive (with override).

- [ ] **Step 2: Commit**

```
git add skills/setup/SKILL.md
git commit -m "refactor: decompose setup to use shared preflight module"
```

---

### Task 19: Rewrite `interview-prep/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/interview-prep/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace preserving frontmatter. Structure:

- Phase 0: `Read skills/_shared/preflight.md and execute.` Additionally read `references/resume.pdf`.
- Status: Planned (preserve)
- Intended Behavior (preserve)
- Key Frameworks (preserve)

This is a stub skill — the change is minimal (replace 4 "Before You Start" lines with preflight directive + resume read).

- [ ] **Step 2: Commit**

```
git add skills/interview-prep/SKILL.md
git commit -m "refactor: decompose interview-prep to use shared preflight module"
```

---

### Task 20: Rewrite `networking-outreach/SKILL.md` as Orchestrator

**Files:**
- Modify: `skills/networking-outreach/SKILL.md`

- [ ] **Step 1: Rewrite SKILL.md**

Replace preserving frontmatter. Structure:

- Phase 0: `Read skills/_shared/preflight.md and execute.` Additionally glob `references/writing-samples/*.md`.
- Status: Planned (preserve)
- Intended Behavior (preserve)
- Message Types (preserve)

Another stub — replace 3 "Before You Start" lines with preflight directive + writing samples glob.

- [ ] **Step 2: Commit**

```
git add skills/networking-outreach/SKILL.md
git commit -m "refactor: decompose networking-outreach to use shared preflight module"
```

---

### Task 21: Final Review and Commit

**Files:**
- No new files

- [ ] **Step 1: Verify all shared modules exist**

```bash
ls -la skills/_shared/
```

Expected: 7 files (preflight.md, batching.md, state-io.md, url-quality.md, ats-verification.md, company-extraction.md, apple-notes.md)

- [ ] **Step 2: Verify all skills reference shared modules**

```bash
grep -r "skills/_shared/" skills/*/SKILL.md
```

Every SKILL.md should reference at least `preflight.md`.

- [ ] **Step 3: Verify no orphaned duplication**

Spot-check that the following patterns no longer appear inline in any SKILL.md:
- `node scripts/validate-config.js` (should only be in preflight.md)
- `Glob output/*-seen-postings.md, sort descending` (should only be in state-io.md)
- `boards-api.greenhouse.io` (should only be in ats-verification.md and ats-apis.md)

```bash
grep -l "validate-config.js" skills/*/SKILL.md
grep -l "Glob.*seen-postings.*sort descending" skills/*/SKILL.md
grep -l "boards-api.greenhouse.io" skills/*/SKILL.md
```

The first grep should return 1 result (setup, which has an override note). The others should return 0.

- [ ] **Step 4: Count lines before/after**

```bash
wc -l skills/*/SKILL.md | tail -1
wc -l skills/_shared/*.md | tail -1
wc -l skills/daily-digest/scoring-rules.md skills/daily-digest/source-strategy.md skills/scan-email/classification-rules.md skills/scan-email/body-extraction.md skills/resume-tailor/tailoring-rules.md skills/application-tracker/pipeline-schema.md 2>/dev/null | tail -1
```

Verify total orchestrator lines are significantly lower than the original 2,467.
