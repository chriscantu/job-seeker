# Networking Outreach Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub networking-outreach skill with a working skill that drafts personalized cold, warm-intro, and recruiter outreach messages with Gmail draft delivery and clipboard for LinkedIn.

**Architecture:** Single SKILL.md orchestrator (phases 0-5) + message-rules.md companion file. Reuses existing infrastructure: `scripts/gmail.js` for draft creation, `skills/_shared/` for preflight and state-io, `references/voice-guide.md` for tone. New outreach-log state file tracks sent messages for dedup.

**Tech Stack:** Markdown skill files, `bun scripts/gmail.js` CLI, `pbcopy` for clipboard, WebSearch for lightweight company research.

**Spec:** `docs/superpowers/specs/2026-04-16-networking-outreach-design.md`

---

### Task 1: Create message-rules.md companion file

**Files:**
- Create: `skills/networking-outreach/message-rules.md`

This is the reference file the orchestrator reads during Phase 3 (Generate).
It defines per-type message structures, banned phrases, examples, and the
quality gate. Building it first so the orchestrator can reference it.

- [ ] **Step 1: Create `message-rules.md` with all three message type structures**

```markdown
# Networking Outreach — Message Rules

Per-type message structures, banned phrases, and quality gate.
Read by the orchestrator during Phase 3 before generating any message.

---

## Message Types

### Cold Outreach

**Length:** 2-3 sentences (full version). Under 300 characters (LinkedIn
connection request version).

**Structure:**

1. **Hook** — Reference something specific and recent about the recipient
   or their company. Must be grounded in research (a blog post, funding
   round, product launch, conference talk). Generic flattery fails the
   quality gate.
2. **Bridge** — One sentence connecting a specific accomplishment from
   `config/candidate.md` to their context. Include a number.
3. **Ask** — A low-friction, async-answerable question. Not "can we hop
   on a call" — something they can reply to in one sentence.

**Example (full):**

> I saw Natera's push into UX-driven genomic workflows — the shift from
> clinical tooling to patient-facing experience is a platform challenge
> we tackled at Procore when we drove 85% design system adoption across
> 185 repos. Curious how your team is approaching frontend architecture
> at that scale?

**Example (LinkedIn connection request, 283 chars):**

> Saw Natera's shift to patient-facing UX — we solved a similar platform
> challenge at Procore (85% design system adoption, 185 repos). Curious
> how your frontend architecture is evolving at that scale.

---

### Warm Intro Request

**Length:** 3-4 sentences to the connector + 2-3 sentence forwardable blurb.

**Structure (message to connector):**

1. **Context** — Why you're reaching out to this specific person. Reference
   your relationship ("We worked together at Vrbo" or "We met at QCon").
2. **Who + Why** — Name the target person and what you'd discuss. Be
   specific — "just to network" fails the quality gate.
3. **Forwardable blurb** — Self-contained 2-3 sentence intro the connector
   can copy-paste. Includes: name, what you do (scope + domain), and why
   you're specifically relevant to the target person or their company.
4. **Easy out** — "No pressure if the timing isn't right" or equivalent.

**Example (to connector):**

> Hey Sarah — I'm exploring VP of Engineering roles and noticed Natera
> is hiring for one focused on UX/commercial applications. I led a similar
> platform transformation at Procore (60+ engineers, 185 repos, 85% design
> system adoption). Would you be open to introducing me to their VP of
> Product or the hiring manager?
>
> Here's a blurb you can forward if it's easier:
>
> "Chris Cantu is an engineering leader who most recently led platform
> engineering at Procore — 60+ engineers across 8 international teams,
> driving CI/CD adoption from 1% to 95% and reducing deploy cycles from
> 6 months to minutes. He's looking at VP/Head of Engineering roles
> focused on platform and delivery transformation."
>
> Totally understand if the timing doesn't work — appreciate you either way.

---

### Recruiter Outreach

**Length:** 3-4 sentences.

**Structure:**

1. **Positioning** — Niche and scope upfront. Recruiters pattern-match on
   team size, budget, and domain. Lead with these.
2. **What you're looking for** — Target titles, company type (mission-driven,
   growth-stage, Series B+), location (remote or Austin hybrid).
3. **Signal** — One specific accomplishment with a number that demonstrates
   the level. Not a resume dump — one sentence.
4. **Availability** — "Open to a conversation if you're filling roles in
   this space" or equivalent.

**Example:**

> I lead platform engineering orgs of 60+ engineers — CI/CD, design systems,
> developer experience, multinational teams across 4 continents. Looking for
> VP or Head of Engineering roles at mission-driven, growth-stage companies
> (Series B+, remote or Austin). At Procore, we took release velocity from
> 6-month cycles to continuous deployment and grew CI/CD adoption from 1%
> to 95% across 185 repos. Open to a conversation if you're filling roles
> in this space.

---

## Banned Phrases

Do not use any of these in any message type:

- "just checking in"
- "circling back"
- "touching base"
- "I'm passionate about"
- "uniquely positioned"
- "leverage" (as a verb)
- "I'd love to pick your brain"
- "I'd love to connect and learn from you"
- "I've been following your company for a while"
- "I've been fortunate enough to lead..."
- "I'm really impressed by what you're building"
- "I wanted to reach out" (just reach out — don't narrate the act)
- "thought leadership"
- "synergy"
- Any sentence that starts with "I'm passionate"

---

## Quality Gate

Before presenting any draft to the user, verify all of the following:

1. **Natural voice** — Would Chris say this in a conversation? Read it
   aloud mentally. If it sounds like a template, rewrite.
2. **Specific number** — At least one concrete number from
   `config/candidate.md` accomplishments (team size, percentage, dollar
   amount, repo count).
3. **Grounded hook** — The opening references something real and specific
   about the recipient or company (from research). Not generic.
4. **Low-friction ask** — The ask can be answered in one sentence or with
   a yes/no. Not "can we schedule a 30-minute call."
5. **No banned phrases** — Scan against the list above.
6. **LinkedIn length** — Connection request version is under 300 characters.
7. **"We" over "I"** — Team accomplishments use "we." Personal decisions
   use "I." Check per `references/voice-guide.md` Rule 3.
```

