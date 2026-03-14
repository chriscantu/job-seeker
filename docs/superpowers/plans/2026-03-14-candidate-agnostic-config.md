# Candidate-Agnostic Configuration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all hardcoded candidate data out of CLAUDE.md into config files, replace Apple Notes as the default state layer with local output/ markdown files, and make every skill read config directly so any job seeker can clone and use this plugin.

**Architecture:** Config lives in `config/candidate.md` + `config/search.md` (gitignored, markdown tables). State lives in date-prefixed `output/*.md` files (already gitignored). All seven skill files are updated in one coordinated pass — no partial migration.

**Tech Stack:** Node.js (validate-config.js script), Markdown (all skill/config files), fish shell

---

## Chunk 1: Config Files, .gitignore, and Validation Script

> **Important**: Run Task 3 (.gitignore) FIRST before creating any config files.
> `config/candidate.md` is a personal file that must never be committed.

### Task 1: Create config/candidate.md.example

**Files:**
- Create: `config/candidate.md.example`

- [ ] **Step 1: Create the example template**

Create `config/candidate.md.example`:

```markdown
# Candidate Profile

Copy this file to `config/candidate.md` and fill in your details.
This file is gitignored — only the .example template is committed.

| Field | Value |
|-------|-------|
| Name | Your Full Name |
| Current Role | Title, Company |
| Target Roles | Senior Director of Engineering, VP of Engineering, Head of Engineering |
| Experience | X+ years leading [domain] engineering teams (N+ engineers) |
| Core Strengths | Strength 1, Strength 2, Strength 3 |
| Previous Companies | Company A, Company B, Company C |
| Education | Degree, University |
| Location | City, State |
| Email | you@example.com |

## Accomplishments

Add 3–5 bullet points with specific, quantified accomplishments relevant to
your target roles. Skills use these to ground cover letters and interview prep
in real evidence.

- [Example: Reduced deployment cycle from X months to Y minutes, unlocking $Z in revenue]
- [Example: Led N engineers across M teams across X geographies]
- [Example: Saved $X through automation/platform consolidation]
```

- [ ] **Step 2: Create the actual config file for Chris**

Create `config/candidate.md` (this file is gitignored — never commit it):

```markdown
# Candidate Profile

| Field | Value |
|-------|-------|
| Name | Christopher Cantu |
| Current Role | Director of Engineering, Procore Technologies |
| Target Roles | Senior Director of Engineering, VP of Engineering, Head of Engineering, SVP Engineering |
| Experience | 15+ years leading platform engineering teams (60+ engineers) |
| Core Strengths | Delivery transformation, CI/CD optimization, platform engineering, multinational team leadership, design systems, DevOps excellence |
| Previous Companies | Procore, Babylon Health, Vrbo (Expedia Group) |
| Education | MS Information Systems + BBA, Baylor University |
| Location | Austin, TX |
| Email | chris.m.cantu@icloud.com |

## Accomplishments

- Reduced deployment cycle from 6 months to minutes; increased release velocity 20x at Procore
- Grew CI/CD adoption from 1% to 95% across 185 repositories
- Led 60+ engineers across 8 international teams (US, Europe, Africa, Asia)
- Drove $18M+ in business value through platform engineering and automation
- Achieved 85% design system adoption across 185 repos via micro-frontend architecture
- Saved $10M+ in operational costs through automation and tooling consolidation
- Unlocked $12M in international revenue by reducing localization deployment to minutes
- Generated $8M from A/B testing infrastructure enabling data-driven product decisions
- Pioneered WCAG accessibility compliance (first at Procore), setting company standard
```

- [ ] **Step 3: Verify candidate.md is gitignored before committing**

```bash
git status --short
```

Expected: `config/candidate.md` does NOT appear in the output. If it shows `??`, stop — Task 3 (.gitignore) must run first.

- [ ] **Step 4: Commit**

```bash
git add config/candidate.md.example
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
feat(config): add config/candidate.md.example template

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 2: Create config/search.md.example

**Files:**
- Create: `config/search.md.example`
- Create: `config/search.md` (gitignored)

- [ ] **Step 1: Create the example template**

Create `config/search.md.example`:

```markdown
# Search Preferences

Copy this file to `config/search.md` and fill in your preferences.
This file is gitignored — only the .example template is committed.

| Field | Value |
|-------|-------|
| Remote Preference | Remote or Hybrid |
| Comp Floor | $X base + Y% bonus + $Z equity |
| Company Types | Mission-driven, growth-stage, midsize |
| Companies to Skip | (comma-separated list of companies to exclude) |
| Sources | LinkedIn, Greenhouse, Wellfound, Lever, Ashby |
| Apple Notes Prefix | Job Search |

## Target Role Titles

List the exact titles to search for, one per line:

- Senior Director of Engineering
- VP of Engineering
- Head of Engineering

