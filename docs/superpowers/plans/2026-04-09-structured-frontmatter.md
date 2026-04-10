# Structured Frontmatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YAML frontmatter to per-company skill output files so downstream skills can read structured metadata instead of parsing markdown headers.

**Architecture:** A shared JS utility (`scripts/lib/frontmatter.js`) handles parse/serialize. A shared skill module (`skills/_shared/frontmatter.md`) documents the schema contract. Docx generation scripts strip frontmatter before parsing. Three skill instruction files are updated to produce/consume frontmatter.

**Tech Stack:** Node.js (CommonJS), `node:test` for testing, YAML frontmatter (hand-parsed, no dependencies)

---

### Task 1: Frontmatter Utility — Failing Tests

**Files:**
- Create: `tests/frontmatter.test.js`

- [ ] **Step 1: Write failing tests for parseFrontmatter and serializeFrontmatter**

```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseFrontmatter, serializeFrontmatter } = require("../scripts/lib/frontmatter");

describe("parseFrontmatter", () => {
  it("extracts metadata and body from a frontmatter block", () => {
    const input = [
      "---",
      "skill: company-research",
      "company: Natera",
      "rating: 4",
      "remote: true",
      "---",
      "",
      "# Natera — Research Brief",
      "Body content here.",
    ].join("\n");

    const { meta, body } = parseFrontmatter(input);
    assert.equal(meta.skill, "company-research");
    assert.equal(meta.company, "Natera");
    assert.equal(meta.rating, "4");
    assert.equal(meta.remote, "true");
    assert.equal(body, "\n# Natera — Research Brief\nBody content here.");
  });

  it("returns empty meta and full body when no frontmatter present", () => {
    const input = "# Just a heading\n\nSome body text.";
    const { meta, body } = parseFrontmatter(input);
    assert.deepEqual(meta, {});
    assert.equal(body, input);
  });

  it("returns empty meta and full body for empty string", () => {
    const { meta, body } = parseFrontmatter("");
    assert.deepEqual(meta, {});
    assert.equal(body, "");
  });

  it("handles quoted values containing colons", () => {
    const input = [
      "---",
      'url: "https://jobs.lever.co/natera/abc"',
      'comp_range: "$239K-$311K"',
      "---",
      "",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(input);
    assert.equal(meta.url, "https://jobs.lever.co/natera/abc");
    assert.equal(meta.comp_range, "$239K-$311K");
  });

  it("handles values with inline colons without quotes", () => {
    const input = [
      "---",
      "role: VP of Engineering: Platform",
      "---",
      "",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(input);
    assert.equal(meta.role, "VP of Engineering: Platform");
  });

  it("ignores lines without a colon in frontmatter", () => {
    const input = [
      "---",
      "skill: company-research",
      "this line has no key-value",
      "company: Natera",
      "---",
      "",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(input);
    assert.equal(meta.skill, "company-research");
    assert.equal(meta.company, "Natera");
    assert.equal(Object.keys(meta).length, 2);
  });

  it("does not treat --- inside body as frontmatter delimiter", () => {
    const input = [
      "---",
      "skill: resume-tailor",
      "---",
      "",
      "# Resume",
      "",
      "---",
      "",
      "## Experience",
    ].join("\n");

    const { meta, body } = parseFrontmatter(input);
    assert.equal(meta.skill, "resume-tailor");
    assert.ok(body.includes("---"));
    assert.ok(body.includes("## Experience"));
  });
});

describe("serializeFrontmatter", () => {
  it("produces a valid frontmatter block followed by body", () => {
    const meta = { skill: "company-research", company: "Natera", rating: "4" };
    const body = "\n# Natera — Research Brief\nBody.";
    const result = serializeFrontmatter(meta, body);

    assert.ok(result.startsWith("---\n"));
    assert.ok(result.includes("skill: company-research\n"));
    assert.ok(result.includes("company: Natera\n"));
    assert.ok(result.includes("rating: 4\n"));
    assert.ok(result.includes("---\n\n# Natera"));
  });

  it("quotes values that contain colons", () => {
    const meta = { url: "https://example.com/jobs/123" };
    const result = serializeFrontmatter(meta, "\nBody.");

    assert.ok(result.includes('url: "https://example.com/jobs/123"'));
  });

  it("does not double-quote already quoted values", () => {
    const meta = { url: "https://example.com" };
    const result = serializeFrontmatter(meta, "\nBody.");
    assert.ok(!result.includes('""'));
  });
});

describe("roundtrip", () => {
  it("parse(serialize(meta, body)) returns the same meta and body", () => {
    const meta = {
      skill: "company-research",
      company: "Natera",
      slug: "natera",
      role: "VP of Engineering",
      url: "https://jobs.lever.co/natera/abc",
      generated: "2026-04-08",
      rating: "4",
      remote: "true",
      positioning_count: "3",
      gaps_count: "2",
    };
    const body = "\n# Natera — Research Brief\n\nBody content.";

    const serialized = serializeFrontmatter(meta, body);
    const { meta: parsedMeta, body: parsedBody } = parseFrontmatter(serialized);

    assert.deepEqual(parsedMeta, meta);
    assert.equal(parsedBody, body);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/frontmatter.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/frontmatter'`

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/frontmatter.test.js
git commit -m "test: add failing tests for frontmatter utility"
```

---

### Task 2: Frontmatter Utility — Implementation

**Files:**
- Create: `scripts/lib/frontmatter.js`

- [ ] **Step 1: Implement parseFrontmatter and serializeFrontmatter**

```js
"use strict";

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { meta: {}, body: "" }.
 * If no frontmatter block is present, meta is empty and body is the full input.
 */
