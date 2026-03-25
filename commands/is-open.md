---
name: is-open
description: >
  Check if a single job posting URL is still accepting applications.
  Triggers: /is-open <url>, "is this posting still open", "check if
  this role is still active"
allowed-tools: Read, WebFetch
---

# Check Job Posting Status

Verify whether a single job posting URL is still active and accepting
applications.

## Required Input

- A job posting URL (passed as argument or ask the user)

## Steps

1. Read `integrations/adapters/ats-apis.md` for the URL routing logic.

2. Determine the verification method based on URL pattern:

   | URL matches | Method |
   |------------|--------|
   | `boards.greenhouse.io/{co}/jobs/{id}` | Greenhouse API |
   | `job-boards.greenhouse.io/{co}/jobs/{id}` | Greenhouse API |
   | `jobs.lever.co/{co}/{id}` | Lever API |
   | `jobs.ashbyhq.com/{co}` | Ashby API |
   | Anything else | WebFetch the URL directly |

3. Issue the appropriate verification call (WebFetch to the API endpoint
   or directly to the URL).

4. Interpret the result per the rules in ats-apis.md:
   - 200 + job data → ✅ **Open** — show title, location, company
   - 404 → ❌ **Closed** — posting no longer available
   - Error/inconclusive → ⚠️ **Unverifiable** — suggest checking manually

5. Report the result in a single line:
   ```
   ✅ Open — VP of Engineering at Acme Corp (Remote)
   ```
   or
   ```
   ❌ Closed — this posting is no longer accepting applications
   ```
