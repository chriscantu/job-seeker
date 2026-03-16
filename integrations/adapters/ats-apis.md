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
  "hostedUrl": "https://jobs.lever.co/acme/abc-123",
  "applyUrl": "https://jobs.lever.co/acme/abc-123/apply"
}
```

**Interpretation**:
- 200 with posting object → posting is open ✅
- 404 → posting is closed ❌ — mark as CLOSED in seen-postings
- Any other error → fall back to WebFetch for this URL

**No auth required.**

---

## Ashby

**Endpoint**: `GET https://api.ashbyhq.com/posting-api/job-board/{company}`

**Extract from URL**: Parse `{company}` from `jobs.ashbyhq.com/{company}`.
Note: Ashby URLs do not include a job ID in the path — the endpoint returns
ALL open postings for the company, and the skill must match by title.

**Response**:
```json
{
  "jobs": [
    {
      "id": "abc-123",
      "title": "VP of Engineering",
      "location": "Remote",
      "team": "Engineering",
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

