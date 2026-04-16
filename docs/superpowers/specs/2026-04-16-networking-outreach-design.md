# Networking Outreach Skill — Design Spec

**Date:** 2026-04-16
**Status:** Draft
**Issue:** N/A (new skill, replacing stub)

---

## Problem

The job market for remote VP/Senior Director of Engineering roles is thin.
Job board discovery (TheirStack, daily digest, email scan) produces
diminishing returns — most roles at this level are filled through networks
before they hit boards. The candidate needs a skill that drafts personalized
outreach messages to engineering leaders, mutual connections, and executive
recruiters, calibrated to the candidate's voice and backed by company
research.

## Approach

Single-skill orchestrator (`SKILL.md`) with a companion reference file
(`message-rules.md`) for per-type message structures, banned phrases, and
examples. Follows the same phase-based pattern as follow-up, cover-letter,
and other existing skills.

Three message types, prioritized by expected conversion:

1. **Warm intro requests** — highest leverage, referral-driven
2. **Executive recruiter outreach** — surfaces unlisted VP+ roles
3. **Cold outreach** — lowest response rate but only option without a path in

Delivery: Gmail drafts (via existing `scripts/gmail.js`) + clipboard for
LinkedIn paste. Light state tracking via a new outreach log file. No
auto-sending. No application pipeline mutations.

---

## Invocation & Input Parsing

### Invocation patterns

```
/networking-outreach Natera
/networking-outreach warm intro via Sarah Chen to VP Eng at Natera
/networking-outreach recruiter at True Search
/networking-outreach cold to CTO at Help Scout
```

### Parsing rules

1. Args contain "warm intro" or "via {name}" → **warm-intro** type
2. Args contain "recruiter" → **recruiter** type
3. Args contain "cold" → **cold** type
4. Only a company name → prompt: "What type of outreach? Cold, warm intro,
   or recruiter?"

### Extracted fields

| Field | Required | Source |
|-------|----------|--------|
| `company` | Always | Parsed from args or prompted |
| `message_type` | Always | cold, warm-intro, or recruiter |
| `connector_name` | warm-intro only | Parsed from "via {name}" or prompted |
| `target_person` | Optional | Parsed from args or prompted |
| `context` | Optional | Freeform (e.g., "met at QCon", "saw their blog post") |

If insufficient info is provided, the skill asks follow-up questions one at
a time — not a form dump.

---

## Phases

### Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Verify Gmail API credentials:

```bash
bun scripts/gmail.js profile
```

If unauthenticated, stop with guidance (same as follow-up skill).

Additionally:
- Read `references/voice-guide.md` for tone calibration
- Glob `references/writing-samples/*.md` — if any exist, read to calibrate
- Read `skills/networking-outreach/message-rules.md` for per-type rules

### Phase 1 — Input Parsing

Parse `$ARGUMENTS` per the rules above. If message type cannot be detected,
ask one question. If company is missing, ask. If warm-intro type and no
connector name, ask.

### Phase 2 — Research

**Dedup check first:** Read outreach log (`output/*-outreach-log.md` via
`skills/_shared/state-io.md`). If the same company + message type exists
within the last 14 days, warn: "You already reached out to {company} on
{date}. Draft another anyway?" Proceed only on confirmation.

**Company context (reuse-first):**

1. Check `output/{company-slug}/company-research.md` — if exists and < 7
   days old, use its Positioning and Mission sections
2. Check for other materials in `output/{company-slug}/` (cover letter,
   why-this-company) — pull positioning hooks from any that exist
3. If no research exists or is stale, run lightweight pass — 3 parallel
   WebSearches:
   - `{company} mission engineering culture`
   - `{company} funding round employees size`
   - `{company} recent news engineering blog`
   - Extract: mission/product, company size, funding stage, 1-2 recent
     signals (launch, funding, blog post, conference talk)

**Accomplishment mapping:** From research, identify 1-2 strongest
connections between candidate's accomplishments (`config/candidate.md`) and
the company's challenges/stage. This becomes the message "bridge" —
compressed to a single sentence.

**Target person research (if provided):** One WebSearch:
`{person_name} {company} LinkedIn`. Extract: title, tenure, recent
publications or talks. Personalizes the hook.

Research output is ephemeral (not written to disk).

### Phase 3 — Generate

Read `skills/networking-outreach/message-rules.md` for the active message
type's structure, banned phrases, and quality gate.

Generate two variants:

1. **Full message** — email/InMail length (3-6 sentences depending on type)
2. **LinkedIn connection request** — under 300 characters, same hook
   compressed

For **warm-intro** type, also generate:

3. **Forwardable blurb** — 2-3 sentence self-contained intro the connector
   can copy-paste

Apply quality gate from message-rules.md before presenting.

### Phase 4 — Review & Deliver

Present the draft(s) to the user. Include:
- The full message
- The LinkedIn short version with character count
- For warm-intro: the forwardable blurb

