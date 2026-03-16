---
name: daily-digest
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest via Apple Notes. Trigger with
  "run my job digest", "check for new roles", "any new jobs today", or
  "job search update". Runs in Claude Code on macOS — osascript is called
  directly via Bash to read and write Apple Notes natively.
  State is persisted in Apple Notes.
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch
---

# Daily Job Digest

Searches executive job boards, filters against Chris's criteria, deduplicates
against previously seen postings, and writes a formatted Apple Note.

## How Apple Notes Access Works

This skill runs in **Claude Code on macOS**. AppleScript files in `scripts/`
are called directly via the Bash tool using `osascript`. No MCP server, no
background daemon.

Read `integrations/config/notes-config.md` to get `plugin_root` before any call.

### Invocation Pattern

Replace `{plugin_root}` with the value from `notes-config.md`.

**Read a note:**
```bash
osascript {plugin_root}/scripts/apple_notes_read.applescript "noteTitle" "folderName"
```

**Create the digest note** (replaces if exists):
```bash
osascript {plugin_root}/scripts/apple_notes_create.applescript "noteTitle" "htmlBody" "folderName"
```

**Update a state note** (upsert — preserves note identity):
```bash
osascript {plugin_root}/scripts/apple_notes_update.applescript "noteTitle" "htmlBody" "folderName"
```

**List notes in a folder:**
```bash
osascript {plugin_root}/scripts/apple_notes_list.applescript "folderName"
```

See `integrations/adapters/apple-notes.md` for full field mapping, return
values, and error handling reference.

---

## Before You Start

1. Read `config/candidate.md` — candidate name and profile
2. Read `config/search.md` — target role titles, comp floor, location constraints, sources
3. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error to the user
4. Glob `output/*-seen-postings.md`, sort descending, read the most recent file.
   Do NOT resurface any role already listed. If no file exists, treat as empty
   (no previously seen postings).
5. Glob `output/*-preferences.md`, sort descending, read the most recent file.
   Use interest signals to weight searches. If no file exists, treat as no preferences.
6. (Optional — Apple Notes only) If `integrations/config/notes-config.md` exists,
   read it to get `plugin_root` and `default_folder` for Apple Notes writes.
   Skip this step if the file does not exist.
7. (Optional — TheirStack only) If `integrations/config/theirstack-config.md`
   exists, read it to get `api_key`, `base_url`, and `daily_credit_budget`.
   Then check budget: using the preferences file already read in step 5, find
   the `### TheirStack Credits` section and sum all `credits_used=N` values for
   entries dated in the current calendar month to get `month_total`. If the
   section does not exist or has no entries for the current month, treat
   `month_total` as 0. If `month_total + daily_credit_budget >= 200`, set
   `use_theirstack = false` (budget exhausted, fall back to WebSearch).
   Otherwise set `use_theirstack = true`. If the config file does not exist,
   set `use_theirstack = false` and proceed.

---

## Filter Criteria

Read from `config/search.md`. Use the following fields to filter:

**Include:**
- Titles: values from "Target Role Titles" section of `config/search.md`
- Location: values from "Location Constraints" section
- Company type: "Company Types" field
- Comp: "Comp Floor" field — include roles likely to meet or exceed this

**Exclude:**
- Any company listed in "Companies to Skip" field
- Roles that violate location constraints
- IC/Staff Engineer roles
- Consulting or contract
- Postings that return 404, redirect to a general careers page, or indicate
  the role is filled / no longer accepting applications — verify before including

---

## Batching Protocol — CRITICAL

**Every tool call in this skill MUST be batched. Never issue searches or
verifications one at a time — this forces the user to approve each call
individually and creates a terrible experience.**

### Phase 1 — Discovery (single message per sub-phase, all calls at once)

#### Phase 1a — TheirStack API (if `use_theirstack` is true)

Issue a single WebFetch call to the TheirStack API with criteria from
`config/search.md`. See `integrations/adapters/theirstack.md` for the full
request format, field mapping, and error handling.

Build the request body at runtime from search.md:
- `job_title_or`: array of titles from Target Role Titles (e.g. `["VP of Engineering", "Senior Director of Engineering", "Head of Engineering"]`)
- `posted_at_gte`: yesterday's date in `YYYY-MM-DD` format
- `limit`: `10`

Note: company size, location, and remote filtering are not supported as API
query params — apply these filters during Phase 3 compose using
`company_object.employee_count_range` and the `location` field in each result.

On any non-200 response, append the error to `output/error-{YYYY-MM-DD}.log`
so it persists after the session ends, set `use_theirstack = false`, and
proceed to Phase 1c.

