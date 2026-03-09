# Daily Digest Improvements — March 7, 2026

## Summary

Today we iterated on the `daily-digest` skill through several rounds of testing
and feedback, fixing three major quality issues: Apple Notes formatting, URL
reliability, and LinkedIn as a source for executive-level roles.

---

## Problems Identified & Fixed

### 1. Apple Notes Formatting Collapsed Into One Block
**Root cause:** The SKILL.md template was missing `<div>` wrappers on every line.
Apple Notes requires `<div>` tags to preserve line breaks — without them, all
text collapses into a single paragraph.

**Fix:** Rewrote the Apple Notes HTML template so every line is wrapped in
`<div>` tags, with `<div><span style="font-size: 11px"><br></span></div>` for
blank lines between role cards. Also replaced `<h1>`/`<h2>` tags (which render
inconsistently) with `<b><span style="font-size: Xpx">` for headings.

### 2. Links Were Dead, Closed, or Generic Listing Pages
**Root cause:** The digest was linking to aggregator sites (EchoJobs, Jobera,
SimplyHired, Glassdoor search pages) instead of actual company career pages.
These links frequently go stale, point to closed postings, or land on generic
search results rather than the specific job.

**Fix:** Implemented a "direct links only" strategy in SKILL.md:
- Aggregator sites are now **discovery tools only** — never used as destination URLs
- Every role must have a direct company career page link (Greenhouse, Lever,
  Workday, Ashby, SmartRecruiters, or company website)
- If no direct URL can be found, the role is excluded from the digest
- Added ATS URL pattern reference (e.g., `boards.greenhouse.io/{company}/jobs/{id}`)
- LinkedIn job URLs are an acceptable fallback (priority #4)

### 3. Missing Executive-Level Sources (Walled Gardens)
**Root cause:** Many executive roles are only posted on LinkedIn, ExecThread,
and similar platforms that require login. The automated web search couldn't
access these.

**Fix:** Added a LinkedIn Browser Automation section to SKILL.md that uses
Claude in Chrome to search LinkedIn Jobs when the extension is connected.
Also added a Monday-only manual check reminder section for walled-garden
sources (ExecThread, ExecuNet, Ivy Exec, Korn Ferry, BlueSteps).

---

## Files Modified

| File | Changes |
|------|---------|
| `skills/daily-digest/SKILL.md` | Rewrote with div-wrapping rules, direct-link URL strategy, LinkedIn automation, ATS URL patterns, and "What NOT to do" section |
| Scheduled task `executive-job-digest` | Updated prompt with formatting and URL quality rules *(task later disabled 2026-03-09 — see scheduled-task-migration-2026-03-09.md)* |

## Apple Notes Created Today

| Note | Status |
|------|--------|
| `Executive Job Digest — March 7, 2026` | ✅ Keep — morning gold standard |
| `Executive Job Digest — March 7, 2026 (Evening v2)` | ✅ Keep — fixed formatting test |
| `Executive Job Digest — March 7, 2026 (LinkedIn Test)` | ✅ Keep — LinkedIn automation validation |
| `Executive Job Digest — March 7, 2026 (Evening)` | ❌ Delete — text collapsed, no divs |
| `Job Digest — 2026-03-07 (Evening)` | ❌ Delete — links inside tables, broken |
| `Search Preferences and Signals` | ❌ Delete — duplicate of Job Search - Preferences |

## Gmail Drafts to Delete

Three test email drafts were created during the email delivery experiment
and should be cleaned up manually.

---

## LinkedIn Automation Test Results

Successfully validated the Chrome browser automation workflow:
1. Navigated to LinkedIn Jobs search
2. Applied filters: Executive level, Remote, United States
3. Extracted 8 roles from search results
4. Investigated 4 in detail, finding direct URLs for 3 of 4
5. Created a properly formatted Apple Note with clickable links

### Roles Found via LinkedIn

| Company | Title | Fit | Direct URL Found? |
|---------|-------|-----|-------------------|
| GitLab | VP of Engineering, Architecture and Transformation | ⭐⭐⭐⭐⭐ | ✅ Greenhouse |
| NEOGOV | VP of Engineering, Platform | ⭐⭐⭐⭐⭐ | ⚠️ LinkedIn only |
| Headspace | VP, Product Engineering | ⭐⭐⭐⭐ | ✅ Greenhouse |
| Circle | VP, Engineering | ⭐⭐⭐⭐ | ✅ Company careers |

---

## What's Next

- Clean up duplicate Apple Notes and Gmail drafts (manual)
- ~~Monitor the 7am scheduled task to confirm formatting holds in automated runs~~ *(scheduled task disabled 2026-03-09 — digest now runs interactively)*
- Consider adding a second LinkedIn search variation (e.g., "Head of Engineering")
- Track which sources produce the best leads in the Preferences note