- [ ] **Step 2: Verify the file reads cleanly**

Run: `wc -l skills/networking-outreach/message-rules.md`
Expected: ~120-130 lines (well under 500-line limit)

- [ ] **Step 3: Commit**

```bash
git add skills/networking-outreach/message-rules.md
git commit -m "feat(networking-outreach): add message-rules companion file

Per-type structures for cold, warm-intro, and recruiter outreach.
Includes banned phrases, quality gate, and calibrated examples."
```

---

### Task 2: Replace SKILL.md stub with full orchestrator

**Files:**
- Modify: `skills/networking-outreach/SKILL.md` (replace entire contents)

This is the main skill file — the orchestrator that Claude reads and
executes when `/networking-outreach` is invoked.

- [ ] **Step 1: Replace SKILL.md with the full orchestrator**

Replace the entire contents of `skills/networking-outreach/SKILL.md` with:

```markdown
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
```

- [ ] **Step 2: Verify line count is under 500**

Run: `wc -l skills/networking-outreach/SKILL.md`
Expected: ~190-210 lines

- [ ] **Step 3: Commit**

```bash
git add skills/networking-outreach/SKILL.md
git commit -m "feat(networking-outreach): replace stub with full orchestrator

Phases 0-5: input parsing, company research (reuse-first), message
generation per message-rules.md, Gmail draft + clipboard delivery,
outreach-log state tracking."
```

---

### Task 3: Verify slash command and skill routing

**Files:**
- Read: `.claude/commands/networking-outreach.md` (verify, no changes needed)
- Read: `CLAUDE.md` (verify skill routing table)

- [ ] **Step 1: Verify command registration**

Read `.claude/commands/networking-outreach.md`. Expected contents:

