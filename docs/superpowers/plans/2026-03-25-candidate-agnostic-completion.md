# Candidate-Agnostic Config — Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the candidate-agnostic migration by flipping the state layer framing (output/ = primary, Apple Notes = optional) and replacing all hardcoded "Chris" references with config-driven values across skill files and docs.

**Architecture:** Config infrastructure is already in place (`config/candidate.md`, `config/search.md`, `scripts/validate-config.js`). This plan covers the remaining text changes to docs, skill files, and directory cleanup.

**Tech Stack:** Markdown (all files), Node.js (validate-config.js), fish shell

**Prior work:** The 2026-03-14 plan created config files, .gitignore entries, validate-config.js, writing-samples/README.md, and added config reads to all skill "Before You Start" sections. This plan covers what that plan left unfinished.

---

## Task 1: Update PRINCIPLES.md — State Continuity + Filename Convention

**Files:**
- Modify: `PRINCIPLES.md:29-47` (Output Directory section)
- Modify: `PRINCIPLES.md:50-70` (State Continuity section)

- [ ] **Step 1: Update the Output Directory filename convention**

In `PRINCIPLES.md`, find the Output Directory section (lines 29–47). Replace the hardcoded filename convention with a config-driven pattern.

Change:
```markdown
- Filename convention: `Christopher_Cantu_{ArtifactType}_{Company}.{ext}`
```

To:
```markdown
- Filename convention: `{Name}_{ArtifactType}_{Company}.{ext}` — where `{Name}` is
  the candidate's name from `config/candidate.md` with spaces replaced by underscores
```

Also update the example tree to use placeholders:
```markdown
output/
  natera/
    {Name}_Resume_Natera.md
    {Name}_Resume_Natera.docx
    {Name}_CoverLetter_Natera.md
    {Name}_CoverLetter_Natera.docx
    why-this-company-natera.md
```

- [ ] **Step 2: Flip the State Continuity section**

Replace the entire State Continuity section (lines 50–70) with:

