---
name: follow-up
description: >
  Identify stale applications and draft personalized follow-up emails.
  Reads application state, filters by staleness thresholds, generates
  emails per voice-guide, creates Gmail drafts via scripts/gmail.js, and
  updates application state. Never sends automatically — always drafts
  for review.
  Triggers: "draft follow-ups", "follow up on applications", "any stale apps",
  "what needs follow-up"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Follow-Up

Draft personalized follow-up emails for stale applications. Creates Gmail
drafts for user review — never sends automatically.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Verify Gmail API credentials are configured and authenticated:

```bash
bun scripts/gmail.js profile
```

If the command fails with "Not authenticated" or "Client secret file not
found", stop with guidance:
> "Gmail API credentials are required for follow-up drafts. Set them up:
> 1. Create OAuth2 credentials in Google Cloud Console (Desktop app)
> 2. Save as `credentials/gmail-client-secret.json`
> 3. Run `bun scripts/gmail.js auth`"

On success, the command prints the authenticated email address.

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
```bash
bun scripts/gmail.js search "from:@{company-domain} OR to:@{company-domain}" --max 5
```

The command prints a JSON array of messages with `from`, `to`, `subject`,
`date`, and `snippet`. Parse it and extract the recruiter/HR email address
from the most recent thread. Present the found address to the user for
confirmation.

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

Write the body to a temp file, then call the CLI:

```bash
# Write body to temp file (use the Write tool)
# Then:
bun scripts/gmail.js create-draft --to "{email}" --subject "{subject}" --body-file /tmp/followup-{company-slug}.txt
```

The command prints a JSON object with `draftId` and `messageId` on success.
Report: "Draft created for {Company}."

### Step 4e: Update application state

Update the **Next action** field to `Review and send follow-up draft in Gmail`
by reading the applications state file, finding the entry, editing the
`Next action` line, and writing it back.

Then append a note via CLI (this updates `lastActivity` and `history`
automatically — see the `addNote()` function in `scripts/lib/applications.js`):

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
| `gmail.js profile` fails (not authenticated) | Stop: show setup guidance |
| `gmail.js create-draft` fails | Report error, continue with next app |
| `gmail.js search` fails (401/403) | Stop: prompt to re-authenticate |
| state.js add-note fails | Warn, continue — draft was still created |
| Company slug directory missing | Skip context gathering, draft without personalization |

## Key Constraints

- Never send emails automatically — always create drafts for user review
- Follow voice-guide.md tone — peer-to-peer, no desperation
- Do not store recruiter email addresses in application state
- User confirms each draft before it goes to Gmail
- Plain text only — no HTML emails