function parseFrontmatter(markdown) {
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return { meta: {}, body: markdown };
  }

  const endIndex = markdown.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { meta: {}, body: markdown };
  }

  const yamlBlock = markdown.slice(4, endIndex);
  const body = markdown.slice(endIndex + 4); // skip "\n---"

  const meta = {};
  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Strip surrounding quotes
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value[value.length - 1] === '"') ||
        (value[0] === "'" && value[value.length - 1] === "'"))
    ) {
      value = value.slice(1, -1);
    }

    meta[key] = value;
  }

  return { meta, body };
}

/**
 * Serialize a metadata object and body string into a frontmatter markdown string.
 * Values containing colons are automatically quoted.
 */
function serializeFrontmatter(meta, body) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    const strVal = String(value);
    if (strVal.includes(":")) {
      lines.push(`${key}: "${strVal}"`);
    } else {
      lines.push(`${key}: ${strVal}`);
    }
  }
  lines.push("---");
  return lines.join("\n") + body;
}

module.exports = { parseFrontmatter, serializeFrontmatter };
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test tests/frontmatter.test.js`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/frontmatter.js
git commit -m "feat: add frontmatter parse/serialize utility"
```

---

### Task 3: Docx Scripts — Strip Frontmatter

**Files:**
- Modify: `scripts/generate_resume_docx.js:455`
- Modify: `scripts/generate_ats_resume_docx.js:407`
- Modify: `scripts/generate_coverletter_docx.js:27`

Note: `generate_article_docx.js` reads image files, not markdown input — no change needed.

- [ ] **Step 1: Write integration test — resume docx with frontmatter**

Create `tests/frontmatter-docx.test.js`:

```js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const RESUME_MD_NO_FM = `# Chris Cantu
**Engineering Leader | Platform & Infrastructure**
chris@example.com | Austin, TX | linkedin.com/in/chris

Experienced engineering leader.

---

## Key Accomplishments

| **Scaled Platform** — Led 80-engineer org | **Cut Deploy Time** — 3 months to 15 min |

---

## Professional Experience

### Senior Director of Engineering | Procore

*Austin, TX | 2021-2025*

**Challenge:** Slow deploys blocking international expansion.
**Action:** Built CI/CD pipeline and localization platform.
**Results:**
- Reduced deploy from 3 months to 15 minutes

---

## Education

**B.S. Computer Science**
University of Texas
**Core Expertise:** Platform Engineering, CI/CD, Distributed Systems
`;

const RESUME_FM = `---
skill: resume-tailor
company: TestCo
slug: testco
role: VP Engineering
url: https://example.com/jobs/123
generated: 2026-04-09
research_date: 2026-04-08
requirements_matched: 3
---
${RESUME_MD_NO_FM}`;

describe("docx generation with frontmatter", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fm-docx-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generate_resume_docx produces identical output with and without frontmatter", () => {
    const mdNoFm = path.join(tmpDir, "no-fm.md");
    const mdFm = path.join(tmpDir, "with-fm.md");
    const docxNoFm = path.join(tmpDir, "no-fm.docx");
    const docxFm = path.join(tmpDir, "with-fm.docx");

    fs.writeFileSync(mdNoFm, RESUME_MD_NO_FM);
    fs.writeFileSync(mdFm, RESUME_FM);

    const scriptDir = path.join(__dirname, "..", "scripts");

    execSync(`bun ${path.join(scriptDir, "generate_resume_docx.js")} "${mdNoFm}" "${docxNoFm}"`);
    execSync(`bun ${path.join(scriptDir, "generate_resume_docx.js")} "${mdFm}" "${docxFm}"`);

    const sizeNoFm = fs.statSync(docxNoFm).size;
    const sizeFm = fs.statSync(docxFm).size;

    // Docx files contain timestamps so byte-exact match is unlikely,
    // but they should be within 1% of each other in size
    const ratio = Math.abs(sizeNoFm - sizeFm) / sizeNoFm;
    assert.ok(ratio < 0.01, `Docx size difference too large: ${sizeNoFm} vs ${sizeFm} (${(ratio * 100).toFixed(1)}%)`);
    assert.ok(sizeNoFm > 1000, `Docx too small (${sizeNoFm}), likely broken`);
  });

  it("generate_coverletter_docx produces output with frontmatter", () => {
    const clMd = path.join(tmpDir, "cl.md");
    const clDocx = path.join(tmpDir, "cl.docx");

    const content = `---
