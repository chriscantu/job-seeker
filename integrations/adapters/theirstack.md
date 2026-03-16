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
  job_title_or: ["{title1}", "{title2}", ...]
  posted_at_gte: "{YYYY-MM-DD of yesterday}"
  limit: 10
```

Note: The body must be sent as JSON (Content-Type is already set in the headers above).

The API requires at least one of: `posted_at_max_age_days`, `posted_at_gte`, `posted_at_lte`, `job_id_or`, `company_name_or`, `company_id_or`, `company_domain_or`, or `company_linkedin_url_or`.

Company size and location/remote filtering are not supported as direct API query parameters; apply these filters post-retrieval during Phase 3 compose.

### Query Parameter Construction

**job_title_or** — provide an array of exact or partial title strings from the Target Role Titles list in search.md. Example for current search.md:
```json
["VP of Engineering", "Senior Director of Engineering", "Head of Engineering", "SVP of Engineering", "VP of Platform Engineering", "VP of Developer Experience"]
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
| `company`       | Company     | Direct map (field is `company`, not `company_name`) |
| `location`      | Location    | Direct map |
| `url`           | Link        | Verify via ATS API or WebFetch before use |
| `date_posted`   | (internal)  | Used to confirm recency (field is `date_posted`, not `posted_at`) |
| `discovered_at` | (internal)  | ISO timestamp of when TheirStack indexed the role |
| `company_object.employee_count_range` | (internal) | Use for post-retrieval company size filtering |

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