After a successful call, append credit usage to `output/*-preferences.md`:
```
### TheirStack Credits
- {YYYY-MM-DD}: credits_used={N}, month_total={N}, month_limit=200
```

Wait for the TheirStack response before proceeding to Phase 1b or 1c.

If the response is 200 but the `data` array is empty, log:
"TheirStack returned 0 results for today's query — running Phase 1c WebSearch fallback."
Set `use_theirstack = false` and proceed to Phase 1c.

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

If `use_theirstack` is false (config missing, budget exhausted, or API error), issue ALL search queries
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

### Phase 2 — Parallel URL Verification (single message, all calls at once)

After collecting candidates from Phase 1, group URLs by domain and issue ALL
verifications simultaneously in one message. See
`integrations/adapters/ats-apis.md` for full endpoint details and response
interpretation.

**For each URL, determine the verification method:**

| URL matches pattern | Method |
|--------------------|--------|
| `boards.greenhouse.io/{company}/jobs/{id}` or `job-boards.greenhouse.io/{company}/jobs/{id}` | `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}` |
| `jobs.lever.co/{company}/{id}` | `GET https://api.lever.co/v0/postings/{company}/{id}` |
| `jobs.ashbyhq.com/{company}` | `GET https://api.ashbyhq.com/posting-api/job-board/{company}` (match by title in response `jobs[]` array) |
| Anything else | WebFetch (existing behavior) |

Issue all verification calls as a single parallel batch:
```
[WebFetch: greenhouse API for url1] [WebFetch: lever API for url2] [WebFetch: url3] ...
```

**Interpreting results:**
- 200 + job data → posting is open, include in digest
- 404 → posting is closed — mark as `CLOSED` in Seen Postings note, exclude
- API error (5xx, timeout, parse failure) → fall back to WebFetch for that URL only
- WebFetch returns 404 or "no longer accepting" text → mark CLOSED, exclude
- WebFetch fallback also fails (error or uninterpretable content) → exclude role, add URL to digest footer: "Could not verify: {URL} — check manually"

Wait for all results before composing the digest.

### Phase 3 — Compose and Write

Use all verified results to write the digest in a single pass.

If `use_theirstack` is false because of an API error or budget exhaustion
(not simply because the config file is absent), add a footer line to the digest:
"Note: TheirStack unavailable today ({reason}) — results sourced from web search only."

---

## Search Strategy

**Primary (daily):** TheirStack API — see Phase 1a above. Covers 321K+ job
sites with structured title and recency filters. Company size and location are
applied as post-retrieval filters during Phase 3 compose.

**Supplement (Mon + Thu):** WebSearch against niche mission-driven boards
(Tech Jobs for Good, Purpose Jobs, Built In Austin) — see Phase 1b above.

**Fallback (when TheirStack config missing, credits exhausted, or API error):** Full WebSearch
across all sources — see Phase 1c above. Vary queries each run:
- Major boards (Indeed, LinkedIn, Glassdoor, Built In)
- Mission-driven boards (Tech Jobs for Good, Purpose Jobs, Wellfound)
- Industry-specific (healthcare tech, EdTech, construction tech, PropTech)
- Austin-area hybrid roles specifically

Weight effort toward sources that have historically produced relevant results
(check Preferences note for source effectiveness data).

---

## URL Quality Rules — DIRECT LINKS ONLY

Aggregator sites (EchoJobs, Jobera, SimplyHired, RemoteRocketship) are
**discovery tools only**. Never use their URLs in the digest.

**For every role, you MUST:**
1. Find the company's actual careers/application page (Greenhouse, Lever,
   Workday, Ashby, SmartRecruiters, iCIMS, or the company's own careers site)
2. **Verify the URL is live and the posting is still open** — use WebFetch on
   the direct link before including the role. If WebFetch returns a 404, a
   redirect to a general careers page, or content indicating the role is filled
   or no longer available, **do NOT include the role**. Mark it as `CLOSED` in
   the Seen Postings note so it is never re-surfaced.
3. Use that direct URL as the "View Posting" link
4. If you cannot find a direct company link, **do NOT include the role** —
   skip it and note in the footer that N roles were found but excluded
   due to no verifiable direct link

**URL priority order:**
1. Company careers page (e.g., `boards.greenhouse.io/company/jobs/123`)
2. Company website jobs section (e.g., `company.com/careers/job-id`)
3. Workday/iCIMS/Lever direct link
4. LinkedIn job posting (e.g., `linkedin.com/jobs/view/123456`)
5. **NEVER** use: EchoJobs, Jobera, SimplyHired, RemoteRocketship,
   generic Glassdoor search pages, or any aggregator listing page