## Location Constraints

- Remote: Yes
- Hybrid (Austin TX area): Yes
- Relocation required: No
- 100% in-office: No

## Notes

Add any current search context here — companies you're actively pursuing,
sources that have been most effective, or search adjustments.
```

- [ ] **Step 2: Create the actual search config for Chris**

Create `config/search.md` (gitignored — never commit):

```markdown
# Search Preferences

| Field | Value |
|-------|-------|
| Remote Preference | Remote or Hybrid |
| Comp Floor | $265K base + 15% bonus + $100K RSUs |
| Company Types | Mission-driven, growth-stage, midsize |
| Companies to Skip | |
| Sources | LinkedIn, Greenhouse, Wellfound, Lever, Ashby, Tech Jobs for Good |
| Apple Notes Prefix | Job Search |

## Target Role Titles

- Senior Director of Engineering
- VP of Engineering
- Head of Engineering
- SVP Engineering
- VP Platform Engineering
- VP Developer Experience

## Location Constraints

- Remote: Yes
- Hybrid (Austin TX area): Yes
- Relocation required: No
- 100% in-office: No
- Consulting or contract: No

## Notes

What He Wants: Mission-driven company where he can shape engineering culture,
not just maintain it.
```

- [ ] **Step 3: Commit**

```bash
git add config/search.md.example
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
feat(config): add config/search.md.example template

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 3: Update .gitignore

> **Run this task first** — before creating config/candidate.md or config/search.md.

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add new gitignore entries**

The current `.gitignore` ends with:
```
# Personal config files (only .example templates are committed)
integrations/config/*.md
!integrations/config/*.md.example

# Outdated files
job-search-system.md

# OS files
.DS_Store
```

After the `!integrations/config/*.md.example` line (and before `# Outdated files`), insert:

```
# Candidate config files (personal — only .example templates are committed)
config/candidate.md
config/search.md

# Writing samples (personal voice calibration — gitignored)
references/writing-samples/
```

The resulting block should look like:
```
# Personal config files (only .example templates are committed)
integrations/config/*.md
!integrations/config/*.md.example

# Candidate config files (personal — only .example templates are committed)
config/candidate.md
config/search.md

# Writing samples (personal voice calibration — gitignored)
references/writing-samples/

# Outdated files
job-search-system.md

# OS files
.DS_Store
```

Leave the `# State mirrors` comment and `memory/` entry unchanged — those will be updated in Task 12 when memory/ is deleted.

- [ ] **Step 2: Verify gitignore works**

Create a test file, verify it's ignored, then clean up:

```bash
mkdir -p /Users/chris.cantu/repos/job-seeker/config
touch /Users/chris.cantu/repos/job-seeker/config/candidate.md
git status --short
rm /Users/chris.cantu/repos/job-seeker/config/candidate.md
```

Expected: `config/candidate.md` does NOT appear in `git status --short` output (it is gitignored).

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
chore: gitignore config files and writing-samples directory

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 4: Create scripts/validate-config.js

**Files:**
- Create: `scripts/validate-config.js`

- [ ] **Step 1: Create the scripts/ directory if it doesn't exist**

```bash
mkdir -p /Users/chris.cantu/repos/job-seeker/scripts
```

The `scripts/` directory exists but only contains AppleScript files. Creating `validate-config.js` there is the right location per PRINCIPLES.md (JS scripts go in `scripts/`).

- [ ] **Step 2: Write the script**

Create `scripts/validate-config.js`:

