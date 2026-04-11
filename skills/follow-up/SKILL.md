---
name: follow-up
description: >
  Identify stale applications and draft personalized follow-up emails.
  Reads application state, filters by staleness thresholds, generates
  emails per voice-guide, creates Gmail drafts via MCP, and updates
  application state. Never sends automatically — always drafts for review.
  Triggers: "draft follow-ups", "follow up on applications", "any stale apps",
  "what needs follow-up"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Follow-Up

Draft personalized follow-up emails for stale applications. Creates Gmail
drafts for user review — never sends automatically.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Additionally:
- Read `references/voice-guide.md` — tone and anti-patterns for email copy
- Read `integrations/config/gmail-config.md` — verify Gmail is enabled

If Gmail is not enabled, stop:
> "Gmail is required for follow-up drafts. Configure it first:
> copy `integrations/config/gmail-config.md.example` to `gmail-config.md`"

Verify Gmail MCP connection: `[gmail_get_profile]`. If error, stop with
guidance.

## Phase 1 — Identify Stale Applications

Read application state:
```bash
bun scripts/state.js read applications
```

Parse the JSON output. Filter for **active applications** that meet staleness
thresholds:

| Stage | Days since last activity |
| ----- | ----------------------- |
| Applied | 10 |
| Screen | 7 |
| Interview (1) | 5 |
| Interview (2+) | 5 |
| Final Round | 5 |
| Offer | 3 |
| Decision | 3 |

Calculate days since last activity using `lastActivity.date` and today's date.

**Skip** entries where:
- Stage is Discovery, Research, or Closed
- Stage starts with `Closed`

If `$ARGUMENTS` contains a company name, filter to only that company
(case-insensitive substring match) regardless of staleness threshold.

If no stale applications found:
> "No stale applications found. All active apps have recent activity."

Stop.

## Phase 2 — Present Candidates

Show the stale applications in a table:

```text
Stale Applications — Follow-Up Candidates
──────────────────────────────────────────────────
 # | Company          | Role                  | Stage          | Last Activity    | Days
 1 | Acme Corp        | VP Engineering        | Applied        | 2026-03-28       | 14
 2 | Widgets Inc      | Sr Dir Engineering    | Interview (1)  | 2026-04-04       | 7
──────────────────────────────────────────────────
```

Ask the user which applications to draft follow-ups for:
> "Which ones should I draft follow-ups for? (e.g., '1,2', 'all', or 'none')"

If `none`, stop.

## Phase 3 — Resolve Recipients

For each selected application, resolve the recipient email address:

**Step 3a: Check Contacts field**
If the application entry has a contact name, ask the user:
> "{Company}: Contact is {name}. What's their email address?"

**Step 3b: Search Gmail for prior correspondence**
If no contact or user says "search":
```
[gmail_search_messages: query="from:@{company-domain} OR to:@{company-domain}" maxResults=5]
```

Read the most recent thread to extract the recruiter/HR email address.
Present the found address to the user for confirmation.

**Step 3c: Ask directly**
If neither source yields an address:
> "{Company}: I couldn't find a contact email. Who should this go to?"

Do NOT store the resolved email in application state (privacy constraint).

## Phase 4 — Generate and Draft

For each selected application:

### Step 4a: Gather context

Check for existing company materials:
- `output/{company-slug}/company-research.md`
- `output/{company-slug}/*CoverLetter*.md`
- `output/{company-slug}/*ResumeTailor*.md`
- `output/{company-slug}/why-this-company*.md`

Read any that exist — use them to personalize the follow-up with a brief
value connection (1 sentence max).

Read `config/candidate.md` for the candidate's name.

### Step 4b: Generate email body

Write a follow-up email following these rules from `references/voice-guide.md`:

**Tone**: peer-to-peer, direct, warm. Not desperate, not corporate.

**Structure**:
1. Opening: Reference the specific role and last interaction
   ("Following up on the {title} conversation from {timeframe}")
2. Value connection: One sentence connecting candidate strengths to the
   role, drawn from company research or cover letter if available.
   Skip if no context exists — don't fabricate.
3. Close: Point forward with a low-pressure ask
   ("Happy to share anything else that would be helpful for next steps")
4. Sign-off: "Best, {candidate_name}"

**Banned phrases** — do not use any of these:
- "just checking in"
- "circling back"
- "touching base"
- "I'm passionate about"
- "uniquely positioned"
- "leverage my experience"
- "I wanted to follow up" (use active framing instead)

**Format**: Plain text. No HTML, no markdown formatting.

**Length**: 4-6 sentences. Short enough to read on a phone.

**Subject line**: "Re: {role title} — {company}" or
"Following up — {role title} at {company}"

### Step 4c: Show draft for approval

Present the draft to the user:

```text
──────────────────────────────────────────────────
To: {email}
Subject: {subject}

{body}
──────────────────────────────────────────────────
```

Ask: "Send this to Gmail drafts? (yes / edit / skip)"

- **yes**: proceed to create draft
- **edit**: ask what to change, regenerate, show again
- **skip**: move to next application

### Step 4d: Create Gmail draft

```
[gmail_create_draft: to="{email}" subject="{subject}" body="{body}"]
```

Report: "Draft created for {Company}."

### Step 4e: Update application state

Update the **Next action** field to `Review and send follow-up draft in Gmail`
by reading the applications state file, finding the entry, editing the
`Next action` line, and writing it back.

Then append a note via CLI (this updates `lastActivity` and `history`
automatically — see `scripts/lib/applications.js:404-422`):

```bash
bun scripts/state.js add-note applications --company "{company}" --note "Follow-up drafted {today} via /follow-up"
```

## Phase 5 — Summary

After all selected applications are processed:

> "Created {N} follow-up draft(s) in Gmail — review before sending.
> {list of companies with draft status}"

## Error Handling

| Condition | Behavior |
| --------- | -------- |
| No applications file | Stop: "No applications tracked yet. Use /application-tracker first." |
| Gmail MCP error | Stop: show connection guidance |
| gmail_create_draft fails | Report error, continue with next app |
| state.js add-note fails | Warn, continue — draft was still created |
| Company slug directory missing | Skip context gathering, draft without personalization |

## Key Constraints

- Never send emails automatically — always create drafts for user review
- Follow voice-guide.md tone — peer-to-peer, no desperation
- Do not store recruiter email addresses in application state
- User confirms each draft before it goes to Gmail
- Plain text only — no HTML emails
