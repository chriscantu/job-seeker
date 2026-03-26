# Email Patterns — Apple Mail

Pattern library for the `scan-email` skill. Used to detect and classify
job-related emails from the configured Apple Mail account/inbox (see
`integrations/config/mail-config.md`). All matching is case-insensitive.

---

## Job Alert Senders

Match if the sender's email domain matches any of these patterns. The
**Source Label** is recorded in seen-postings for source effectiveness
tracking.

| Sender Domain | Source Label | Notes |
|---------------|-------------|-------|
| `@indeed.com`, `@indeedmail.com` | Indeed | Primary alert sender |
| `@linkedin.com`, `@e.linkedin.com` | LinkedIn | Job alert notifications |
| `@glassdoor.com`, `@mail.glassdoor.com` | Glassdoor | Job alert notifications |
| `@remotehunter.com` | RemoteHunter | Remote-focused job alerts |
| `@wellfound.com`, `@angel.co` | Wellfound | Startup-focused (formerly AngelList) |
| `@google.com` | Google Alerts | Only when subject contains "Google Alert" |
| `@otta.com` | Otta | Curated job matches |
| `@ziprecruiter.com` | ZipRecruiter | Job alert notifications |
| `@builtin.com` | Built In | Tech-focused job alerts |
| `@hired.com` | Hired | Tech talent marketplace |

---

## Title Keywords (Subject Pre-Filter)

After matching the sender domain, the email subject must contain at least
one title keyword to qualify for body fetch. This prevents fetching bodies
for irrelevant alerts (e.g., Indeed notifications about junior roles).

Read the full list from `config/search.md` → Target Role Titles. For fast
subject-line matching, use these shorthand signals (case-insensitive
substring match):

- "VP"
- "Vice President"
- "Senior Director"
- "Head of Engineering"
- "SVP"
- "Director of Engineering"

If the subject does not contain any of these signals, skip the email — do
not fetch its body.

---

## Skip Rules

Do **not** fetch the body for emails matching any of these patterns:

### Newsletter / Digest Summaries
- Subject contains: "weekly digest", "jobs you might like", "weekly update",
  "newsletter", "job market report"
- These are aggregate summaries, not individual job alerts

### Marketing / Promotional
- Sender name contains: "marketing", "promotions", "no-reply" (without an
  ATS domain)
- Subject contains: "upgrade your", "premium", "boost your profile"

### Age Filter
- Emails older than 7 days (use `date received` from the metadata scan)
- Stale alerts are unlikely to have live postings

### Already Seen
- If the email subject + sender combination fuzzy-matches a company+role
  already in `output/*-seen-postings.md`, skip it

---

## URL Extraction Patterns

When parsing the email body/source, look for URLs matching these ATS patterns
(in priority order):

| Pattern | ATS | Notes |
|---------|-----|-------|
| `boards.greenhouse.io/{company}/jobs/{id}` | Greenhouse | Direct posting |
| `job-boards.greenhouse.io/{company}/jobs/{id}` | Greenhouse | Alternate domain |
| `jobs.lever.co/{company}/{id}` | Lever | Direct posting |
| `jobs.ashbyhq.com/{company}` | Ashby | Company board (match by title) |
| `{company}.wd{N}.myworkdayjobs.com/` | Workday | Various subdomain numbers |
| `jobs.smartrecruiters.com/{company}/{id}` | SmartRecruiters | Direct posting |
| `linkedin.com/jobs/view/{id}` | LinkedIn | Last resort — prefer ATS direct |

### Tracking Redirect URLs (strip these)

Job alert emails often wrap URLs in tracking redirects. Common patterns:

| Source | Redirect Pattern | Action |
|--------|-----------------|--------|
| Indeed | `indeed.com/rc/clk/...` | Follow redirect to extract final URL |
| LinkedIn | `linkedin.com/comm/jobs/view/...` | Strip `/comm` prefix |
| Glassdoor | `glassdoor.com/partner/jobListing.htm?...` | Extract `jobUrl` param |
| ZipRecruiter | `ziprecruiter.com/k/...` | Follow redirect |

When a tracking redirect is detected, attempt to resolve it with a single
WebFetch call. If the redirect resolves to a known ATS URL, use that. If
not, use the resolved URL as-is.

---

## Future: Application Status Patterns (v2)

> Not implemented in v1. Documented for future enhancement.

### ATS Notification Senders

| Sender Domain | ATS |
|---------------|-----|
| `@greenhouse.io`, `no-reply@greenhouse.io` | Greenhouse |
| `@lever.co`, `notifications@lever.co` | Lever |
| `@ashbyhq.com` | Ashby |

### Status Signals (subject or body)

| Signal | Interpretation |
|--------|---------------|
| "application received", "thank you for applying" | Applied |
| "we'd like to", "move forward", "next steps" | Screen / Interview |
| "interview scheduled", "schedule your interview" | Interview |
| "unfortunately", "we've decided", "not moving forward" | Rejected |
| "offer", "we're excited to extend" | Offer |

---

## Future: Recruiter Outreach Patterns (v2)

> Not implemented in v1. Documented for future enhancement.

### Signals
- Sender domain is a company domain (not a personal email service)
- Subject contains: "opportunity", "role", "position", "reach out",
  "interested in your background"
- Title keywords from `config/search.md` present in subject

### Exclusions
- Personal email services: `@gmail.com`, `@yahoo.com`, `@hotmail.com`,
  `@outlook.com` (likely spam, not recruiting)
- Known staffing/aggregator domains from `config/search.md` exclusions