**Common ATS URL patterns to look for:**
- Greenhouse: `boards.greenhouse.io/{company}/jobs/{id}` or `job-boards.greenhouse.io/{company}/jobs/{id}`
- Lever: `jobs.lever.co/{company}/{id}`
- Ashby: `jobs.ashbyhq.com/{company}` (no job ID in path — Ashby returns all open postings for the company)
- Workday: `{company}.wd5.myworkdayjobs.com/.../job/{title}_{id}`
- SmartRecruiters: `jobs.smartrecruiters.com/{company}/{id}`

---

## LinkedIn Browser Automation (Optional)

When Claude in Chrome browser tools are available and the user is logged into
LinkedIn in Chrome, use browser automation to:
1. Navigate to LinkedIn Jobs search
2. Search with filters: Senior Director/VP Engineering, Remote, United States
3. Extract job titles, companies, and LinkedIn job URLs
4. For each LinkedIn result, attempt to find the company's direct careers URL
5. Add results to the digest using the URL quality rules above

**Important:** Only use LinkedIn automation when explicitly enabled by the user.
LinkedIn ToS restricts automated access — keep searches light and human-paced
(wait between actions, limit to 2-3 searches per session).

---

## Output — Write to Apple Notes

Construct the HTML body using the template below, then run:

```
osascript {plugin_root}/scripts/apple_notes_create.applescript \
  "Executive Job Digest — {Month Day, Year}" \
  "{html_body}" \
  "{default_folder}"
```

Verify the return value starts with `success:`. If it starts with `error:`,
follow the fallback procedure below.

### HTML Template

The `html_body` passed to the create script must follow Apple Notes' HTML
rules exactly — every line wrapped in `<div>` tags or the note will collapse.

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
<div><b><span style="font-size: 11px">🔗 Link:</span></b><span style="font-size: 11px"> </span><a href="{DIRECT_COMPANY_URL}"><u><span style="font-size: 11px">View Posting</span></u></a></div>
<div><b><span style="font-size: 11px">Why this fits:</span></b><span style="font-size: 11px"> {1-2 sentences tied to Chris's specific background}</span></div>
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
  because `<a href>` inside list items is unreliable in Apple Notes

### Star ratings
- ⭐⭐⭐⭐⭐ = Perfect match (title, comp, mission, remote all align)
- ⭐⭐⭐⭐ = Strong match (one dimension is a stretch but worth pursuing)
- ⭐⭐⭐ = Worth considering (interesting company but notable gaps)

---

## Fallback — If Apple Notes Write Fails

If `apple_notes_create.applescript` returns a value starting with `error:`:

1. Write the exact error message to `output/error-{date}.log` so it persists after the session ends
2. Save the digest as `output/digest-{date}.html`
3. Tell Chris:
   > "Apple Notes write failed — saved HTML fallback at `output/digest-{date}.html`. Error: {exact error message}"
4. **Never silently fall back to HTML without surfacing the failure**

The HTML fallback exists so Chris can review results in a browser. Apple Notes
is the intended delivery channel — everything else is a workaround.

---

## State Updates

After the digest note is written:

### Primary state — output/ files

1. Glob `output/*-seen-postings.md`, sort descending. If a file exists, append
   new role entries to it. If no file exists, create `output/YYYY-MM-DD-seen-postings.md`
   (use today's date).

   Entry format:
   ```
   ## YYYY-MM-DD
   - {Company} | {Title} | {URL}
   ```

2. Glob `output/*-preferences.md`, sort descending. If a file exists, append
   updated source effectiveness counts. If no file exists, create
   `output/YYYY-MM-DD-preferences.md`.

   Entry format:
   ```
   ## YYYY-MM-DD
   ### Source Effectiveness
   - {Source}: {N} relevant roles found
   ```

### Secondary state — Apple Notes (optional, Chris's personal integration)

If `integrations/config/notes-config.md` exists, also run the Apple Notes
state updates below. Skip this block entirely if the file does not exist.

Read `integrations/config/notes-config.md` to get `plugin_root`, `default_folder`,
and `Apple Notes Prefix` (from `config/search.md`, default: `Job Search`).

Construct note names using the prefix:
- `{prefix} - Seen Postings`
- `{prefix} - Preferences`

Run `apple_notes_update.applescript` for each note as before. Check return values;
if either starts with `error:`, log to `output/error-{date}.log` and warn the user
but do NOT fail the digest — primary state already succeeded.