Ask: "Send as Gmail draft and copy LinkedIn version to clipboard? [y/N/edit]"

On confirmation:

1. Write message body to a temp file, then create Gmail draft via
   `bun scripts/gmail.js create-draft --subject "{subject}" --body-file /tmp/outreach-body.txt`
   (add `--to "{email}"` if recipient email is known)
2. Copy LinkedIn version to clipboard via `pbcopy`
3. Announce: "Gmail draft created. LinkedIn version copied to clipboard ({N} chars)."

For warm-intro: ask which to clipboard — the message to the connector or the
forwardable blurb. Default to the forwardable blurb (the connector is more
likely to need it immediately).

### Phase 5 — State Update

Append to `output/*-outreach-log.md` (create with today's date prefix if
none exists):

```markdown
## YYYY-MM-DD
- {Company} | {Type} | {Target Person} | {Connector} | {Channel} | sent:YYYY-MM-DD
```

Follow `skills/_shared/state-io.md` append pattern with frontmatter.

---

## File Structure

```
skills/
  networking-outreach/
    SKILL.md              # Orchestrator: phases 0-5 (~200 lines)
    message-rules.md      # Per-type structures, banned phrases, examples, quality gate
```

### SKILL.md frontmatter

```yaml
name: networking-outreach
description: >
  Draft personalized outreach messages for target companies and contacts.
  Use when reaching out to engineering leaders, requesting warm introductions,
  or building recruiter relationships during a job search.
allowed-tools: Read, Write, Edit, Bash, Glob, WebSearch, WebFetch
```

### Shared modules reused

| Module | Purpose |
|--------|---------|
| `skills/_shared/preflight.md` | Config validation + core file reads |
| `skills/_shared/state-io.md` | Read/append pattern for outreach-log |
| `references/voice-guide.md` | Tone calibration |
| `config/candidate.md` | Accomplishment source |
| `config/search.md` | Target titles, company preferences |

### New artifacts

| Artifact | Purpose |
|----------|---------|
| `skills/networking-outreach/SKILL.md` | Orchestrator (replaces stub) |
| `skills/networking-outreach/message-rules.md` | Message type rules + examples |
| `output/*-outreach-log.md` | Outreach state (dedup, cadence tracking) |

The existing `.claude/commands/networking-outreach.md` needs no changes — it
already routes to the skill.

---

## message-rules.md — Companion Reference

### Cold Outreach (2-3 sentences, under 150 chars for connection request)

1. **Hook** — reference something specific and recent about the recipient or
   their company (not generic flattery)
2. **Bridge** — one sentence connecting your experience to their context
3. **Ask** — low-friction, async-answerable question (not "can we hop on a
   call")

### Warm Intro Request (to the connector, 3-4 sentences + forwardable blurb)

1. **Context** — why you're reaching out to this specific connector
2. **Who + Why** — who you want to meet and what you'd discuss (specific,
   not "just to network")
3. **Forwardable blurb** — 2-3 sentence self-contained intro the connector
   can copy-paste. Includes name, what you do, and why you're relevant to
   the target
4. **Easy out** — "No pressure if the timing isn't right"

### Recruiter Outreach (3-4 sentences)

1. **Positioning** — niche + scope upfront (team size, budget, domain) —
   recruiters pattern-match on this
2. **What you're looking for** — target titles, company type, remote/Austin
3. **Signal** — one specific accomplishment that demonstrates the level
4. **Availability** — "Open to a conversation if you're filling roles in
   this space"

### Banned Phrases

Inherited from follow-up skill, extended:

- "just checking in", "circling back", "touching base"
- "I'm passionate about", "uniquely positioned", "leverage"
- "I'd love to pick your brain", "I'd love to connect and learn from you"
- "I've been following your company for a while"
- "I've been fortunate enough to lead..."
- Generic flattery: "I'm really impressed by what you're building"

### Quality Gate

Before presenting any draft, verify:

1. Would the candidate say this naturally in conversation?
2. Does it contain at least one specific number?
3. Is the hook grounded in something real about the recipient or company?
4. Is the ask low-friction and async-answerable?
5. No banned phrases present?
6. LinkedIn version under 300 characters?

---

## What This Skill Does NOT Do

- **No auto-sending** — always drafts for review
- **No application pipeline changes** — outreach log is separate from
  applications.md
- **No contact database** — names and emails are ephemeral per invocation
- **No LinkedIn browser automation** — clipboard only
- **No follow-up cadence automation in v1** — the outreach log enables
  future follow-up detection but v1 only warns on duplicates

---

## Future Enhancements (Not in v1)

- Follow-up cadence: "You reached out to X 10 days ago, no response —
  draft follow-up?" (read from outreach log)
- Effectiveness tracking: response rates per message type
- Batch mode: draft outreach for multiple companies in one invocation
- Recruiter CRM: track which firms/recruiters you've engaged with
