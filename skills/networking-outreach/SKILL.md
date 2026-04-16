---
name: networking-outreach
description: >
  Draft personalized outreach messages for target companies and contacts.
  Use when reaching out to engineering leaders, requesting warm introductions,
  or building recruiter relationships during a job search.
  Triggers: "draft outreach", "reach out to", "networking message",
  "warm intro", "recruiter outreach"
allowed-tools: Read, Write, Edit, Bash, Glob, WebSearch, WebFetch
---

# Networking Outreach

Draft personalized outreach messages — cold, warm intro, or recruiter —
with Gmail draft delivery and LinkedIn clipboard. Never sends automatically.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Verify Gmail API credentials:

```bash
bun scripts/gmail.js profile
```

If unauthenticated, stop with guidance:
> "Gmail API credentials are required. Set them up:
> 1. Create OAuth2 credentials in Google Cloud Console (Desktop app)
> 2. Save as `credentials/gmail-client-secret.json`
> 3. Run `bun scripts/gmail.js auth`"

Additionally read:
- `references/voice-guide.md` — tone calibration
- Glob `references/writing-samples/*.md` — if any exist, read to calibrate

## Phase 1 — Input Parsing

Parse `$ARGUMENTS` to detect message type and extract fields.

**Detection rules (first match wins):**

1. Args contain "warm intro" or "via {name}" → `warm-intro`
2. Args contain "recruiter" → `recruiter`
3. Args contain "cold" → `cold`
4. Only a company name → ask: "What type? Cold outreach, warm intro, or
   recruiter?"

**Fields to extract:**

| Field | Required | Notes |
|-------|----------|-------|
| `company` | Always | Company name, parsed or prompted |
| `message_type` | Always | cold, warm-intro, recruiter |
| `connector_name` | warm-intro | "via {name}" or prompted |
| `target_person` | Optional | Specific person at the company |
| `context` | Optional | Freeform: "met at QCon", "saw their blog" |

If any required field is missing after parsing, ask one follow-up question
at a time. Do not present a form.

## Phase 2 — Research

### Step 2a: Dedup check

Read outreach log via `skills/_shared/state-io.md` (type: `outreach-log`).
If the same company + message type was logged in the last 14 days, warn:

> "You reached out to {company} ({type}) on {date}. Draft another anyway?"

Proceed only on confirmation.

### Step 2b: Company context (reuse-first)

Derive `company-slug` from company name: lowercase, replace non-alphanumeric
runs with hyphens, strip leading/trailing hyphens.

1. Check `output/{company-slug}/company-research.md` — if exists and < 7
   days old, read its Positioning and Mission sections.
2. Check for other materials in `output/{company-slug}/` — cover letter,
   why-this-company. Pull positioning hooks from any that exist.
3. If no usable research, run lightweight pass — 3 parallel WebSearches:
   - `{company} mission engineering culture`
   - `{company} funding round employees size`
   - `{company} recent news engineering blog`
   Extract: mission/product, company size, funding stage, 1-2 recent signals.

### Step 2c: Accomplishment mapping

From research, identify 1-2 strongest connections between accomplishments
in `config/candidate.md` and the company's challenges/stage. This becomes
the message "bridge" — one sentence.

### Step 2d: Target person research (if provided)

If `target_person` was specified, run one WebSearch:
`{target_person} {company} LinkedIn`

Extract: title, tenure, recent publications or talks.

Research output is ephemeral — not written to disk.

## Phase 3 — Generate

Read `skills/networking-outreach/message-rules.md`. Use the section matching
`message_type`.

Generate two variants:

1. **Full message** — email/InMail length per the type's structure
2. **LinkedIn connection request** — under 300 characters, same hook
   compressed

For `warm-intro` type, also generate:

3. **Forwardable blurb** — 2-3 sentence self-contained intro

Apply the quality gate from message-rules.md before presenting. If any check
fails, revise and re-check.

## Phase 4 — Review & Deliver

Present draft(s):

```text
──────────────────────────────────────────────
Full message (email / InMail):

{full_message}

──────────────────────────────────────────────
LinkedIn connection request ({char_count} chars):

{linkedin_short}

──────────────────────────────────────────────
```

For warm-intro, also show the forwardable blurb.

Ask: "Create Gmail draft and copy LinkedIn version to clipboard? [y/N/edit]"

- **y**: proceed to deliver
- **edit**: ask what to change, regenerate, re-present
- **N**: stop

### Delivery

1. Write full message body to `/tmp/outreach-{company-slug}.txt`
2. Create Gmail draft:
   ```bash
   bun scripts/gmail.js create-draft --subject "{subject}" --body-file /tmp/outreach-{company-slug}.txt
   ```
   Add `--to "{email}"` if recipient email is known.
3. Copy LinkedIn version to clipboard:
   ```bash
   printf '%s' '{linkedin_short}' | pbcopy
   ```
4. Report: "Gmail draft created. LinkedIn version copied to clipboard
   ({N} chars)."

For warm-intro: ask which to clipboard — the message to the connector or
the forwardable blurb. Default to the forwardable blurb.

**Subject line conventions:**
- Cold: "{Your name} — {one-line hook}" or "Quick question re: {topic}"
- Warm intro: "Introduction request — {target company}"
- Recruiter: "{Your name} — VP/Head of Eng, platform engineering"

## Phase 5 — State Update

Read `skills/_shared/state-io.md` and execute the append pattern for
`outreach-log`.

Entry format:

```
## YYYY-MM-DD
- {Company} | {Type} | {Target Person} | {Connector} | {Channel} | sent:YYYY-MM-DD
```

If no outreach-log file exists, create `output/YYYY-MM-DD-outreach-log.md`
with frontmatter:

```yaml
---
format_version: 1
last_updated: YYYY-MM-DD
---
# Networking Outreach Log
```

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Gmail not authenticated | Stop: show setup guidance |
| `create-draft` fails | Report error, do not write state |
| WebSearch returns nothing | Draft without company research; note in output |
| No `config/candidate.md` | Caught by preflight |
| Outreach log missing | Create new one |
| `pbcopy` fails | Warn, continue — Gmail draft still created |

## Key Constraints

- Never send messages automatically — always create drafts
- Follow voice-guide.md tone — peer-to-peer, friendly pragmatist
- Every message must pass the quality gate in message-rules.md
- One question at a time when gathering missing input
- Research is ephemeral — not saved to disk
- LinkedIn version must be under 300 characters