```markdown
## State Continuity

`output/` markdown files are the source of truth for state that persists across
sessions (seen postings, preferences, applications). Skills read the most recent
`output/*-{state-type}.md` file via glob before acting and append to it after
completing. If no file exists, create one with today's date prefix:
`output/YYYY-MM-DD-{state-type}.md`.

Apple Notes is an optional personal integration — `daily-digest` writes there
as a secondary layer when `integrations/config/notes-config.md` is configured,
but it is not required for the plugin to function. New users: see
`integrations/adapters/apple-notes.md` to enable it.

State files live at the `output/` root. Per-company artifacts (cover letters,
resumes) live in `output/{company-slug}/`. Both patterns coexist with no conflict.

Every skill reads relevant state before acting and writes state after completing.
Never show a role that's already been seen. Never ask for information that's
already stored. Respect the candidate's time.
```

- [ ] **Step 3: Verify the edit**

Run: `grep -n "Apple Notes is the default" PRINCIPLES.md`
Expected: No output (the old phrasing is gone).

Run: `grep -n "source of truth" PRINCIPLES.md`
Expected: Shows the new line: `output/` markdown files are the source of truth...

- [ ] **Step 4: Commit**

```
git add PRINCIPLES.md
git commit -m "refactor: flip State Continuity — output/ is primary, Apple Notes optional"
```

---

## Task 2: Update STRUCTURE.md — Remove memory/, Update State References

**Files:**
- Modify: `STRUCTURE.md:25-80` (Directory Map)
- Modify: `STRUCTURE.md:140-170` (File Placement + Committed table)

- [ ] **Step 1: Remove memory/ from the directory map**

In `STRUCTURE.md`, find the directory map (lines 25–80). Remove the memory/ entry:

```markdown
└── memory/                  ← Runtime state mirrors (gitignored)
    └── job-search/          ← Source of truth is Apple Notes
        ├── seen-postings.md
        └── preferences.md
```

And update the output/ entry to include state files:

```markdown
├── output/                  ← Generated materials + state files (gitignored)
│   ├── YYYY-MM-DD-seen-postings.md    ← Dedup log (state)
│   ├── YYYY-MM-DD-preferences.md      ← Source effectiveness (state)
│   ├── YYYY-MM-DD-applications.md     ← Pipeline tracker (state)
│   └── {company-name}/
│       ├── why-this-company.md
│       ├── cover-letter-{date}.md
│       └── ...
```

- [ ] **Step 2: Update File Placement Decision Tree**

Change line 150:
```markdown
9. **Is it runtime state?** → `memory/` (and mirrored in Apple Notes)
```

To:
```markdown
9. **Is it runtime state?** → `output/` as a date-prefixed markdown file
```

- [ ] **Step 3: Update the Committed table**

Change the memory/ row (line 170):
```markdown
| memory/ (seen postings, preferences) | No | Runtime state |
```

To:
```markdown
| output/ state files (seen-postings, preferences, applications) | No | Runtime state, gitignored with output/ |
```

Remove the old memory/ row entirely.

- [ ] **Step 4: Update .gitignore comment**

In `.gitignore`, change lines 3-5:

```
# State mirrors (source of truth is Apple Notes)
memory/
```

To:

```
# Legacy state directory (deprecated — state lives in output/)
memory/
```

- [ ] **Step 5: Verify**

Run: `grep -n "memory/" STRUCTURE.md`
Expected: No output (all memory/ references removed).

- [ ] **Step 6: Commit**

```
git add STRUCTURE.md .gitignore
git commit -m "refactor: remove memory/ from structure, update state references to output/"
```

---

## Task 3: Update CLAUDE.md — Remove Hardcoded Names

**Files:**
- Modify: `CLAUDE.md:1-46`

- [ ] **Step 1: Make the Purpose section candidate-agnostic**

Change lines 5-8:

```markdown
This plugin is a job search platform for Chris Cantu, an Engineering Director
seeking Senior Director / VP of Engineering roles at mission-driven, growth-stage
or midsize companies. It automates and assists with every phase of the executive
job search lifecycle.
```

To:

```markdown
This plugin automates and assists with every phase of an executive job search
lifecycle — from role discovery through offer negotiation. It is designed for
engineering leaders seeking Senior Director / VP of Engineering roles at
mission-driven, growth-stage or midsize companies. See `config/candidate.md`
for the current candidate's profile.
```

- [ ] **Step 2: Update the Apple Notes reference**

Change line 43-45:

```markdown
Apple Notes integration is Chris's personal layer — `daily-digest` also writes
there when `integrations/config/notes-config.md` is present. See
`integrations/adapters/apple-notes.md` to enable it as a new user.
```

To:

```markdown
Apple Notes is an optional personal integration — `daily-digest` also writes
there when `integrations/config/notes-config.md` is present. It is not required
for the plugin to function. See `integrations/adapters/apple-notes.md` to enable it.
```

- [ ] **Step 3: Verify**

Run: `grep -n "Chris" CLAUDE.md`
Expected: No output.

- [ ] **Step 4: Commit**

```
git add CLAUDE.md
git commit -m "refactor: make CLAUDE.md candidate-agnostic"
```

---

## Task 4: Update daily-digest SKILL.md — Flip State Layer

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

This is the largest change. The daily-digest currently treats Apple Notes as
primary and output/ as fallback. We flip this: output/ is primary, Apple Notes
is optional secondary.

- [ ] **Step 1: Update frontmatter description**

Change lines 4-9 (the description field):

```yaml
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest via Apple Notes. Trigger with
  "run my job digest", "check for new roles", "any new jobs today", or
  "job search update". Runs in Claude Code on macOS — osascript is called
  directly via Bash to read and write Apple Notes natively.
  State is persisted in Apple Notes.
```

To:

```yaml
description: >
  Search executive job boards for Senior Director/VP Engineering roles
  and deliver a filtered, deduplicated digest. Trigger with "run my job
  digest", "check for new roles", "any new jobs today", or "job search
  update". State is persisted in output/ markdown files. When Apple Notes
  is configured, the digest is also written there for a native reading
  experience.
```

- [ ] **Step 2: Update the intro paragraph**

Change lines 15-16:

```markdown
Searches executive job boards, filters against Chris's criteria, deduplicates
against previously seen postings, and writes a formatted Apple Note.
```

To:

```markdown
Searches executive job boards, filters against the candidate's criteria,
deduplicates against previously seen postings, and writes the digest to
`output/` (plus Apple Notes when configured).
```

- [ ] **Step 3: Replace "Chris" references in template and fallback**

Change line 322:
```html
<div><b><span style="font-size: 11px">Why this fits:</span></b><span style="font-size: 11px"> {1-2 sentences tied to Chris's specific background}</span></div>
```

To:
```html
<div><b><span style="font-size: 11px">Why this fits:</span></b><span style="font-size: 11px"> {1-2 sentences tied to the candidate's specific background}</span></div>
```

Change line 369:
```markdown
3. Tell Chris:
```

To:
```markdown
3. Tell the user:
```

Change line 373:
```markdown
The HTML fallback exists so Chris can review results in a browser. Apple Notes
is the intended delivery channel — everything else is a workaround.
```

To:
```markdown
The HTML fallback exists so the user can review results in a browser when
Apple Notes is not configured or the write fails.
```

- [ ] **Step 4: Flip the State Updates section**

Replace the entire "## State Updates" section (lines 378–422) with:

```markdown
## State Updates

After the digest is written:

### Primary state — output/ files

Always write to `output/` files. This is the primary state layer.

1. Glob `output/*-seen-postings.md`, sort descending. If a file exists, append
   new role entries to it. If no file exists, create `output/YYYY-MM-DD-seen-postings.md`
   (use today's date).

   Entry format:
   ```
   ## YYYY-MM-DD
   - {Company} | {Title} | {URL}
   ```

2. Glob `output/*-preferences.md`, sort descending. If a file exists, append
   updated source effectiveness counts. If no file exists, create
   `output/YYYY-MM-DD-preferences.md`.

   Entry format:
   ```
   ## YYYY-MM-DD
   ### Source Effectiveness
   - {Source}: {N} relevant roles found
   ```

### Optional — Apple Notes (secondary)

If `integrations/config/notes-config.md` exists, also write state to Apple Notes
as a secondary layer for native reading on macOS/iOS.

Read `plugin_root`, `default_folder`, and `Apple Notes Prefix` (from
`config/search.md`, default: `Job Search`).

Construct note names using the prefix:
- `{prefix} - Seen Postings`
- `{prefix} - Preferences`

Run `apple_notes_update.applescript` for each note. Check return values;
if either starts with `error:`, log to `output/error-{date}.log` and warn
the user. Apple Notes sync errors are **non-blocking** — the output/ files
are already written and are the source of truth.
```

- [ ] **Step 5: Rename the Output section header**

Change line 290:
```markdown
## Output — Write to Apple Notes
```

To:
```markdown
## Output — Write Digest
```

Then add a note after the HTML template section (after line 354, before the
fallback section) clarifying the write order:

```markdown
### Write Order

1. **Always** write the digest HTML to `output/digest-{date}.html` first
2. **If** `integrations/config/notes-config.md` exists, also write to Apple Notes
   using the create script. Verify the return value starts with `success:`.
   If it starts with `error:`, follow the fallback procedure below.
3. If Apple Notes is not configured, skip step 2 — the HTML file is the
   deliverable.
```

And update the fallback section header (line 363) from:
```markdown
## Fallback — If Apple Notes Write Fails
```

To:
```markdown
## Error Handling — Apple Notes Write Failure
```

- [ ] **Step 6: Verify**

Run: `grep -n "Chris" skills/daily-digest/SKILL.md`
Expected: No output.

Run: `grep -n "Primary state — Apple Notes" skills/daily-digest/SKILL.md`
Expected: No output.

- [ ] **Step 7: Commit**

```
git add skills/daily-digest/SKILL.md
git commit -m "refactor: daily-digest — output/ primary, Apple Notes optional secondary"
```

---

## Task 5: Update cover-letter SKILL.md — Remove Hardcoded Names

**Files:**
- Modify: `skills/cover-letter/SKILL.md`

- [ ] **Step 1: Update frontmatter description**

Change lines 5-10:

```yaml
description: >
  Generate a tailored cover letter for a specific company and role.
  Use this skill when Chris asks for a "cover letter", "write a cover
  letter for [company]", "application letter", or any request to create
  a formal letter accompanying a job application. Also use when Chris
  says "apply to [company]" and a cover letter is part of the process.
  This skill produces a professional .docx cover letter (plus a .md source)
  that maps Chris's specific accomplishments to the role requirements.
```

To:

```yaml
description: >
  Generate a tailored cover letter for a specific company and role.
  Triggers: "cover letter", "write a cover letter for [company]",
  "application letter", "apply to [company]". Produces a professional
  .docx cover letter (plus .md source) that maps the candidate's specific
  accomplishments to the role requirements.
```

- [ ] **Step 2: Update body text — replace all "Chris" references**

Make these replacements throughout the file (use replace-all where the string
is unique enough):

| Old | New |
|-----|-----|
| `maps Chris's specific accomplishments` | `maps the candidate's specific accomplishments` |
| `could only have been written by Chris for` | `could only have been written for` |
| `Chris may want to highlight` | `the candidate may want to highlight` |
| `match Chris's experience` | `match the candidate's experience` |
| `Map Chris's experience to role requirements` | `Map the candidate's experience to role requirements` |
| `Chris's specific accomplishment` | `the candidate's specific accomplishment` |
| `What Chris will bring` | `What the candidate will bring` |
| `Would Chris be comfortable` | `Would the candidate be comfortable` |

- [ ] **Step 3: Update output filenames to use config-driven name**

Change lines 91-96:

```markdown
1. Write the cover letter source:
   ```
   output/{company-slug}/Christopher_Cantu_CoverLetter_{Company}.md
   ```
2. Generate a .docx by invoking the `anthropic-skills:docx` skill, saving to:
   ```
   output/{company-slug}/Christopher_Cantu_CoverLetter_{Company}.docx
   ```
```

To:

```markdown
1. Write the cover letter source:
   ```
   output/{company-slug}/{Name}_CoverLetter_{Company}.md
   ```
   Where `{Name}` is from `config/candidate.md` with spaces replaced by underscores.
2. Generate a .docx by invoking the `anthropic-skills:docx` skill, saving to:
   ```
   output/{company-slug}/{Name}_CoverLetter_{Company}.docx
   ```
```

- [ ] **Step 4: Verify**

Run: `grep -n "Chris" skills/cover-letter/SKILL.md`
Expected: No output.

- [ ] **Step 5: Commit**

```
git add skills/cover-letter/SKILL.md
git commit -m "refactor: cover-letter — replace hardcoded names with config references"
```

---

## Task 6: Update Remaining Skill Files — Replace "Chris" References

**Files:**
- Modify: `skills/resume-tailor/SKILL.md`
- Modify: `skills/company-research/SKILL.md`
- Modify: `skills/interview-prep/SKILL.md`
- Modify: `skills/networking-outreach/SKILL.md`
- Modify: `skills/application-tracker/SKILL.md`
- Modify: `skills/why-this-company/SKILL.md`

- [ ] **Step 1: resume-tailor/SKILL.md**

Change line 10:
```markdown
Customizes Chris's resume for a specific job posting by reordering bullets,
```
To:
```markdown
Customizes the candidate's resume for a specific job posting by reordering bullets,
```

Change lines 32-33 (output paths):
```
     output/{company-slug}/Christopher_Cantu_Resume_{Company}.md \
     output/{company-slug}/Christopher_Cantu_Resume_{Company}.docx
```
To:
```
     output/{company-slug}/{Name}_Resume_{Company}.md \
     output/{company-slug}/{Name}_Resume_{Company}.docx
```

Add a note after: `Where {Name} is from config/candidate.md with spaces replaced by underscores.`

- [ ] **Step 2: company-research/SKILL.md**

Change line 27:
```markdown
3. Map company challenges to Chris's strengths
```
To:
```markdown
3. Map company challenges to the candidate's strengths
```

- [ ] **Step 3: interview-prep/SKILL.md**

Change line 10:
```markdown
Prepares Chris for behavioral and technical interviews by mapping his
```
To:
```markdown
Prepares the candidate for behavioral and technical interviews by mapping their
```

Change line 28:
```markdown
3. Map each question to Chris's strongest STAR stories
```
To:
```markdown
3. Map each question to the candidate's strongest STAR stories
```

- [ ] **Step 4: networking-outreach/SKILL.md**

Change line 28:
```markdown
3. Draft a concise, authentic message in Chris's voice
```
To:
```markdown
3. Draft a concise, authentic message in the candidate's voice
```

- [ ] **Step 5: application-tracker/SKILL.md**

Change line 72:
```markdown
- `declined` — Chris declined the offer
```
To:
```markdown
- `declined` — Candidate declined the offer
```

Change line 74:
```markdown
- `withdrawn` — Chris withdrew the application
```
To:
```markdown
- `withdrawn` — Candidate withdrew the application
```

Change line 251:
```markdown
Apple Notes sync errors are **non-blocking** — surface the error to Chris, then
```
To:
```markdown
Apple Notes sync errors are **non-blocking** — surface the error to the user, then
```

- [ ] **Step 6: why-this-company/SKILL.md**

This skill has no hardcoded "Chris" references in the body text (it uses
"the candidate" throughout). No changes needed. Verify:

Run: `grep -n "Chris" skills/why-this-company/SKILL.md`
Expected: No output.

- [ ] **Step 7: Verify all skills are clean**

Run: `grep -rn "Chris" skills/ --include="*.md" | grep -v "Christopher" | grep -v "{Name}"`
Expected: No output (no remaining hardcoded "Chris" references except
`Christopher` in filename patterns which are now `{Name}`).

Note: `Christopher` in old filename patterns should also be gone. Run:
`grep -rn "Christopher_Cantu" skills/ --include="*.md"`
Expected: No output.

- [ ] **Step 8: Commit**

```
git add skills/resume-tailor/SKILL.md skills/company-research/SKILL.md skills/interview-prep/SKILL.md skills/networking-outreach/SKILL.md skills/application-tracker/SKILL.md
git commit -m "refactor: replace hardcoded Chris references with candidate/config in all skills"
```

---

## Task 7: Delete memory/job-search/ Directory

**Files:**
- Delete: `memory/job-search/seen-postings.md`
- Delete: `memory/job-search/preferences.md`
- Delete: `memory/job-search/` (directory)
- Delete: `memory/` (directory, if empty)

- [ ] **Step 1: Verify the directory is gitignored**

Run: `git status memory/`
Expected: Nothing tracked — the entire directory is gitignored.

- [ ] **Step 2: Delete the directory**

Run: `rm -rf memory/job-search/`

Then check if memory/ is empty:
Run: `ls memory/ 2>/dev/null`
If empty, run: `rmdir memory/`

- [ ] **Step 3: Verify**

Run: `ls memory/ 2>/dev/null`
Expected: No output (directory gone) or "No such file or directory".

No commit needed — these files were gitignored and never tracked.

---

## Task 8: Update Spec Status

**Files:**
- Modify: `integrations/specs/candidate-agnostic-config-spec.md:3`

- [ ] **Step 1: Update the status line**

Change line 3:
```markdown
**Status**: Approved — pending implementation
```

To:
```markdown
**Status**: Implemented — shipped in feature/candidate-agnostic-config branch
```

- [ ] **Step 2: Commit**

```
git add integrations/specs/candidate-agnostic-config-spec.md
git commit -m "docs: mark candidate-agnostic-config spec as implemented"
```

---

## Task 9: Validate and Verify

- [ ] **Step 1: Run validate-config.js**

Run: `node scripts/validate-config.js`
Expected: `✓ Config valid` (both config files exist and have required fields).

- [ ] **Step 2: Grep for remaining hardcoded references**

Run: `grep -rn "Chris" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers | grep -v config/ | grep -v integrations/specs/ | grep -v integrations/docs/ | grep -v ROADMAP.md | grep -v integrations/adapters/`

Expected: No output from skill files, CLAUDE.md, PRINCIPLES.md, or STRUCTURE.md.

Note: `ROADMAP.md`, `integrations/adapters/`, `integrations/docs/`, and
`docs/superpowers/` specs/plans may still reference "Chris" in historical
context — this is acceptable (they are records of decisions, not runtime
instructions). `config/` files are personal and expected to contain the
candidate's name.

- [ ] **Step 3: Verify Apple Notes references are framed as optional**

Run: `grep -n "source of truth" PRINCIPLES.md CLAUDE.md skills/*/SKILL.md`
Expected: Only `output/` references as source of truth. Apple Notes should
never be called "source of truth" in any skill or doc file.

- [ ] **Step 4: Run the test protocol**

Follow `integrations/docs/config-migration-test-protocol.md` to validate the
migration end-to-end. The key checks:
1. `node scripts/validate-config.js` passes
2. `memory/job-search/` is gone
3. Skill files reference config, not hardcoded values
4. Output/ is the primary state layer in all docs
