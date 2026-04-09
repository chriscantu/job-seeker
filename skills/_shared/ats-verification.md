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