skill: cover-letter
company: TestCo
slug: testco
role: VP Engineering
url: https://example.com/jobs/123
generated: 2026-04-09
word_count: 50
---

Dear Hiring Manager,

I am excited about this role. My experience leading 80-engineer organizations and reducing deployment times from three months to fifteen minutes directly maps to your needs.

Chris Cantu`;

    fs.writeFileSync(clMd, content);

    const scriptDir = path.join(__dirname, "..", "scripts");
    execSync(`bun ${path.join(scriptDir, "generate_coverletter_docx.js")} "${clMd}" "${clDocx}"`);

    const size = fs.statSync(clDocx).size;
    assert.ok(size > 1000, `Cover letter docx too small (${size}), likely broken`);
  });
});
```

- [ ] **Step 2: Run integration tests to verify they fail**

Run: `bun test tests/frontmatter-docx.test.js`
Expected: FAIL — frontmatter block corrupts the resume parser (name becomes `---` or similar)

- [ ] **Step 3: Update generate_resume_docx.js to strip frontmatter**

In `scripts/generate_resume_docx.js`, change line 455:

```js
// Before:
  const md = fs.readFileSync(inputPath, "utf8");

// After:
  const { parseFrontmatter } = require("./lib/frontmatter");
  const md = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;
```

- [ ] **Step 4: Update generate_ats_resume_docx.js to strip frontmatter**

In `scripts/generate_ats_resume_docx.js`, change line 407:

```js
// Before:
  const md = fs.readFileSync(inputPath, "utf8");

// After:
  const { parseFrontmatter } = require("./lib/frontmatter");
  const md = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;
```

- [ ] **Step 5: Update generate_coverletter_docx.js to strip frontmatter**

In `scripts/generate_coverletter_docx.js`, change line 27:

```js
// Before:
const raw = fs.readFileSync(inputPath, "utf8");

// After:
const { parseFrontmatter } = require("./lib/frontmatter");
const raw = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;
```

- [ ] **Step 6: Run integration tests to verify they pass**

Run: `bun test tests/frontmatter-docx.test.js`
Expected: All tests PASS

- [ ] **Step 7: Run full test suite to check for regressions**

Run: `bun test`
Expected: All existing tests still PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/generate_resume_docx.js scripts/generate_ats_resume_docx.js scripts/generate_coverletter_docx.js tests/frontmatter-docx.test.js
git commit -m "feat: strip frontmatter in docx generation scripts"
```

---

### Task 4: Shared Skill Module

**Files:**
- Create: `skills/_shared/frontmatter.md`

- [ ] **Step 1: Write the shared frontmatter module**

```markdown
# Frontmatter — Structured Metadata for Skill Output Files

All per-company skill output files include a YAML frontmatter block before
the markdown body. This gives downstream skills structured, parseable metadata
without relying on header names or prose conventions.

## Common Base Fields

Every skill output file includes these fields:

| Field | Type | Description |
|-------|------|-------------|
| `skill` | string | Producing skill name (e.g., `company-research`, `resume-tailor`, `cover-letter`) |
| `company` | string | Company display name |
| `slug` | string | Company slug (directory name in `output/`) |
| `role` | string | Role title from the job posting |
| `url` | string | Job posting URL |
| `generated` | date | Date this file was generated (YYYY-MM-DD) |

## Type-Specific Fields

### company-research

| Field | Type | Description |
|-------|------|-------------|
| `rating` | integer 1-5 | Overall fit rating from research scoring |
| `remote` | boolean | Whether the role is remote-eligible |
| `positioning_count` | integer | Number of positioning bullets in the brief |
| `gaps_count` | integer | Number of gaps/open questions |

