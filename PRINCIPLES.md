# Principles

These principles govern all skills, agents, scripts, and outputs in the
job-seeker plugin. Every session should internalize these before producing
any deliverable.

---

## Engineering Principles (Read First)

These rules apply to all code, specs, tests, and AI-assisted work in this
repository. Use them as a checklist, not a suggestion list.

### 1. Specification First

All features MUST have a specification in `integrations/specs/` before
implementation begins. Specs define the problem, the solution, and the test
plan. No code ships without a spec to trace it back to.

### 2. Test First

All features MUST have a valid passing test before being considered complete.
Tests go in `tests/`. Manual test protocols go in `integrations/docs/`.
If the feature cannot be unit-tested (e.g., AppleScript), a documented manual
test protocol with explicit pass/fail criteria is required.

### 3. DRY and SOLID

Implementation MUST follow DRY (Don't Repeat Yourself) and SOLID principles.

**DRY in this repo:**
- Config values live in `integrations/config/`. Skills and scripts read them;
  they do not hardcode values.
- Candidate profile lives in `CLAUDE.md`. Skills reference it; they do not
  duplicate it.
- Script paths are resolved via `plugin_root` from config — never hardcoded.

**SOLID in this repo:**
- Single Responsibility: each script does one thing. Each skill owns one
  workflow.
- Open/Closed: adapters are swappable without changing skills.
- Dependency Inversion: skills describe *what* to do; scripts handle *how*.

### 4. Structure Compliance

Code MUST be organized according to the project `STRUCTURE.md` guide.
When adding a new file, check the decision tree there first. Do not create
files at the repo root or in ad-hoc directories.

### 5. Deviation Requires Approval

ANY deviations from these rules MUST be validated by the user before
proceeding. This includes architectural changes, new dependencies, and
any departure from the eisenhower-proven plugin patterns.

### 6. Iterative Commits

Work MUST be done in small iterative batches. Commit after each logical
unit of work. Show `git diff --stat` and confirm before every commit.

### 7. PR Merge Gate

All manual test steps listed in the PR description MUST be completed and
confirmed before a PR is merged. No checklist item may be left unchecked
at merge time.

---

## Human Sign-Off Before Commit

Claude never commits code without explicit engineer approval. After
completing any unit of work, Claude stops and presents what changed.
The engineer reviews and gives explicit sign-off before any `git commit`
is run.

---

## Native App Integration Pattern

**This is a hard rule based on the proven eisenhower plugin architecture.**

All macOS native app integration (Apple Notes, Calendar, Reminders, Mail)
MUST use direct AppleScript or Swift scripts called from skill instructions.

**Never:**
- Build an MCP server to wrap native app access
- Create background daemons or protocol layers
- Invent abstractions that don't exist in the working reference

**Always:**
- Put executable scripts in `scripts/`
- Put adapter docs (field mapping, error handling, invocation syntax) in
  `integrations/adapters/`
- Put config (plugin_root, folder names, account names) in
  `integrations/config/` with `.example` templates committed
- Reference scripts from skills using `plugin_root` from config

This pattern is proven across eisenhower's Calendar (Swift/EventKit),
Reminders (AppleScript), and Mail (AppleScript) integrations. Follow it
exactly.

---

## Authenticity Over Polish

Every output must sound like Chris — a friendly pragmatist who teaches
rather than performs, uses dry humor, and leads with specifics over
abstractions. If a cover letter or "why this company" response could
have been written by anyone, it's wrong.

**Voice rules (see `references/voice-guide.md` for full calibration):**
- **Teach, don't perform.** Frame results as "here's what we did and learned,"
  not "here's how impressive I am."
- **"We" over "I"** for team accomplishments. "I" for personal decisions.
- **Concrete before abstract.** Number first, meaning second.
- **Name problems plainly.** If a pipeline was broken, say it was broken.
- **Dry, understated humor.** Levity in labels and asides, not extended jokes.
- **No buzzwords.** No "synergy," "leverage," "uniquely positioned," or
  "passionate about driving organizational excellence."

**Test:** Read the output aloud. If it sounds like a LinkedIn influencer,
a career coach, or someone performing confidence — rewrite it. Chris is
warm and direct. He shares the how generously. He doesn't linger on
self-congratulation.

---

## Mission Alignment Is Not Performative

When explaining why Chris is interested in a company, never fabricate passion.
Connect genuine threads from his actual career to the company's mission.
Babylon Health (healthcare access), Vrbo (travel experiences), Procore
(construction technology) — these are real mission-driven choices. If the
connection is thin, say so honestly rather than manufacturing enthusiasm.

---

## Quantify Everything

Chris's resume speaks in numbers: $18M+ business value, 95-99% CI/CD
reliability, 20x release velocity, 85% adoption across 185 repos. Every
skill output should mirror this discipline. Vague claims like "improved
team performance" are unacceptable when "reduced deployment cycle from
6 months to minutes" is available.

---

## Respect the Level

Chris is interviewing for Senior Director and VP roles. Every output should
reflect executive-level communication: strategic framing, business impact
language, and organizational thinking. Don't write like a senior engineer
applying for a staff role. Write like a leader who partners with VPs and
shapes company direction.

---

## Privacy First

- Never include Chris's current compensation in any external-facing document
- Never mention that he is actively job searching in any output that could
  be shared externally (networking messages should be framed appropriately)
- Personal contact information only appears where explicitly needed
- Memory files containing application history and preferences are private
- Config files with personal values are gitignored; only `.example` templates
  are committed

---

## Output Directory

All generated deliverables — resumes, cover letters, PDFs, research docs, and any
other files produced for Chris — must be saved to the `output/` directory, not the
project root. Use subdirectories as needed (e.g., `output/resumes/`, `output/cover-letters/`).

The project root is for configuration, skills, and references. Deliverables go in `output/`.

---

## Digests Go to Apple Notes

The daily digest MUST be written to Apple Notes via the `apple_notes_create.applescript`
script. Saving as an HTML file is a fallback only if the script call fails.

**Required behavior:**
1. Always attempt `osascript {plugin_root}/scripts/apple_notes_create.applescript ...` first
2. If the script fails, save to `output/digest-{date}.html`
   AND tell Chris the exact error message
3. Never silently fall back to HTML without surfacing the failure

The digest exists to be read on the phone, not in a browser. Apple Notes is the
delivery channel. Everything else is a workaround.

---

## State Continuity

Every skill should read relevant state before acting and write state after completing.
The Apple Notes memory layer (`Seen Postings`, `Preferences`, `Applications`) is the
source of truth. Local `memory/` files are a convenience mirror, not authoritative.

Never show Chris a role he's already seen. Never ask him for information
that's already stored. Respect his time — he's doing this while holding down
a demanding Director role.

---

## One Voice, Multiple Formats

Whether it's a cover letter, a "why this company" response, or an interview
prep doc, the voice should be consistent: friendly, pragmatic, specific,
and lightly funny without trying to be funny. Chris is someone who fixes
broken things and builds scalable systems — and explains how he did it
in a way that's generous and plain-spoken. That identity carries through
every artifact.

**Anti-patterns to avoid in all outputs:**
- Career coach voice: "I'm passionate about driving organizational excellence"
- LinkedIn influencer: "Here's what most leaders get wrong about scaling"
- Corporate: "I'm uniquely positioned to leverage my experience"
- Performative humility: "I've been fortunate enough to lead..."