```
Read and execute skills/networking-outreach/SKILL.md for the current session.
Use $ARGUMENTS as the user's input if provided.
```

This is already correct — no changes needed.

- [ ] **Step 2: Verify CLAUDE.md skill routing table**

Read `CLAUDE.md` and check the Skill Routing table. It should already have:

```
| draft outreach, reach out to, networking message | `/networking-outreach` |
```

Confirm this row exists. No changes needed.

- [ ] **Step 3: Commit (only if changes were needed)**

If any changes were made, commit. Otherwise skip.

---

### Task 4: End-to-end test — cold outreach

**Files:**
- Read: `skills/networking-outreach/SKILL.md`
- Read: `skills/networking-outreach/message-rules.md`

Run the skill end-to-end to verify it works. Use a company from
seen-postings that already has research.

- [ ] **Step 1: Invoke the skill with a cold outreach target**

Run: `/networking-outreach cold to Help Scout`

Help Scout is in seen-postings (2026-04-08) with a ⭐⭐⭐⭐ rating and should
have research context available.

- [ ] **Step 2: Verify each phase executes**

Check that:
- Phase 0: Preflight passes, Gmail profile prints
- Phase 1: Detects `cold` type, extracts `Help Scout` as company
- Phase 2: Finds existing research or runs lightweight WebSearch pass
- Phase 3: Generates full message + LinkedIn short version
- Phase 4: Presents drafts, prompts for confirmation
- Phase 5: Appends to outreach-log after confirmation

- [ ] **Step 3: Verify quality gate**

Check the generated message against message-rules.md quality gate:
- Contains at least one specific number
- Hook references something real about Help Scout
- Ask is low-friction and async-answerable
- No banned phrases
- LinkedIn version under 300 characters

- [ ] **Step 4: Verify delivery**

- Gmail draft was created (check `bun scripts/gmail.js search "subject:Help Scout" --max 1`)
- LinkedIn version was copied to clipboard (paste to verify)

- [ ] **Step 5: Verify state update**

Read the outreach-log file:

```bash
cat output/*-outreach-log.md
```

Confirm an entry was appended with today's date, "Help Scout", "cold" type.

- [ ] **Step 6: Commit test artifacts (if any)**

If a new `output/*-outreach-log.md` was created, it's gitignored (output/
is gitignored). No commit needed for state files.

---

### Task 5: End-to-end test — warm intro

- [ ] **Step 1: Invoke the skill with a warm intro**

Run: `/networking-outreach warm intro via Sarah Chen to VP Eng at Natera`

Natera is in seen-postings (2026-04-08) with research, resume, and cover
letter already generated.

- [ ] **Step 2: Verify warm-intro-specific behavior**

Check that:
- Phase 1: Detects `warm-intro` type, extracts connector "Sarah Chen",
  target "VP Eng", company "Natera"
- Phase 3: Generates three outputs — message to connector, LinkedIn short,
  and forwardable blurb
- Phase 4: Presents all three, asks which to clipboard
- Forwardable blurb is self-contained (makes sense without the surrounding
  message)

- [ ] **Step 3: Verify dedup check**

Run the same command again. Phase 2 should warn:
> "You reached out to Natera (warm-intro) on {today}. Draft another anyway?"

---

### Task 6: End-to-end test — recruiter outreach

- [ ] **Step 1: Invoke the skill with recruiter type**

Run: `/networking-outreach recruiter at True Search`

- [ ] **Step 2: Verify recruiter-specific behavior**

Check that:
- Phase 1: Detects `recruiter` type, extracts "True Search"
- Phase 3: Message leads with positioning (scope, team size, domain),
  not with a company-specific hook
- Quality gate: Contains specific numbers, no banned phrases

- [ ] **Step 3: Commit**

No code changes expected. If any skill file needed fixing during testing,
commit the fixes:

```bash
git add skills/networking-outreach/
git commit -m "fix(networking-outreach): address issues found in end-to-end testing"
```