### resume-tailor

| Field | Type | Description |
|-------|------|-------------|
| `research_date` | date | `generated` date from the company-research brief used (if any) |
| `requirements_matched` | integer | Number of job requirements matched to accomplishments |

### cover-letter

| Field | Type | Description |
|-------|------|-------------|
| `word_count` | integer | Word count of the cover letter body |

## Writing Frontmatter (Producers)

When writing a skill output file, include the frontmatter block before the
markdown body. Use `---` delimiters. Quote any value that contains a colon.

Example:

    ---
    skill: company-research
    company: Natera
    slug: natera
    role: VP of Engineering, UX/Commercial Applications
    url: "https://job-boards.greenhouse.io/natera/jobs/5814300004"
    generated: 2026-04-08
    rating: 4
    remote: true
    positioning_count: 3
    gaps_count: 2
    ---

    # Natera — Research Brief
    ...

## Reading Frontmatter (Consumers)

When reading another skill's output file, check the frontmatter block first:

1. If the file starts with `---`, read the YAML block up to the closing `---`
2. Use frontmatter fields for routing decisions:
   - `generated` — is this research stale? (older than 7 days = suggest re-running)
   - `rating` — should the candidate prioritize this company?
   - `positioning_count` — does the brief have positioning data to use?
3. Then read the prose body for content (Positioning section, Gaps, etc.)

If the file does NOT start with `---`, treat it as a legacy file with no
frontmatter — proceed with header-based reading. This ensures backward
compatibility with files generated before frontmatter was added.
```

- [ ] **Step 2: Commit**

```bash
git add skills/_shared/frontmatter.md
git commit -m "docs: add shared frontmatter skill module with schema contract"
```

---

### Task 5: Update company-research Skill Instructions

**Files:**
- Modify: `skills/company-research/SKILL.md:56-89` (Phase 3 — Output Brief)

- [ ] **Step 1: Add frontmatter reference and update brief template**

In `skills/company-research/SKILL.md`, replace the Phase 3 Output Brief section.

Find:
```markdown
## Phase 3 — Output Brief

Write the research brief to `output/{company-slug}/company-research.md`.

If `output/{company-slug}/` does not exist, create the directory first.

### Brief Structure

Use this exact structure:

```markdown
# {Company Name} — Research Brief

**Date**: {YYYY-MM-DD}
**Role**: {Title from posting}
**URL**: {Original posting URL}
```

Replace with:
````markdown
## Phase 3 — Output Brief

Read `skills/_shared/frontmatter.md` for the schema contract.

Write the research brief to `output/{company-slug}/company-research.md`.

If `output/{company-slug}/` does not exist, create the directory first.

### Brief Structure

Use this exact structure. The frontmatter block provides structured metadata;
the body contains the research narrative.

```markdown
---
skill: company-research
company: {Company Name}
slug: {company-slug}
role: {Title from posting}
url: "{Original posting URL}"
generated: {YYYY-MM-DD}
rating: {1-5 fit rating}
remote: {true/false}
positioning_count: {number of positioning bullets written below}
gaps_count: {number of gaps/questions written below}
---

# {Company Name} — Research Brief
```
````

The inline `**Date**:`, `**Role**:`, `**URL**:` lines are removed — that
metadata now lives in frontmatter.

- [ ] **Step 2: Verify no broken references in the file**

Read the full updated file and confirm all phase references, section headers, and
cross-references to other shared modules are intact.

- [ ] **Step 3: Commit**

```bash
git add skills/company-research/SKILL.md
git commit -m "feat: add frontmatter to company-research output template"
```

---

### Task 6: Update resume-tailor Skill Instructions

**Files:**
- Modify: `skills/resume-tailor/SKILL.md:38-46` (Company Research Reuse section)
- Modify: `skills/resume-tailor/SKILL.md:57-65` (Phase 3 output section)

- [ ] **Step 1: Update Company Research Reuse section to read frontmatter**

In `skills/resume-tailor/SKILL.md`, find the "Company Research Reuse" section:

```markdown
## Company Research Reuse

After extracting the company name and deriving `{company-slug}` (see Phase 1),
check for `output/{company-slug}/company-research.md`:

- **If exists**: Read it. Use the Positioning section and company context to
  inform accomplishment scoring. Note the brief's date in the decisions summary.
- **If not exists**: Fetch the job posting URL directly. Extract requirements
  from the posting content. Optionally suggest: "I can research {Company} first
  for better context — want me to run company-research?"
```

Replace with:

