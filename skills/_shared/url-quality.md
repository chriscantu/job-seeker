# URL Quality Rules

Direct links only. Aggregator URLs are discovery tools — never use them in output.

## Aggregator Exclusion List

These sites are for discovery only. Never use their URLs in digests, seen-postings,
or any user-facing output:

- EchoJobs
- Jobera
- SimplyHired
- RemoteRocketship
- Generic Glassdoor search pages (individual job pages are acceptable)

If a role is found via an aggregator, find the company's actual careers/application
page before including it.

## URL Priority Tiers

When multiple URLs exist for the same role, prefer in this order:

1. **Direct ATS URL** — `boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`
2. **Company careers page** — `company.com/careers/job-id`
3. **Workday/iCIMS/SmartRecruiters** — direct application links
4. **LinkedIn job posting** — `linkedin.com/jobs/view/123456`
5. **NEVER** — aggregator listing pages

## Common ATS URL Patterns

Recognize these patterns to identify direct ATS links:

| ATS | Pattern |
|-----|---------|
| Greenhouse | `boards.greenhouse.io/{company}/jobs/{id}` or `job-boards.greenhouse.io/{company}/jobs/{id}` |
| Lever | `jobs.lever.co/{company}/{id}` |
| Ashby | `jobs.ashbyhq.com/{company}` (no job ID in path) |
| Workday | `{company}.wd5.myworkdayjobs.com/.../job/{title}_{id}` |
| SmartRecruiters | `jobs.smartrecruiters.com/{company}/{id}` |

## Tracking Redirect Resolution

Email alerts often wrap URLs in tracking redirects (Indeed `rc/clk/`, LinkedIn
`/comm/`, etc.). Before using a URL from an email:

1. Issue a WebFetch on the tracking URL
2. Use the final resolved URL (after redirects) for dedup and display
3. If resolution fails, note "unresolved redirect" and use the original URL

## Title Normalization

Before matching titles against search criteria or displaying them, expand
common abbreviations:

| Abbreviation | Expansion |
|-------------|-----------|
| Sr. / Sr  | Senior |
| Jr. / Jr  | Junior |
| Eng. / Eng  | Engineering |
| Mgr. / Mgr  | Manager |
| Dir. / Dir  | Director |
| VP | VP (no change — already standard) |

Apply normalization before:
- Matching against target role titles from `config/search.md`
- Matching against company skip lists
- Displaying roles in digests or result tables
- Dedup comparisons
