---
name: daily-digest
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest via Apple Notes. Runs
  interactively when Chris opens Cowork — trigger with "run my job
  digest", "check for new roles", "any new jobs today", or "job search
  update". Uses persistent state in Apple Notes to avoid showing
  duplicate postings and to learn from Chris's interest signals over
  time. NOTE: This skill requires an interactive Cowork session (not a
  scheduled task) because it uses osascript to write to Apple Notes,
  which is only available in the macOS interactive context.
---

# Daily Job Digest

Searches executive job boards, filters against Chris's criteria, deduplicates
against previously seen postings, and writes a formatted Apple Note.

**Important:** This skill must run in an interactive Cowork session (not a
scheduled task). Scheduled tasks execute in a Linux VM without access to
macOS-native tools like osascript or Apple Notes. The interactive session
runs on Chris's Mac, where osascript and Apple Notes work as expected.

## Before You Start

1. Read `CLAUDE.md` for candidate profile and filter criteria
2. Read the `Job Search - Seen Postings` Apple Note — do NOT resurface any role already listed
3. Read the `Job Search - Preferences` Apple Note — use interest signals to weight searches

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

## Search Strategy

Vary queries each run. Mix approaches — don't repeat the same searches daily:
- Major boards (Indeed, LinkedIn, Glassdoor, Built In)
- Mission-driven boards (Tech Jobs for Good, Purpose Jobs, Wellfound)
- Industry-specific (healthcare tech, EdTech, construction tech, PropTech)
- Austin-area hybrid roles specifically

Weight effort toward sources that have historically produced relevant results
(check `Preferences` note for source effectiveness data).

## URL Quality Rules — DIRECT LINKS ONLY

Aggregator sites (EchoJobs, Jobera, SimplyHired, RemoteRocketship) are
**discovery tools only**. Never use their URLs in the digest.

**For every role, you MUST:**
1. Find the company's actual careers/application page (Greenhouse, Lever,
   Workday, Ashby, SmartRecruiters, iCIMS, or the company's own careers site)
2. Use that direct URL as the "View Posting" link
3. If you cannot find a direct company link, **do NOT include the role** —
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

## Output — Apple Notes

Write an Apple Note titled `Executive Job Digest — {Month Day, Year}`.

### CRITICAL: Apple Notes HTML Rules

Apple Notes has limited HTML support. These rules are non-negotiable and
based on tested, working output:

1. **Wrap EVERY line in `<div>` tags** — this is how Apple Notes preserves
   line breaks. Without `<div>` wrappers, all text collapses into one block.
2. **Use `<div><span style="font-size: 11px"><br></span></div>` for blank
   lines** between role cards — this creates visual spacing.
3. **NEVER put `<a href="">` links inside `<table>` cells** — Apple Notes
   strips hyperlinks from table cells.
4. **Use `<a href="URL"><u><span style="font-size: 11px">View Posting</span></u></a>`
   for links** — the `<u>` tag ensures the link looks clickable.
5. **Use `<span style="font-size: Xpx">` for all text sizing** — Apple Notes
   respects inline font-size on spans.
6. **Use `<b>` for bold, `<i>` for italic, `<u>` for underline**.
7. **Emoji markers** — 🏢 company, 📍 location, 💰 comp, 🎯 mission,
   🔗 link, ⭐ fit rating, 📋 notes, 📌 reminders.
8. **Only ONE note per digest run** — never create multiple notes.

### Apple Notes Template

Follow this structure EXACTLY. Every line wrapped in `<div>`. This pattern
is tested and renders correctly with clickable links and proper line breaks:

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
<ul>
<li><a href="https://www.linkedin.com/jobs/">LinkedIn Jobs</a> — log in and search "VP Engineering" + "Senior Director Engineering" remote</li>
<li><a href="https://www.execthread.com">ExecThread</a> — peer-shared confidential roles</li>
<li><a href="https://www.execunet.com">ExecuNet</a> — members-only executive community</li>
<li><a href="https://www.ivyexec.com">Ivy Exec</a> — curated VP/Director postings</li>
<li><a href="https://www.kornferry.com">Korn Ferry</a> — retained executive search</li>
<li><a href="https://www.bluesteps.com">BlueSteps/AESC</a> — global executive search network</li>
</ul>
<div><span style="font-size: 11px"><br></span></div>
<div><i><span style="font-size: 11px">Automated by Claude Cowork | Adjust criteria anytime</span></i></div>
```

### Star ratings
- ⭐⭐⭐⭐⭐ = Perfect match (title, comp, mission, remote all align)
- ⭐⭐⭐⭐ = Strong match (one dimension is a stretch but worth pursuing)
- ⭐⭐⭐ = Worth considering (interesting company but notable gaps)

### What NOT to do
- Do NOT omit `<div>` wrappers — every line needs one or text collapses
- Do NOT use `<table>` for role listings
- Do NOT put `<a href>` links inside table cells — they will break
- Do NOT create multiple notes per run — one note only
- Do NOT use `<h1>`, `<h2>`, `<h3>` — use `<b><span style="font-size: Xpx">` instead
- Do NOT use CSS classes, `<style>` blocks, or external stylesheets
- Do NOT link to aggregator sites — direct company URLs only

## State Updates

After writing the digest:
1. Update `Job Search - Seen Postings` — add all new roles with direct URLs
2. Update `Job Search - Preferences` — update source effectiveness counts