```markdown
## Company Research Reuse

After extracting the company name and deriving `{company-slug}` (see Phase 1),
check for `output/{company-slug}/company-research.md`:

- **If exists**: Read the file. Check the frontmatter block first (see
  `skills/_shared/frontmatter.md`):
  - `generated` — if older than 7 days, suggest re-running company-research
  - `rating` — note the fit rating in the decisions summary
  - Then read the Positioning section in the body to inform accomplishment scoring.
- **If not exists**: Fetch the job posting URL directly. Extract requirements
  from the posting content. Optionally suggest: "I can research {Company} first
  for better context — want me to run company-research?"
```

- [ ] **Step 2: Add frontmatter to resume output template**

In the Phase 3 section, find:

```markdown
### Step 3a: Write the Tailored Markdown

Write to `output/{company-slug}/{Name}_Resume_{Company}.md` where `{Name}`
is from `config/candidate.md` with spaces replaced by underscores, and
`{Company}` is the display name with spaces replaced by underscores and
special characters removed (e.g., "Maven Clinic" → `Maven_Clinic`).

Follow the markdown structure and content rules in
`skills/resume-tailor/tailoring-rules.md` exactly — the parser is rigid.
```

Replace with:

```markdown
### Step 3a: Write the Tailored Markdown

Write to `output/{company-slug}/{Name}_Resume_{Company}.md` where `{Name}`
is from `config/candidate.md` with spaces replaced by underscores, and
`{Company}` is the display name with spaces replaced by underscores and
special characters removed (e.g., "Maven Clinic" → `Maven_Clinic`).

Include a frontmatter block before the resume content (see
`skills/_shared/frontmatter.md` for the schema). The `research_date` field
is the `generated` date from the company-research brief, if one was used.

Follow the markdown structure and content rules in
`skills/resume-tailor/tailoring-rules.md` exactly — the parser is rigid.
The docx generation script strips frontmatter automatically before parsing.
```

- [ ] **Step 3: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat: add frontmatter to resume-tailor instructions"
```

---

### Task 7: Update cover-letter Skill Instructions

**Files:**
- Modify: `skills/cover-letter/SKILL.md:27-29` (Research Phase)
- Modify: `skills/cover-letter/SKILL.md:94-109` (Output section)

- [ ] **Step 1: Update Research Phase to read frontmatter**

In `skills/cover-letter/SKILL.md`, find:

```markdown
Check if a `why-this-company` output already exists for this company
(`output/{company-slug}/`). If so, read it to avoid duplicating research.
```

Replace with:

```markdown
Check if a `why-this-company` output already exists for this company
(`output/{company-slug}/`). If so, read it to avoid duplicating research.

Also check for `output/{company-slug}/company-research.md`. If it exists,
read its frontmatter (see `skills/_shared/frontmatter.md`):
- `generated` — if older than 7 days, note staleness in output
- `rating` — use for context on company fit
Then read the prose body for positioning context.
```

- [ ] **Step 2: Add frontmatter to cover letter output**

In the Output section, find:

```markdown
1. Write the cover letter source:
   ```
   output/{company-slug}/{Name}_CoverLetter_{Company}.md
   ```
   Where `{Name}` is from `config/candidate.md` with spaces replaced by underscores.
```

Replace with:

```markdown
1. Write the cover letter source:
   ```
   output/{company-slug}/{Name}_CoverLetter_{Company}.md
   ```
   Where `{Name}` is from `config/candidate.md` with spaces replaced by underscores.

   Include a frontmatter block before the letter body (see
   `skills/_shared/frontmatter.md` for the schema). The `word_count` field is
   the word count of the letter body (excluding frontmatter). The docx
   generation script strips frontmatter automatically before parsing.
```

- [ ] **Step 3: Commit**

```bash
git add skills/cover-letter/SKILL.md
git commit -m "feat: add frontmatter to cover-letter instructions"
```

---

### Task 8: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `bun test`
Expected: All tests PASS (unit + integration)

- [ ] **Step 2: Validate no broken cross-references in skill files**

Run the link validator if one exists:

```bash
bun scripts/validate-links.js 2>/dev/null || echo "no link validator"
```

Check that `skills/_shared/frontmatter.md` is referenced correctly from all
three updated skill files by grepping:

```bash
grep -r "frontmatter.md" skills/
```

Expected: hits in `company-research/SKILL.md`, `resume-tailor/SKILL.md`,
`cover-letter/SKILL.md`, and `_shared/frontmatter.md` itself.

- [ ] **Step 3: Final commit (if any fixups needed)**

Only if previous steps revealed issues that needed fixing.