"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SCRIPTS_DIR = path.resolve(__dirname, "../scripts");

const RESUME_NO_FRONTMATTER = `# Chris Cantu
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

const FRONTMATTER_BLOCK = `---
skill: resume-tailor
company: TestCo
slug: testco
role: VP Engineering
url: https://example.com/jobs/123
generated: 2026-04-09
research_date: 2026-04-08
requirements_matched: 3
---
`;

const RESUME_WITH_FRONTMATTER = FRONTMATTER_BLOCK + RESUME_NO_FRONTMATTER;
const RESUME_WITH_FRONTMATTER_AND_BLANK_LINE = FRONTMATTER_BLOCK + "\n" + RESUME_NO_FRONTMATTER;

const COVER_LETTER_WITH_FRONTMATTER = `---
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

Chris Cantu
`;

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "docx-test-"));
}

function writeFile(dir, name, content) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

// A .docx is a zip; word/document.xml holds the visible body text. Extracting
// it lets tests assert on actual rendered content (e.g. "is the candidate name
// present?") instead of relying on file-size heuristics.
function extractDocumentXml(docxPath) {
  return execSync(`unzip -p "${docxPath}" word/document.xml`, { encoding: "utf8" });
}

test("resume docx: no frontmatter succeeds and produces a non-empty file", () => {
  const dir = makeTempDir();
  try {
    const inputPath = writeFile(dir, "resume.md", RESUME_NO_FRONTMATTER);
    const outputPath = path.join(dir, "resume.docx");

    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_resume_docx.js")}" "${inputPath}" "${outputPath}"`,
      { stdio: "pipe" }
    );

    const stat = fs.statSync(outputPath);
    assert.ok(stat.size > 1000, `Expected docx > 1000 bytes, got ${stat.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resume docx: with frontmatter succeeds and produces similar-sized file (within 1%)", () => {
  const dir = makeTempDir();
  try {
    const noFmInput = writeFile(dir, "resume-no-fm.md", RESUME_NO_FRONTMATTER);
    const noFmOutput = path.join(dir, "resume-no-fm.docx");
    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_resume_docx.js")}" "${noFmInput}" "${noFmOutput}"`,
      { stdio: "pipe" }
    );

    const withFmInput = writeFile(dir, "resume-with-fm.md", RESUME_WITH_FRONTMATTER);
    const withFmOutput = path.join(dir, "resume-with-fm.docx");
    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_resume_docx.js")}" "${withFmInput}" "${withFmOutput}"`,
      { stdio: "pipe" }
    );

    const sizeNoFm = fs.statSync(noFmOutput).size;
    const sizeWithFm = fs.statSync(withFmOutput).size;

    const diff = Math.abs(sizeNoFm - sizeWithFm);
    const maxSize = Math.max(sizeNoFm, sizeWithFm);
    const pct = diff / maxSize;

    assert.ok(
      pct <= 0.01,
      `File sizes differ by ${(pct * 100).toFixed(2)}% (no-fm: ${sizeNoFm}, with-fm: ${sizeWithFm}) — expected within 1%`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("resume docx: blank line between frontmatter and # heading preserves header block", () => {
  const dir = makeTempDir();
  try {
    const withBlankInput = writeFile(dir, "resume-with-blank.md", RESUME_WITH_FRONTMATTER_AND_BLANK_LINE);
    const withBlankOutput = path.join(dir, "resume-with-blank.docx");
    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_resume_docx.js")}" "${withBlankInput}" "${withBlankOutput}"`,
      { stdio: "pipe" }
    );

    const documentXml = extractDocumentXml(withBlankOutput);
    assert.ok(documentXml.includes("Chris Cantu"), "Candidate name missing from document body — header block was dropped");
    assert.ok(documentXml.includes("Engineering Leader"), "Tagline missing from document body");
    assert.ok(documentXml.includes("chris@example.com"), "Contact line missing from document body");
    assert.ok(documentXml.includes("Experienced engineering leader"), "Summary missing from document body");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ATS resume docx: blank line between frontmatter and # heading preserves header block", () => {
  const dir = makeTempDir();
  try {
    const withBlankInput = writeFile(dir, "ats-resume-with-blank.md", RESUME_WITH_FRONTMATTER_AND_BLANK_LINE);
    const withBlankOutput = path.join(dir, "ats-resume-with-blank.docx");
    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_ats_resume_docx.js")}" "${withBlankInput}" "${withBlankOutput}"`,
      { stdio: "pipe" }
    );

    const documentXml = extractDocumentXml(withBlankOutput);
    assert.ok(documentXml.includes("Chris Cantu"), "Candidate name missing from ATS document body — header block was dropped");
    assert.ok(documentXml.includes("Engineering Leader"), "Tagline missing from ATS document body");
    assert.ok(documentXml.includes("chris@example.com"), "Contact line missing from ATS document body");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cover letter docx: with frontmatter succeeds and produces file > 1000 bytes", () => {
  const dir = makeTempDir();
  try {
    const inputPath = writeFile(dir, "cover-letter.md", COVER_LETTER_WITH_FRONTMATTER);
    const outputPath = path.join(dir, "cover-letter.docx");

    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_coverletter_docx.js")}" "${inputPath}" "${outputPath}"`,
      { stdio: "pipe" }
    );

    const stat = fs.statSync(outputPath);
    assert.ok(stat.size > 1000, `Expected docx > 1000 bytes, got ${stat.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ATS resume docx: with frontmatter succeeds and produces file > 1000 bytes", () => {
  const dir = makeTempDir();
  try {
    const inputPath = writeFile(dir, "ats-resume.md", RESUME_WITH_FRONTMATTER);
    const outputPath = path.join(dir, "ats-resume.docx");

    execSync(
      `bun "${path.join(SCRIPTS_DIR, "generate_ats_resume_docx.js")}" "${inputPath}" "${outputPath}"`,
      { stdio: "pipe" }
    );

    const stat = fs.statSync(outputPath);
    assert.ok(stat.size > 1000, `Expected docx > 1000 bytes, got ${stat.size}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
