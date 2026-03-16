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

---

## Known Issues

Validated live against all three APIs on 2026-03-15. Two discrepancies found
between the documented response schemas and actual API behavior:

### Lever: `urls` object does not exist — use top-level `hostedUrl` / `applyUrl`

The documented response shows:
```json
{ "urls": { "apply": "https://jobs.lever.co/acme/abc-123/apply" } }
```

The actual API returns these as **top-level fields**, not nested under `urls`:
```json
{
  "id": "f783a8c4-8ae2-4646-b4f3-a194940ff3b2",
  "text": "Account Executive - Banking and Wealth",
  "categories": { "commitment": "Full-time", "department": "Sales", "location": "San Francisco", "team": "Sales" },
  "hostedUrl": "https://jobs.lever.co/plaid/f783a8c4-8ae2-4646-b4f3-a194940ff3b2",
  "applyUrl": "https://jobs.lever.co/plaid/f783a8c4-8ae2-4646-b4f3-a194940ff3b2/apply"
}
```

**Fix**: Read `hostedUrl` and `applyUrl` directly from the top-level response object.
The `categories` object is accurate — it contains `team` and `location` as documented.

**Also noted**: The Lever API returns 404 for many company slugs even when those
companies appear to use Lever. This may indicate some companies use private/authenticated
boards. The `lever` company's own board (`/v0/postings/lever`) returns an empty array `[]`
rather than 404, which is valid. Confirmed working with `plaid`.

### Ashby: Field names are `location` and `team`, not `locationName` and `teamName`

The documented response shows `locationName` and `teamName` fields. The actual API
returns these fields as `location` and `team`. Additional fields present in live
responses that are not in the docs: `department`, `employmentType`, `secondaryLocations`,
`publishedAt`, `isListed`, `isRemote`, `workplaceType`, `address`, `applyUrl`,
`descriptionHtml`, `descriptionPlain`.

**Fix**: Read `location` and `team` (not `locationName` / `teamName`).
The `title`, `id`, and `jobUrl` fields are accurate as documented.

**Also noted**: The Ashby endpoint does not accept POST requests via WebFetch — it
responds with 404 when called as a POST. Use a **GET** request instead. Confirmed
working with GET against `https://api.ashbyhq.com/posting-api/job-board/linear`.
