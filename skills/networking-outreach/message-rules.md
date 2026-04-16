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
