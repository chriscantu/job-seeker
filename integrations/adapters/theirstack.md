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

Note: The body must be sent as JSON (Content-Type is already set in the headers above).

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
3. Sum all `credits_used` values for the current calendar month to get `month_total`
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

---

## Known Issues

### API Key Invalid (validated 2026-03-15)

Live validation of the TheirStack API returned **HTTP 401** with the error:
`"Could not validate credentials"`.

The `api_key` in `integrations/config/theirstack-config.md` appears to be a
placeholder — it begins with `tsk_xxxxxxxxxxxxxxxx` (sentinel placeholder prefix)
followed by a JWT segment, which is not a valid TheirStack API key format.

**Resolution required:** Obtain a real API key from
https://theirstack.com/dashboard/api-keys and replace the value in
`integrations/config/theirstack-config.md`. The file is gitignored, so the
real key will not be committed.

Until the key is replaced, the `daily-digest` skill will fall back to WebSearch
for job discovery (per the Error Handling table above).