```javascript
#!/usr/bin/env node
// scripts/validate-config.js
// Validates config files exist and contain required fields.
// Run: node scripts/validate-config.js
// Exit 0 = valid. Exit 1 = issues found (messages printed to stdout).

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const issues = [];

function checkFile(filePath, requiredFields, examplePath) {
  const fullPath = path.join(root, filePath);
  if (!fs.existsSync(fullPath)) {
    issues.push(`✗ ${filePath} not found.\n  Copy ${examplePath} to ${filePath} and fill in your details.`);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const field of requiredFields) {
    // Match "| Field |" in markdown table (with optional whitespace)
    const pattern = new RegExp(`\\|\\s*${field}\\s*\\|`);
    if (!pattern.test(content)) {
      issues.push(`✗ ${filePath} is missing required field: "${field}"`);
    }
  }
}

function checkGitignore() {
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const required = [
    'config/candidate.md',
    'config/search.md',
    'references/writing-samples/',
  ];
  for (const entry of required) {
    if (!content.includes(entry)) {
      issues.push(`✗ .gitignore is missing entry: ${entry}`);
    }
  }
}

function checkStateFiles() {
  // Validates naming for all three state file types: seen-postings, applications, preferences.
  // State files live in output/ after migration (not memory/job-search/ — that is the old Apple Notes mirror).
  const outputDir = path.join(root, 'output');
  if (!fs.existsSync(outputDir)) return;
  const statePattern = /^(\d{4}-\d{2}-\d{2})-(seen-postings|applications|preferences)\.md$/;
  const stateFiles = fs.readdirSync(outputDir).filter(f =>
    (f.includes('seen-postings') || f.includes('applications') || f.includes('preferences')) &&
    f.endsWith('.md')
  );
  for (const file of stateFiles) {
    if (!statePattern.test(file)) {
      issues.push(`✗ State file "output/${file}" does not follow YYYY-MM-DD-{type}.md naming.`);
    }
  }
}

const CANDIDATE_FIELDS = [
  'Name', 'Current Role', 'Target Roles', 'Experience',
  'Core Strengths', 'Previous Companies', 'Education', 'Location', 'Email',
];
const SEARCH_FIELDS = ['Remote Preference', 'Comp Floor', 'Company Types'];

checkFile('config/candidate.md', CANDIDATE_FIELDS, 'config/candidate.md.example');
checkFile('config/search.md', SEARCH_FIELDS, 'config/search.md.example');
checkGitignore();
checkStateFiles();

if (issues.length === 0) {
  console.log('✓ Config valid');
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} issue(s) found:\n`);
  issues.forEach(i => console.log(`  ${i}\n`));
  process.exit(1);
}
```

- [ ] **Step 3: Test missing-file failure**

```bash
mv /Users/chris.cantu/repos/job-seeker/config/candidate.md /Users/chris.cantu/repos/job-seeker/config/candidate.md.bak
node /Users/chris.cantu/repos/job-seeker/scripts/validate-config.js
```

Expected output:
```
✗ 1 issue(s) found:

  ✗ config/candidate.md not found.
    Copy config/candidate.md.example to config/candidate.md and fill in your details.
```

Restore immediately:
```bash
mv /Users/chris.cantu/repos/job-seeker/config/candidate.md.bak /Users/chris.cantu/repos/job-seeker/config/candidate.md
```

- [ ] **Step 4: Test valid state — verify pass**

```bash
node /Users/chris.cantu/repos/job-seeker/scripts/validate-config.js
```

Expected output:
```
✓ Config valid
```

- [ ] **Step 5: Test missing-field failure**

Edit `config/candidate.md` to temporarily rename the `Email` row to `EmailX`, then run:

```bash
node /Users/chris.cantu/repos/job-seeker/scripts/validate-config.js
```

Expected:
```
✗ 1 issue(s) found:

  ✗ config/candidate.md is missing required field: "Email"
```

Restore the `Email` row. Run again to confirm `✓ Config valid`.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-config.js
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
feat(scripts): add validate-config.js for config file validation

Checks that config/candidate.md and config/search.md exist with all
required fields. Exit 0 = valid, exit 1 = issues with clear messages.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Chunk 2: References, PRINCIPLES.md, and CLAUDE.md

### Task 5: Create references/writing-samples/README.md

**Files:**
- Create: `references/writing-samples/README.md`

- [ ] **Step 1: Create the directory and README**

```bash
mkdir -p /Users/chris.cantu/repos/job-seeker/references/writing-samples
```

Create `references/writing-samples/README.md`:

```markdown
# Writing Samples

This directory is gitignored. Add 2–3 of your best cover letters, personal
statements, or other writing samples here before using the cover-letter,
why-this-company, or networking-outreach skills.

## Why This Matters

Skills that produce written output use these files to calibrate tone and voice
before writing. Without samples, they fall back to `references/voice-guide.md`
and `PRINCIPLES.md`, which describe the voice in the abstract. Samples provide
concrete evidence of your actual writing style.

## What to Add

- **2–3 cover letters** from previous applications (redact any sensitive details)
- **Personal statements** or "why this company" responses you've written before
- **`voice-notes.md`** (optional) — freeform notes about your voice, phrases you
  like, things you want to avoid

## File Naming

No strict convention required. Descriptive names are helpful:

    writing-samples/
      cover-letter-babylon-health.md
      cover-letter-gitlab.md
      voice-notes.md

## Usage by Skills

