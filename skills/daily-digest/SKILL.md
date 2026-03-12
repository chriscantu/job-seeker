---
name: daily-digest
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest via Apple Notes. Runs
  interactively when Chris opens Cowork — trigger with "run my job
  digest", "check for new roles", "any new jobs today", or "job search
  update". Uses direct AppleScript calls (osascript) to read and write
  Apple Notes natively. State is persisted in Apple Notes.
---

# Daily Job Digest

Searches executive job boards, filters against Chris's criteria, deduplicates
against previously seen postings, and writes a formatted Apple Note.

## How Apple Notes Access Works

This skill uses **direct AppleScript scripts** called via `osascript` from the
Mac host. No MCP server, no background daemon — just four standalone scripts
in `scripts/` that Claude invokes as shell commands from its skill instructions.

The config file `integrations/config/notes-config.md` must exist (copy
`notes-config.md.example` and fill in `plugin_root`). Read it before running
any script to get the correct `plugin_root` path.

### Script Invocation Pattern

Replace `{plugin_root}` with the value from `notes-config.md`.

**Read a note:**
```
do shell script "osascript {plugin_root}/scripts/apple_notes_read.applescript " & quoted form of noteTitle & " " & quoted form of folderName
```

**Create the digest note (replaces if exists):**
```
do shell script "osascript {plugin_root}/scripts/apple_notes_create.applescript " & quoted form of noteTitle & " " & quoted form of htmlBody & " " & quoted form of folderName
```

**Update a state note (upsert — preserves note identity):**
```
do shell script "osascript {plugin_root}/scripts/apple_notes_update.applescript " & quoted form of noteTitle & " " & quoted form of htmlBody & " " & quoted form of folderName
```

**List notes in a folder:**
```
do shell script "osascript {plugin_root}/scripts/apple_notes_list.applescript " & quoted form of folderName
```

See `integrations/adapters/apple-notes.md` for full field mapping, return
values, and error handling reference.

---

## Before You Start

1. Read `CLAUDE.md` for candidate profile and filter criteria
2. Read `integrations/config/notes-config.md` — extract `plugin_root` and `default_folder`
3. Run `apple_notes_read.applescript "Job Search - Seen Postings" "{default_folder}"` —
   do NOT resurface any role already listed. If output is `NOTE_NOT_FOUND` or
   `FOLDER_NOT_FOUND`, treat as empty (no previously seen postings).
4. Run `apple_notes_read.applescript "Job Search - Preferences" "{default_folder}"` —
   use interest signals to weight searches. Treat `NOTE_NOT_FOUND` as no preferences.

---

## Filter Criteria

**Include:**
- Titles: Senior Director of Engineering, VP of Engineering, Head of Engineering,
  SVP Engineering, VP Platform Engineering, VP Developer Experience
- Location: Remote, Hybrid (Austin TX area OK)
- Company type: Mission-driven, growth-stage, midsize
- Comp: $250K+ total likely

**Exclude:**
- Relocation required outside Austin
- 100% in-office downtown Austin
- IC/Staff Engineer roles
- Junior Director at very large companies
- Consulting or contract
- Postings that return 404, redirect to a general careers page, or indicate
  the role is filled / no longer accepting applications — verify before including

---

## Batching Protocol — CRITICAL

**Every tool call in this skill MUST be batched. Never issue searches or
verifications one at a time — this forces the user to approve each call
individually and creates a terrible experience.**

### Phase 1 — Parallel Searches (single message, all calls at once)

Issue ALL search queries simultaneously in one message as parallel tool calls:
```
[WebSearch: Ashby VP Engineering] [WebSearch: Greenhouse VP Engineering]
[WebSearch: Lever healthcare VP Engineering] [WebSearch: EdTech VP Engineering]
[WebSearch: Lever climate/sustainability VP Engineering] [WebSearch: Mission-driven VP Engineering]
```
Wait for all results before proceeding. Do NOT issue searches one at a time.

### Phase 2 — Parallel URL Verification (single message, all calls at once)

After collecting candidates from Phase 1, issue ALL WebFetch verifications
simultaneously in one message:
```
[WebFetch: url1] [WebFetch: url2] [WebFetch: url3] ... [WebFetch: urlN]
```
Wait for all results before composing the digest. Do NOT verify URLs one at a time.

### Phase 3 — Compose and Write

Use all verified results to write the digest in a single pass.

---

## Search Strategy

Vary queries each run. Mix approaches — don't repeat the same searches daily:
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
- Ashby: `jobs.ashbyhq.com/{company}/{id}`
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

```html
<div><b><span style="font-size: 21px">Executive Job Digest — {Month Day, Year}</span></b></div>
<div><span style="font-size: 11px">Good morning Chris — here are today's executive engineering leadership opportunities:</span></div>
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
<div><i><span style="font-size: 11px">Automated by Claude Cowork | Adjust criteria anytime</span></i></div>
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

1. Log the exact error message
2. Save the digest as `output/digest-{date}.html`
3. Tell Chris:
   > "Apple Notes write failed — saved HTML fallback at `output/digest-{date}.html`. Error: {exact error message}"
4. **Never silently fall back to HTML without surfacing the failure**

The HTML fallback exists so Chris can review results in a browser. Apple Notes
is the intended delivery channel — everything else is a workaround.

---

## State Updates

After the digest note is written:

1. Build the updated Seen Postings content (append all new role titles + URLs + date)
2. Run `apple_notes_update.applescript "Job Search - Seen Postings" "{html_body}" "{default_folder}"`
   — this is an upsert: updates the note body if found, creates it if not.
3. Build updated Preferences content (update source effectiveness counts)
4. Run `apple_notes_update.applescript "Job Search - Preferences" "{html_body}" "{default_folder}"`

These state notes are the source of truth across all sessions. No local files
required — the notes persist in iCloud.
