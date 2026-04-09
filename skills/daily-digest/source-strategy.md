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
