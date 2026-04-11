# Follow-Up Draft Skill + Gmail Trash Utility

**Date**: 2026-04-11
**Issue**: #17 (Follow-up draft skill via Gmail MCP) + Gmail trash for scan-email
**Status**: Approved

---

## Problem

After applying to roles, there is no automated way to (1) identify stale
applications and draft personalized follow-up emails, or (2) clean up processed
job-alert emails from Gmail after scan-email runs. Both are manual, repetitive
tasks competing with higher-value search activities.

## Approach

Two independent deliverables with clean separation of concerns:

| Piece             | Purpose                                                                                  | Triggered by     |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------- |
| `scripts/gmail.js` | Thin CLI wrapping `googleapis` for Gmail API operations the built-in MCP cannot do (trash) | scan-email Phase 6 |
| `/follow-up` skill | Identify stale apps, generate follow-up emails, create Gmail drafts, update state          | User invocation  |

The built-in Claude.ai Gmail MCP handles read/search/draft. The googleapis
script handles trash only. No third-party MCP server.

---

## Deliverable 1: `scripts/gmail.js` — Gmail API Utility

### Interface

```bash
bun scripts/gmail.js auth          # One-time OAuth2 consent flow
bun scripts/gmail.js trash <id>... # Trash one or more messages by ID
```

### Authentication

- Reads `credentials/gmail-client-secret.json` (Google Cloud OAuth2 Desktop
  client, gitignored)
- First run of `auth`: opens browser for consent, stores tokens to
  `credentials/gmail-tokens.json` (gitignored)
- Subsequent runs: auto-refreshes tokens silently
- Scope: `gmail.modify` only (minimum required for trash)

### Trash Behavior

- Calls `gmail.users.messages.trash(messageId)` for each ID
- Moves to Gmail Trash (recoverable for 30 days)
- Does NOT call `messages.delete()` — no permanent deletion
- Output: `trashed: <id>` per success, `error: <id> <reason>` per failure
- Exit code: 0 if all succeed, 1 if any fail

### File Structure

```text
credentials/                  # gitignored
  gmail-client-secret.json    # from Google Cloud Console
  gmail-tokens.json           # auto-generated on first auth
scripts/
  gmail.js                    # CLI entry point
  lib/gmail-auth.js           # OAuth2 token load/refresh/save
```

### Dependency

Add `googleapis` to `package.json`.

---

## Deliverable 2: scan-email Integration

### Current Behavior (SKILL.md lines 196-199)

> Report processed messages for manual cleanup (Gmail MCP cannot trash).

### New Behavior

Phase 6 gains Gmail trash capability:

1. Trash Apple Mail alerts (unchanged — osascript)
2. Trash Gmail alerts:
   - Collect `messageId`s of all Gmail candidates that were body-fetched
     and presented in the confirmation table
   - Call: `bun scripts/gmail.js trash <id1> <id2> ...`
   - Report: "Trashed N Gmail messages" or surface errors
3. State updates (unchanged)

### Constraints

- Only trash messages that were body-fetched AND presented to the user
- Never trash emails the skill did not process

### Fallback

If `scripts/gmail.js` is not set up (no credentials), fall back to the
current manual cleanup report with guidance:
"Run `bun scripts/gmail.js auth` to enable automatic Gmail cleanup."

### scan-email Updates

- `skills/scan-email/SKILL.md`: update Phase 6 Gmail section
- Remove future enhancement note at line 234 (Gmail trash support)
- No changes to classification-rules.md or body-extraction.md

---

## Deliverable 3: `/follow-up` Skill

### Purpose

Identify stale applications, generate personalized follow-up email drafts,
create them in Gmail via built-in MCP `gmail_create_draft`, and update
application state.

### Trigger Phrases

"draft follow-ups", "follow up on applications", "any stale apps",
"what needs follow-up"

### Workflow

```text
1. Read applications state (bun scripts/state.js read applications)
2. Filter for stale active apps (by thresholds below)
3. Present stale apps table — user confirms which to draft for
4. For each confirmed app:
   a. Read company context if available (output/{slug}/company-research.md,
      cover letter, resume tailor, why-this-company)
   b. Generate follow-up email body per voice-guide
   c. Create Gmail draft via gmail_create_draft
   d. Update applications.md: Next action + History + Notes
5. Report: "Created N follow-up drafts in Gmail — review before sending"
```

### Staleness Thresholds

| Stage | Days since last activity | Rationale |
|-------|------------------------|-----------|
| Applied | 10 | Standard recruiter response window |
| Screen | 7 | Active process, shorter window |
| Interview (1/2+) | 5 | Post-interview follow-up is time-sensitive |
| Final Round | 5 | Momentum matters |
| Offer / Decision | 3 | Negotiation cadence is fast |

These are defaults. The skill presents candidates and the user picks which
to act on. The user may also invoke the skill with a specific company name.

### Skip Conditions

- Stage is Discovery, Research, or Closed
- Close reason is rejected, withdrawn, ghosted, or closed

### Recipient Resolution

The applications schema does not store recruiter email addresses. For each
follow-up, resolve the recipient in this order:

1. **Contacts field**: If the application entry has a contact name, ask the
   user for their email address
2. **Gmail thread search**: Search Gmail via `gmail_search_messages` for
   prior correspondence with the company (e.g., `from:@company.com` or
   `to:@company.com`). Extract the recruiter/HR email from the thread.
3. **User prompt**: If neither source yields an address, ask the user to
   provide it before creating the draft

The resolved email is passed to `gmail_create_draft` as the `to` field.
It is NOT stored in the applications state file (privacy constraint —
no recruiter personal emails in state).

### Email Generation Rules

Per `references/voice-guide.md`:

- Tone: peer-to-peer, direct, no desperation
- Reference the specific role and stage ("Following up on the VP Engineering
  conversation from last week")
- Brief value connection if company research exists (1 sentence, not a pitch)
- Close pointing forward ("Happy to share anything else that would be helpful
  for next steps")
- Plain text, no HTML

Banned phrases: "just checking in", "circling back", "touching base",
"I'm passionate about", "uniquely positioned", any voice-guide anti-pattern.

### State Updates (per draft)

- **History**: append `{today}: {stage} — Follow-up email drafted`
- **Next action**: `Review and send follow-up draft in Gmail`
- **Notes**: append `Follow-up drafted {today} via /follow-up`

### Skill File Structure

```text
skills/follow-up/
  SKILL.md              # Main skill definition
.claude/commands/
  follow-up.md          # Slash command registration
```

No artifacts saved to disk. The email body lives in the Gmail draft.
Gmail is the source of truth for draft content.

---

## Deliverable 4: Wiring and Configuration

### CLAUDE.md Skill Routing

Add to the routing table:

| User says | Run this command |
|-----------|-----------------|
| draft follow-ups, follow up on applications, any stale apps, what needs follow-up | `/follow-up` |

### .gitignore

Add `credentials/` directory.

### package.json

Add `googleapis` dependency.

### Setup Skill

Add Gmail API credential checks:

- If `credentials/gmail-client-secret.json` missing: "Gmail trash disabled.
  See setup instructions."
- If `credentials/gmail-tokens.json` missing: "Run `bun scripts/gmail.js auth`
  to authorize."

### scan-email Future Enhancements

Remove line 234 ("Gmail trash support (when MCP adds message modification)")
since this spec implements it.

---

## What This Spec Does NOT Cover

- Automatic email sending (always draft for review)
- Gmail message ID persistence in state files (not needed — scan-email
  holds IDs in working memory, follow-up skill uses MCP search)
- Application status detection from email (separate issue #18)
- Networking outreach drafts (separate skill #24)