Skills check for files in this directory using:

    Glob pattern: references/writing-samples/*.md

If the directory is empty or missing, the skill proceeds using voice-guide.md
and PRINCIPLES.md only.
```

- [ ] **Step 2: Commit**

```bash
git add references/writing-samples/README.md
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
docs: add references/writing-samples/README.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 6: Update PRINCIPLES.md

**Files:**
- Modify: `PRINCIPLES.md`

- [ ] **Step 1: Update the "Don't duplicate config" principle**

In `PRINCIPLES.md`, find the line:
```
**Don't duplicate config** — Candidate profile, search preferences, and
  paths live in one place. Skills read them; they don't hardcode them.
```

Replace with:
```
**Don't duplicate config** — Candidate profile and search preferences live in
  `config/candidate.md` and `config/search.md`. Skills read them; they don't
  hardcode them. Never copy profile data into a skill file.
```

- [ ] **Step 2: Update the "State Continuity" section**

Find:
```
Apple Notes is the source of truth. Local `memory/` files are a convenience
mirror, not authoritative.

Every skill reads relevant state before acting and writes state after completing.
Never show a role that's already been seen. Never ask for information that's
already stored. Respect the candidate's time.
```

Replace with:
```
`output/` markdown files are the source of truth for state that persists across
sessions (seen postings, preferences, applications). Apple Notes is an optional
personal integration — `daily-digest` writes there as a secondary layer when
configured, but it is not required for the plugin to function.

State files live at the `output/` root (e.g., `output/2026-03-14-seen-postings.md`).
Per-company artifacts (cover letters, resumes) continue to live in
`output/{company-slug}/`. Both patterns coexist in `output/` with no conflict.

Skills glob for the most recent `output/*-{state-type}.md` file before acting
and append to it after completing. If no file exists, create one with today's
date prefix: `output/YYYY-MM-DD-{state-type}.md`.

Every skill reads relevant state before acting and writes state after completing.
Never show a role that's already been seen. Never ask for information that's
already stored. Respect the candidate's time.
```

- [ ] **Step 3: Commit**

```bash
git add PRINCIPLES.md
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
docs(principles): update config and state continuity principles

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 7: Thin CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the Candidate Profile table with config pointers**

Find the entire "Candidate Profile" section (from `## Candidate Profile (Always in Context)` through the closing `|` of the table).

Replace the full table section with:

```markdown
## Candidate Profile

Read `config/candidate.md` for the full candidate profile (name, current role,
target roles, experience, strengths, education, location, email, accomplishments).

## Search Preferences

Read `config/search.md` for target role titles, location constraints, comp floor,
company types, sources, and companies to skip.
```

- [ ] **Step 2: Update the State Management section**

Find:
```markdown
| Apple Note | Purpose |
|------------|---------|
| `Job Search - Seen Postings` | Deduplication log — every role ever surfaced |
| `Job Search - Preferences` | Interest signals, liked/passed roles, source effectiveness |
| `Job Search - Applications` | Application pipeline tracker |

Local `memory/job-search/` files mirror this state when a session has the folder mounted.
```

Replace with:
```markdown
State persists in date-prefixed markdown files in `output/` (gitignored):

| File pattern | Purpose |
|-------------|---------|
| `output/*-seen-postings.md` | Deduplication log — every role ever surfaced |
| `output/*-preferences.md` | Interest signals, liked/passed roles, source effectiveness |
| `output/*-applications.md` | Application pipeline tracker |

Skills glob for the most recent file of each type. If none exists, create one
with today's date: `output/YYYY-MM-DD-{type}.md`.

Apple Notes integration is Chris's personal layer — `daily-digest` also writes
there when `integrations/config/notes-config.md` is present. See
`integrations/adapters/apple-notes.md` to enable it as a new user.
```

- [ ] **Step 3: Update dangling reference in Resume section**

After removing the Candidate Profile table, CLAUDE.md's Resume section contains:
```
The candidate profile table above provides a quick reference, but the resume
is the source of truth for detailed accomplishments.
```

Find that sentence and replace it with:
```
Read `config/candidate.md` for a quick profile reference, but the resume
is the source of truth for detailed accomplishments.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
refactor(claude-md): thin candidate profile, point to config files

Moves hardcoded candidate data to config/candidate.md and config/search.md.
Updates state management section to reference output/ files instead of Apple Notes.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Chunk 3: Skill Updates — Active Skills

### Task 8: Update skills/daily-digest/SKILL.md

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

This is the most complex update — it has hardcoded state calls, hardcoded filter criteria, and a hardcoded "Chris" greeting.

- [ ] **Step 1: Add config reads to "Before You Start"**

Find the "Before You Start" section. It currently starts with:
```
1. Read `CLAUDE.md` for candidate profile and filter criteria
```

Replace step 1 with:
```
1. Read `config/candidate.md` — candidate name and profile
2. Read `config/search.md` — target role titles, comp floor, location constraints, sources
3. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error to the user
```

Renumber the remaining old steps as follows:
- Old step 2 (`Read integrations/config/notes-config.md`) — move to the end of the list as a conditional step:
  ```
  6. (Optional — Apple Notes only) If `integrations/config/notes-config.md` exists,
     read it to get `plugin_root` and `default_folder` for Apple Notes writes.
     Skip this step if the file does not exist.
  ```
- Old step 3 (Seen Postings read) → replaced by new step 4 in Step 3 below
- Old step 4 (Preferences read) → replaced by new step 5 in Step 3 below

- [ ] **Step 2: Update Filter Criteria to reference config**

Find the `## Filter Criteria` section. Replace the hardcoded values with references to config:

```markdown
## Filter Criteria

Read from `config/search.md`. Use the following fields to filter:

**Include:**
- Titles: values from "Target Role Titles" section of `config/search.md`
- Location: values from "Location Constraints" section
- Company type: "Company Types" field
- Comp: "Comp Floor" field — include roles likely to meet or exceed this

**Exclude:**
- Any company listed in "Companies to Skip" field
- Roles that violate location constraints
- IC/Staff Engineer roles
- Consulting or contract
- Postings that return 404, redirect to a general careers page, or indicate
  the role is filled / no longer accepting applications — verify before including
```

- [ ] **Step 3: Update state reads (Before You Start steps 4–5)**

Old steps:
```
3. Run `apple_notes_read.applescript "Job Search - Seen Postings" "{default_folder}"` — ...
4. Run `apple_notes_read.applescript "Job Search - Preferences" "{default_folder}"` — ...
```

Replace with (as new steps 4–5):
```
4. Glob `output/*-seen-postings.md`, sort descending, read the most recent file.
   Do NOT resurface any role already listed. If no file exists, treat as empty
   (no previously seen postings).
5. Glob `output/*-preferences.md`, sort descending, read the most recent file.
   Use interest signals to weight searches. If no file exists, treat as no preferences.
```

- [ ] **Step 4: Update the greeting in the HTML template**

Find:
```html
<div><span style="font-size: 11px">Good morning Chris — here are today's executive engineering leadership opportunities:</span></div>
```

Replace with:
```html
<div><span style="font-size: 11px">Good morning {Name from config/candidate.md} — here are today's executive engineering leadership opportunities:</span></div>
```

Add a note above the HTML template block:
```
Substitute `{Name from config/candidate.md}` with the `Name` field value read
from `config/candidate.md` before constructing the HTML body.
```

- [ ] **Step 5: Update State Updates section**

Find the `## State Updates` section. Replace Apple Notes write calls with output/ file writes while keeping Apple Notes as optional secondary:

```markdown
## State Updates

After the digest note is written:

### Primary state — output/ files

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

### Secondary state — Apple Notes (optional, Chris's personal integration)

If `integrations/config/notes-config.md` exists, also run the Apple Notes
state updates below. Skip this block entirely if the file does not exist.

Read `integrations/config/notes-config.md` to get `plugin_root`, `default_folder`,
and `Apple Notes Prefix` (from `config/search.md`, default: `Job Search`).

Construct note names using the prefix:
- `{prefix} - Seen Postings`
- `{prefix} - Preferences`

Run `apple_notes_update.applescript` for each note as before. Check return values;
if either starts with `error:`, log to `output/error-{date}.log` and warn the user
but do NOT fail the digest — primary state already succeeded.
```

- [ ] **Step 6: Commit**

```bash
git add skills/daily-digest/SKILL.md
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
feat(daily-digest): read config files, use output/ for state

- Config reads: candidate.md + search.md replace CLAUDE.md inline data
- State: output/ markdown files are now primary; Apple Notes is optional secondary
- Greeting: uses Name field from config instead of hardcoded "Chris"
- Filter criteria: derived from config/search.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 9: Update skills/cover-letter/SKILL.md

**Files:**
- Modify: `skills/cover-letter/SKILL.md`

- [ ] **Step 1: Add config reads to "Before You Start"**

Find:
```
1. Read `PRINCIPLES.md` — especially "Quantify Everything" and "Respect the Level"
2. Read `references/resume.pdf` for detailed accomplishments
3. Read the `why-this-company` skill's output if one exists for this company
   (avoid duplicating the research)
```

Replace with:
```
1. Read `PRINCIPLES.md` — especially "Quantify Everything" and "Respect the Level"
2. Read `config/candidate.md` — candidate name, role, accomplishments
3. Read `references/resume.pdf` for full detailed accomplishments
4. Glob `references/writing-samples/*.md` — if any files exist, read them to
   calibrate tone and voice before writing. Fall back to `references/voice-guide.md`
   if the directory is empty or missing.
5. Read the `why-this-company` skill's output if one exists for this company
   (avoid duplicating the research)
```

- [ ] **Step 2: Replace the hardcoded accomplishments table**

Find and remove:
```
Pull from these accomplishment categories based on role requirements:

| Requirement Area | Chris's Evidence |
|-----------------|-----------------|
| Delivery/velocity | CI/CD 1% → 95%; deploy 6mo → minutes; 20x release velocity |
| Revenue impact | $18M+ business value; $12M international revenue; $8M A/B testing |
| Scale/platform | 85% design system adoption across 185 repos; micro-frontend architecture |
| Team leadership | 60+ engineers, 8 international teams, US/Europe/Africa/Asia |
| Cost optimization | $10M+ operational savings through automation |
| Culture/transformation | ShapeUp methodology adoption; pioneered accessibility (WCAG) |
```

Replace with:
```
Pull from the `## Accomplishments` section of `config/candidate.md`. Map each
listed accomplishment to the most relevant requirement area from the job posting.
Prefer accomplishments with specific numbers — any bullet without a number is
weak evidence.
```

Also find in `### What to Avoid`:
```
- Underselling: Chris leads 60 engineers across 8 teams at a public company — own that
```
Replace with:
```
- Underselling: own the candidate's actual scope — team size, org scale, company stage
```

- [ ] **Step 3: Update State Update section**

Find:
```markdown
## State Update

After generating, update `Job Search - Seen Postings` Apple Note to reflect
that materials have been prepared for this role. If an `Applications` note
exists, log the activity there.
```

Replace with:
```markdown
## State Update

After generating, append to the seen-postings state file:

1. Glob `output/*-seen-postings.md`, sort descending.
2. Append to the most recent file (or create `output/YYYY-MM-DD-seen-postings.md`
   if none exists):
   ```
   - {Company} | {Title} | cover letter generated | {date}
   ```

Note: Applications pipeline tracking is deferred to the `application-tracker` skill.
```

- [ ] **Step 4: Commit**

```bash
git add skills/cover-letter/SKILL.md
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
feat(cover-letter): read config files, use output/ for state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

### Task 10: Update skills/why-this-company/SKILL.md

**Files:**
- Modify: `skills/why-this-company/SKILL.md`

- [ ] **Step 1: Add config reads to "Before You Start"**

Find:
```
1. Read `PRINCIPLES.md` — especially "Authenticity Over Polish" and "Mission Alignment Is Not Performative"
2. Read `references/resume.pdf` for detailed accomplishments
3. Read the `Job Search - Preferences` Apple Note for interest signals
```

Replace with:
```
1. Read `PRINCIPLES.md` — especially "Authenticity Over Polish" and "Mission Alignment Is Not Performative"
2. Read `config/candidate.md` — candidate name, role, previous companies, strengths
3. Read `references/resume.pdf` for detailed accomplishments
4. Glob `references/writing-samples/*.md` — if any files exist, read them to
   calibrate tone before writing.
5. Glob `output/*-preferences.md`, sort descending, read the most recent file
   for interest signals. If no file exists, proceed without preference context.
```

- [ ] **Step 2: Update State Update section**

Find:
```markdown
## State Update

After generating, ask Chris if he wants to apply. If yes, update the
`Job Search - Seen Postings` Apple Note to mark the role as "APPLYING"
and log it in the `Job Search - Applications` note if it exists.
```

Replace with:
```markdown
## State Update

After generating, ask the candidate if they want to apply. If yes:

1. Glob `output/*-seen-postings.md`, sort descending.
2. Append to the most recent file (or create `output/YYYY-MM-DD-seen-postings.md`
   if none exists):
   ```
   - {Company} | {Title} | APPLYING | {date}
   ```

Note: Applications pipeline tracking is deferred to the `application-tracker` skill.
```

- [ ] **Step 3: Replace hardcoded candidate references in Research Phase**

Find the section that references Chris specifically:
```
- Mission alignment (healthcare → Babylon, construction tech → Procore, travel → Vrbo)
- Engineering challenges that match his strengths (broken delivery, scaling, platform consolidation)
- Culture-shaping opportunity (his stated goal for the next role)
```

Replace with:
```
- Mission alignment — connect to the candidate's previous company domains
  (read from `config/candidate.md` Previous Companies and Core Strengths fields)
- Engineering challenges that match the candidate's core strengths
- The candidate's stated goal for their next role (from `config/candidate.md`)
```

- [ ] **Step 4: Update remaining hardcoded "Chris" references**

Find and replace the remaining candidate-specific prose (leave template "Example opening/bridge" blocks unchanged — they are labeled examples and serve as good guidance):

Replace in frontmatter description (lines 4–8):
```
  Generate a compelling "Why did you decide to apply to this company?" response
  tailored to a specific company and role. Use this skill when Chris asks
  "why this company", "why am I applying", "write a why statement", "application
  response for [company]", or any variation of explaining motivation for applying
  to a specific role. Also use when preparing application materials that need
  a motivation narrative.
```
With:
```
  Generate a compelling "Why did you decide to apply to this company?" response
  tailored to a specific company and role. Triggers: "why this company",
  "why am I applying", "write a why statement", "application response for [company]",
  or any variation of explaining motivation for applying to a specific role.
  Also use when preparing application materials that need a motivation narrative.
```

Replace the opening paragraph after the heading:
```
Creates an authentic, executive-level response to "Why did you decide to apply
to this company?" by connecting Chris's real career trajectory and values to
the company's mission, stage, and engineering challenges.
```
With:
```
Creates an authentic, executive-level response to "Why did you decide to apply
to this company?" by connecting the candidate's real career trajectory and values
to the company's mission, stage, and engineering challenges.
```

- [ ] **Step 5: Commit**

```bash
git add skills/why-this-company/SKILL.md
git commit -F /tmp/commitmsg
```

Write commit message to `/tmp/commitmsg`:
```
feat(why-this-company): read config files, use output/ for state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Chunk 4: Stub Skill Updates, Cleanup, and Test Protocol

### Task 11: Update stub skills

**Files:**
- Modify: `skills/resume-tailor/SKILL.md`
- Modify: `skills/company-research/SKILL.md`
- Modify: `skills/interview-prep/SKILL.md`
- Modify: `skills/networking-outreach/SKILL.md`
- Modify: `skills/application-tracker/SKILL.md`

Each stub gets a "Before You Start" section added (or updated) with config reads. The rest of the stub content is unchanged.

- [ ] **Step 1: Update resume-tailor/SKILL.md**

Find:
```
## Intended Behavior

1. Read `references/resume.pdf` for the canonical resume
2. Read CLAUDE.md for candidate profile
```

Replace step 2 and renumber remaining steps (original steps 3–6 become 4–7):
```
2. Read `config/candidate.md` for candidate profile
3. Read `config/search.md` for target roles and comp floor
```

Add a new section before `## Intended Behavior`:
```markdown
## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, role, accomplishments
3. Read `config/search.md` — target roles, comp floor
4. Read `references/resume.pdf` — canonical resume content
```

- [ ] **Step 2: Update company-research/SKILL.md**

Replace:
```
5. Output a structured research brief to Apple Notes
```

With:
```
5. Output a structured research brief saved to `output/{company-slug}/company-research.md`
```

Add before `## Intended Behavior`:
```markdown
## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, core strengths, previous companies
3. Read `config/search.md` — company types of interest, comp floor
```

- [ ] **Step 3: Update interview-prep/SKILL.md**

Replace:
```
6. Output as a study guide in Apple Notes
```

With:
```
6. Output as a study guide saved to `output/{company-slug}/interview-prep.md`
```

Add before `## Intended Behavior`:
```markdown
## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, experience, core strengths, accomplishments
3. Read `config/search.md` — target roles
4. Read `references/resume.pdf` — for STAR story material
```

- [ ] **Step 4: Update networking-outreach/SKILL.md**

Add before `## Intended Behavior`:
```markdown
## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name, current role, target roles
3. Glob `references/writing-samples/*.md` — if any files exist, read them to
   calibrate tone before writing
```

- [ ] **Step 5: Update application-tracker/SKILL.md**

Replace the existing content below the frontmatter with:

```markdown
# Application Tracker

Manages the full application pipeline from discovered → applied → interviewing
→ offer → decision.

## Status: Planned

This skill is stubbed. Implementation spec: v0.4 Item 3 (separate spec required).

## Before You Start

1. Run `node scripts/validate-config.js` — if it exits non-zero, stop and show the error
2. Read `config/candidate.md` — candidate name
3. Read `config/search.md` — target roles
4. Glob `output/*-applications.md`, sort descending, read most recent for current pipeline.
   If no file exists, treat as empty pipeline.

## Intended Behavior

1. Maintain pipeline state in `output/*-applications.md`
2. Track: company, role, stage, date applied, next action, contacts
3. Support stage transitions with date logging
4. Surface stale applications (no movement in 2+ weeks)
5. Generate weekly pipeline summary

## Pipeline Stages

Discovery → Research → Applied → Screen → Interview Round 1 →
Interview Round 2+ → Final Round → Offer → Decision → Closed
```

- [ ] **Step 6: Commit all stub updates**

Write commit message to `/tmp/commitmsg`:
```
feat(skills): add config reads and output/ state to all stub skills

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add skills/resume-tailor/SKILL.md skills/company-research/SKILL.md skills/interview-prep/SKILL.md skills/networking-outreach/SKILL.md skills/application-tracker/SKILL.md
git commit -F /tmp/commitmsg
```

---

### Task 12: Delete memory/job-search/ files

**Files:**
- Delete: `memory/job-search/seen-postings.md`
- Delete: `memory/job-search/preferences.md`
- Delete: `memory/job-search/` (directory, if empty)

- [ ] **Step 1: Delete state mirror files**

```bash
rm /Users/chris.cantu/repos/job-seeker/memory/job-search/seen-postings.md
rm /Users/chris.cantu/repos/job-seeker/memory/job-search/preferences.md
rmdir /Users/chris.cantu/repos/job-seeker/memory/job-search 2>/dev/null; true
```

- [ ] **Step 2: Verify memory/job-search is gone**

```bash
ls /Users/chris.cantu/repos/job-seeker/memory/
```

Expected: `memory/job-search/` no longer appears (or `memory/` itself is empty).

- [ ] **Step 3: Commit**

Write commit message to `/tmp/commitmsg`:
```
chore: remove memory/job-search/ state mirrors

State is now tracked in output/ markdown files. Apple Notes remains
an optional secondary layer for personal use.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add -A memory/
git commit -F /tmp/commitmsg
```

---

### Task 13: Create config-migration test protocol

**Files:**
- Create: `integrations/docs/config-migration-test-protocol.md`

- [ ] **Step 1: Create the test protocol document**

Create `integrations/docs/config-migration-test-protocol.md`:

```markdown
# Config Migration Test Protocol

**Date written**: 2026-03-14
**Covers**: v0.4 Item 5 — Candidate-Agnostic Configuration
**Related spec**: `integrations/specs/candidate-agnostic-config-spec.md`

Run these steps manually after implementing the config migration.
Check each step off as you go. Note any failures with the exact error.

---

## Prerequisites

- Both `config/candidate.md` and `config/search.md` exist and are filled in
- `references/writing-samples/` exists (can be empty)
- No `memory/job-search/` directory

---

## Steps

- [ ] **1. Validate-config passes with full setup**

  ```
  node scripts/validate-config.js
  ```
  Expected: `✓ Config valid`

- [ ] **2. Validate-config fails clearly when candidate.md is missing**

  Rename `config/candidate.md` to `config/candidate.md.bak`, then run:
  ```
  node scripts/validate-config.js
  ```
  Expected: exit 1, message points to `config/candidate.md.example`

  Restore: `mv config/candidate.md.bak config/candidate.md`

- [ ] **3. Validate-config fails clearly when a required field is missing**

  Temporarily rename the `Email` row in `config/candidate.md` to `EmailX`, run:
  ```
  node scripts/validate-config.js
  ```
  Expected: exit 1, message names the missing field `"Email"`

  Restore the `Email` row.

- [ ] **4. daily-digest uses Name from config (not hardcoded "Chris")**

  In `config/candidate.md`, temporarily change Name to `Test User`. Run `daily-digest`.
  Expected: digest greeting reads "Good morning Test User —"

  Restore Name to `Christopher Cantu`.

- [ ] **5. daily-digest writes state to output/ file**

  After running `daily-digest`:
  ```
  ls output/*-seen-postings.md
  ```
  Expected: at least one file matching `YYYY-MM-DD-seen-postings.md` exists.
  Open it and confirm entries follow the `- Company | Title | URL` format.

- [ ] **6. daily-digest Apple Notes write still works (Chris only)**

  Check that `integrations/config/notes-config.md` exists.
  After running `daily-digest`, confirm `Job Search - Seen Postings` note in
  Apple Notes was updated (open Notes app).

- [ ] **7. cover-letter reads writing samples when present**

  Add a short markdown file to `references/writing-samples/sample.md`.
  Run `cover-letter` for any test company.
  Confirm in the session that the skill read the sample (it should reference
  reading files from `references/writing-samples/`).

- [ ] **8. memory/job-search/ does not exist**

  ```
  ls memory/
  ```
  Expected: `job-search/` directory is absent.

- [ ] **9. validate-config catches bad state file naming**

  Depends on `checkStateFiles()` in `scripts/validate-config.js` (implemented in Chunk 1, Task 4).
  Create a misnamed state file:
  ```
  touch output/seen-postings.md
  node scripts/validate-config.js
  ```
  Expected: exit 1, message flags `output/seen-postings.md` naming violation.
  Cleanup: `rm output/seen-postings.md`

  Remove: `rm output/seen-postings.md`

---

## Caveats

- Steps 4–6 require running Claude skills interactively
- Step 6 requires macOS with Apple Notes configured
- Apple Notes validation (step 6) is optional for users without Notes integration
```

- [ ] **Step 2: Commit**

Write commit message to `/tmp/commitmsg`:
```
docs: add config-migration-test-protocol.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```bash
git add integrations/docs/config-migration-test-protocol.md
git commit -F /tmp/commitmsg
```

---

### Task 14: Final validation

- [ ] **Step 1: Run validate-config.js**

```bash
node /Users/chris.cantu/repos/job-seeker/scripts/validate-config.js
```

Expected: `✓ Config valid`

- [ ] **Step 2: Confirm memory/job-search is gone**

```bash
ls /Users/chris.cantu/repos/job-seeker/memory/ 2>/dev/null || echo "memory/ is empty or gone"
```

- [ ] **Step 3: Confirm all config files are gitignored**

```bash
git status
```

Expected: `config/candidate.md`, `config/search.md` do NOT appear in output.

- [ ] **Step 4: Confirm all example files are tracked**

```bash
git ls-files config/
```

Expected: only `config/candidate.md.example` and `config/search.md.example`.

- [ ] **Step 5: Review git log**

```bash
git log --oneline -10
```

Confirm all expected commits are present in the log.
