# ATS Resume Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `resume-tailor` skill end-to-end to produce ATS-safe, ≤2-page, role-tailored `.docx` resumes per recruiter feedback (2026-05-01), driven by a markdown canonical source and a Word template.

**Architecture:** Markdown canonical (`references/resume.md`) + skills master (`references/skills-master.md`) + Word template (`references/resume-template.docx`) → TypeScript pipeline (parse, score, select, compose, drop) → `anthropic-skills:docx` render → fish page-count verify → drop-iterate loop. Single integration point with the docx skill; all styling lives in template.

**Tech Stack:** TypeScript (Bun test runner), fish (page-count tool), markdown (canonical), Word/docx (template + output), `anthropic-skills:docx` (render), LibreOffice headless + poppler (page count).

**Spec:** `docs/superpowers/specs/2026-05-01-ats-resume-template-design.md`

---

## Phase 0 — Foundation

### Task 0.1: Author `references/skills-master.md`

**Files:**
- Create: `references/skills-master.md`

- [ ] **Step 1: Inventory current skills.**

Read `references/resume.pdf` Skills section. Enumerate every distinct skill across all five current categories (Leadership / Platform / DevOps / Technical / Tools).

- [ ] **Step 2: Tag each skill `[always]` or `[situational]`.**

`[always]` ≥ 5 entries. These are the floor that appears on every tailored resume. `[situational]` = JD-overlay candidates.

- [ ] **Step 3: Write the file.**

Format:

```markdown
# Skills Master

> Source for the Skills section in tailored resumes. Renderer reads `[always]`-tagged
> entries first (5 floor slots), then fills 5 JD-overlay slots from `[situational]`
> entries by relevance. Total cap: 10. Pipe-delimited in output.

## Leadership

- Delivery Transformation [always]
- Multinational Team Leadership [always]
- Engineering Strategy [always]
- Stakeholder Management [situational]
- OKRs [situational]
- ShapeUp [situational]
- Agile [situational]

## Platform

- Platform Engineering [always]
- Design Systems [situational]
- Micro-Frontends [situational]
- Monolith-to-Microservices Migration [situational]
- System Architecture [situational]

## DevOps

- CI/CD Optimization [always]
- Quality Automation [situational]
- Feature Flags [situational]
- Progressive Rollouts [situational]
- Chaos Engineering [situational]
- Observability [situational]
- SRE [situational]

## Technical

- React [situational]
- TypeScript [situational]
- JavaScript [situational]
- GraphQL [situational]
- Node.js [situational]
- AWS [situational]
- Accessibility (WCAG) [situational]
- A/B Testing [situational]
- Automated Testing [situational]

## Tools

- GitHub [situational]
- Jenkins [situational]
- Docker [situational]
- Kubernetes [situational]
- Terraform [situational]
- Datadog [situational]
- Grafana [situational]
```

Verify: at least 5 `[always]` tags. Open question: confirm the floor list with user before committing.

- [ ] **Step 4: Commit.**

```bash
git add references/skills-master.md
git commit -m "feat(resume): add skills master with always/situational tags"
```

---

### Task 0.2: Extract canonical resume to `references/resume.md`

**Files:**
- Create: `references/resume.md`
- Reference: `references/resume.pdf` (read-only source)

- [ ] **Step 1: Convert PDF to text.**

```fish
pdftotext -layout references/resume.pdf /tmp/resume-raw.txt
```

If `pdftotext` missing: `brew install poppler`.

- [ ] **Step 2: Hand-author `references/resume.md`** matching the schema in the design spec section "Markdown Schema." Every section. Every bullet from canonical resume.

Frontmatter (canonical only — tailored outputs add company/role/etc.):

```markdown
---
template_version: 1
canonical_version: 2026-05-01
---
```

Body structure:

```markdown
# Christopher Cantu

**Senior Engineering Leader | Delivery Transformation Specialist**

christopher.cantu@gmail.com | Austin, TX | linkedin.com/in/christophermcantu

[Summary — recruiter draft, verbatim. 4 sentences.]

## Key Accomplishments

- **Revenue Impact** — Delivered $18M+ in business value through delivery transformation and international expansion | **Impact:** Unlocked European/Asian market revenue ahead of plan
- **Delivery Excellence** — Transformed CI/CD from 1-5% to 95-99% reliability, enabling consistent fast delivery | **Impact:** Enabled 3x faster product release cadence at scale
- **Speed to Market** — Accelerated deployment from 6 months to minutes; achieved 20x release velocity increase | **Impact:** Compounded shipping velocity across all UI applications
- **Platform Scaling** — 85% design system adoption across 185 repos in 6 months via automation | **Impact:** Fastest design-system rollout in company history
- **Cost Optimization** — $10M+ operational savings through automation and platform consolidation | **Impact:** Freed engineering capacity for product investment
- **Global Leadership** — Scaled teams to multinational organizations across US, Europe, Africa, and Asia | **Impact:** Established 24/5 follow-the-sun delivery for global product

## Skills

[All entries from skills-master.md, comma-replaced with " | ". This is the FULL list — tailoring picks 10. Canonical preserves all.]

## Professional Experience

### Director of Engineering | Procore Technologies

*Austin, TX (Hybrid) | September 2023 – April 2026 | 60 engineers, 8 international teams*

- Led $50M+ frontend modernization across 125+ repositories and 65+ global teams; led 60 engineers across 8 international teams through delivery transformation, platform consolidation, and quality automation. **Impact:** $12M+ revenue unlocked in European/Asian markets within first year.
- Reduced localization deployment from 6 months to minutes, unlocking $12M+ revenue in European/Asian markets within first year. **Impact:** Localization stopped being a release blocker for international launches.
- Achieved 85% design system adoption across 185 repositories in 6 months via AI-driven automation, fastest in company history. **Impact:** Component-level UI consistency across the entire product suite.
- Created contextual, customizable platform enabling product re-envisioning and supporting AI-powered product initiatives. **Impact:** Unblocked AI roadmap for the next product cycle.
- Partnered with VP of Product, VP of Engineering, and VP of Customer Success on technology strategy for international growth. **Impact:** Aligned cross-functional roadmap across three regions.

### Director of Front End Platforms | Babylon Health

*Austin, TX (Remote) | September 2021 – August 2023 | 30 engineers, 5 platform teams*

- Led 30 engineers across 5 platform teams (US, Europe) to modernize testing processes and automate delivery capabilities. **Impact:** Product teams shipped independently at scale.
- Transformed CI/CD from 1% to 95% success rate by modernizing testing and automating delivery. **Impact:** Daily releases became routine instead of weekly events.
- Pioneered weekly mobile release cadence through automated testing, feature flags, and progressive rollouts. **Impact:** Mobile feature velocity matched web delivery cadence.
- Architected micro-frontend infrastructure deployable as single artifact, enabling 3x faster feature delivery with WCAG compliance. **Impact:** WCAG-compliant accessibility baked into the platform.

### Senior Software Engineering Manager / Director of Engineering | Vrbo (Expedia Group)

*Austin, TX | November 2016 – February 2021*

As Director of Engineering (July 2020 – February 2021):

- Led 25+ engineers across 5 international platform teams (frontend/backend architecture, GraphQL, SRE, development tooling) supporting $2.4B in booking revenue. **Impact:** Platform reliability sustained record peak booking periods.
- Converted organization to ShapeUp methodology, improving team engagement, delivery velocity, and measurable business impact. **Impact:** Engagement scores rose alongside delivery throughput.
- Established architectural patterns and design standards adopted across Expedia's enterprise engineering organization. **Impact:** Reduced cross-org architectural divergence at parent-company scale.
- Led performance testing and chaos engineering initiatives ensuring uninterrupted service during peak booking periods. **Impact:** Zero customer-visible outages during seasonal peaks.

As Senior Software Engineering Manager (November 2016 – June 2020):

- Led migration from monolithic to microservices architecture, enabling rapid A/B testing that generated $8M+ revenue growth. **Impact:** A/B-test cycle time dropped from quarterly to weekly.
- Achieved 20x increase in release velocity by instituting modern CI/CD practices including automated testing, branching strategies, and deployment automation across all UI applications. **Impact:** Hourly releases at sustained quality.
- Established customer-centric observability platform with automated monitoring and alerting methodology, scaling production system support as platform grew. **Impact:** Mean time to detection cut sharply across all UI surfaces.
- Pioneered WCAG-compliant accessibility with sustainable automation, enabling visually impaired customers to shop on vrbo.com through tailored experiences. **Impact:** Accessibility coverage maintained without ongoing manual audits.
- Successfully executed multiple large-scale system migrations while maintaining positive conversion and engagement metrics. **Impact:** Migrations did not degrade revenue KPIs.

## Education

**Master of Science in Information Systems | Bachelor of Business Administration**

Baylor University
```

Verify: every bullet has `**Impact:**`. Skills line is single line, ` | `-delimited. No `Challenge:/Action:/Results:` literals.

- [ ] **Step 3: Schema sanity check.**

```fish
grep -c '\*\*Impact:\*\*' references/resume.md
```

Expected: count equals total bullet count in Professional Experience section. Any mismatch = bullet missing Impact; fix before commit.

- [ ] **Step 4: Commit.**

```bash
git add references/resume.md
git commit -m "feat(resume): promote markdown to canonical with Impact clauses"
```

---

### Task 0.3: Author `references/resume-template.docx`

**Files:**
- Create: `references/resume-template.docx` (binary)

- [ ] **Step 1: Open Word.** Create a blank document. Set page margins to 0.75in (Layout → Margins → Custom).

- [ ] **Step 2: Define named styles.** Each style listed below maps to one element type in the render contract. Define them in Word's Styles pane (Format → Style → New).

| Style name | Font | Size | Color | Other |
|---|---|---|---|---|
| Heading 1 | Calibri | 22pt | `#1F3A5F` (deep navy) | Bold, centered, 6pt after |
| Tagline | Calibri | 12pt | `#1F3A5F` | Italic, centered, 0pt before, 4pt after |
| Contact | Calibri | 10pt | `#3A3A3A` | Centered, 0pt before, 12pt after |
| Heading 2 | Calibri | 14pt | `#1F3A5F` | Bold, all caps, 0.5pt bottom border (navy), 8pt before, 4pt after |
| Heading 3 | Calibri | 12pt | `#1F3A5F` | Bold, 6pt before, 2pt after |
| Role Meta | Calibri | 10pt | `#5A5A5A` | Italic, 0pt before, 4pt after |
| List Bullet | Calibri | 11pt | `#000000` | Bullet glyph `•`, 0.15in indent, 2pt before, 2pt after, 1.0 line height |
| Skills Line | Calibri | 11pt | `#000000` | 0pt before, 8pt after |
| Accomplishment | Calibri | 11pt | `#000000` | Bullet glyph `•`, 0.15in indent, 2pt before, 2pt after |
| Body Text (Summary) | Calibri | 11pt | `#000000` | Justified, 0pt before, 8pt after |

- [ ] **Step 3: Save as `references/resume-template.docx`.** No content in body — only the styles.

- [ ] **Step 4: Manual smoke test.** Add a sample paragraph in each style; render via the docx skill against a stub `.md`; verify the rendered output picks up the styles.

- [ ] **Step 5: Strip the smoke-test paragraphs** so the template is empty-bodied with named styles only.

- [ ] **Step 6: Commit.**

```bash
git add references/resume-template.docx
git commit -m "feat(resume): add Word template with named styles for ATS resume"
```

---

## Phase 1 — Page-Count Tooling

### Task 1.1: Create `scripts/resume-page-count.fish`

**Files:**
- Create: `scripts/resume-page-count.fish`

- [ ] **Step 1: Write the script.**

```fish
#!/usr/bin/env fish
# Usage: resume-page-count.fish <docx-path>
# Outputs integer page count on success.
# Exit codes: 0 success | 1 missing arg | 2 soffice failed | 3 pdfinfo failed

if test (count $argv) -lt 1
    echo "usage: resume-page-count.fish <docx-path>" >&2
    exit 1
end

set docx $argv[1]

if not test -f $docx
    echo "file not found: $docx" >&2
    exit 1
end

set tmpdir (mktemp -d)
soffice --headless --convert-to pdf --outdir $tmpdir $docx > /dev/null 2>&1
or begin
    rm -rf $tmpdir
    echo "soffice conversion failed for $docx" >&2
    exit 2
end

set pdf $tmpdir/(basename $docx .docx).pdf
set pages (pdfinfo $pdf 2>/dev/null | grep -E '^Pages:' | awk '{print $2}')
rm -rf $tmpdir

if test -z "$pages"
    echo "pdfinfo could not read page count" >&2
    exit 3
end

echo $pages
```

- [ ] **Step 2: Make executable.**

```fish
chmod +x scripts/resume-page-count.fish
```

- [ ] **Step 3: Manual smoke test.** Run against any existing `.docx`:

```fish
scripts/resume-page-count.fish output/{some-existing-tailored-resume}.docx
```

Expected: integer ≥ 1 on stdout, exit 0.

- [ ] **Step 4: Commit.**

```bash
git add scripts/resume-page-count.fish
git commit -m "feat(resume): add page-count tool via soffice + pdfinfo"
```

---

### Task 1.2: TypeScript wrapper + integration test for page-count

**Files:**
- Create: `src/resume-tailor/page-count.ts`
- Create: `tests/resume-tailor/page-count.test.ts`
- Test fixtures: `tests/resume-tailor/fixtures/one-page.docx`, `tests/resume-tailor/fixtures/three-page.docx`

- [ ] **Step 1: Generate fixtures.** Hand-author two minimal docx files (in Word or via a one-off script) of known page counts: a 1-pager and a 3-pager. Commit them under `tests/resume-tailor/fixtures/`.

- [ ] **Step 2: Write the failing test.**

```typescript
// tests/resume-tailor/page-count.test.ts
import { describe, expect, test } from 'bun:test';
import { pageCount } from '../../src/resume-tailor/page-count';
import { resolve } from 'node:path';

describe('pageCount', () => {
  test('reports 1 for a one-page docx', async () => {
    const fixture = resolve(__dirname, 'fixtures/one-page.docx');
    expect(await pageCount(fixture)).toBe(1);
  });

  test('reports 3 for a three-page docx', async () => {
    const fixture = resolve(__dirname, 'fixtures/three-page.docx');
    expect(await pageCount(fixture)).toBe(3);
  });

  test('throws on missing file', async () => {
    expect(pageCount('/tmp/does-not-exist-xyz.docx')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test (expect FAIL).**

```bash
bun test tests/resume-tailor/page-count.test.ts
```

Expected: FAIL with "Cannot find module '../../src/resume-tailor/page-count'".

- [ ] **Step 4: Implement.**

```typescript
// src/resume-tailor/page-count.ts
import { spawn } from 'bun';

export async function pageCount(docxPath: string): Promise<number> {
  const proc = spawn(['scripts/resume-page-count.fish', docxPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`page-count failed (exit ${exitCode}): ${err.trim()}`);
  }
  const out = await new Response(proc.stdout).text();
  const n = parseInt(out.trim(), 10);
  if (!Number.isFinite(n)) {
    throw new Error(`page-count returned non-integer: ${out}`);
  }
  return n;
}
```

- [ ] **Step 5: Run test (expect PASS).**

```bash
bun test tests/resume-tailor/page-count.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit.**

```bash
git add src/resume-tailor/page-count.ts tests/resume-tailor/page-count.test.ts tests/resume-tailor/fixtures/one-page.docx tests/resume-tailor/fixtures/three-page.docx
git commit -m "feat(resume): TS wrapper + integration test for page-count"
```

---

## Phase 2 — Parse Layer

### Task 2.1: Parse `references/resume.md` into AST

**Files:**
- Create: `src/resume-tailor/parse-canonical.ts`
- Create: `tests/resume-tailor/parse-canonical.test.ts`

- [ ] **Step 1: Define the AST type.**

```typescript
// src/resume-tailor/types.ts
export type ResumeAST = {
  frontmatter: { template_version: number; canonical_version: string };
  header: { name: string; tagline: string; contact: string };
  summary: string;
  keyAccomplishments: KeyAccomplishment[];
  skills: string[];
  roles: Role[];
  education: { degrees: string; school: string };
};

export type KeyAccomplishment = {
  label: string;
  description: string;
  impact: string;
};

export type Role = {
  title: string;
  company: string;
  meta: string;
  subRoles?: SubRole[];
  bullets: Bullet[];
};

export type SubRole = {
  label: string;
  bullets: Bullet[];
};

export type Bullet = {
  text: string;
  impact: string;
};
```

- [ ] **Step 2: Write failing tests.**

```typescript
// tests/resume-tailor/parse-canonical.test.ts
import { describe, expect, test } from 'bun:test';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = readFileSync(resolve(__dirname, 'fixtures/canonical-sample.md'), 'utf8');

describe('parseCanonical', () => {
  test('parses frontmatter', () => {
    const ast = parseCanonical(fixture);
    expect(ast.frontmatter.template_version).toBe(1);
    expect(ast.frontmatter.canonical_version).toBe('2026-05-01');
  });

  test('parses header', () => {
    const ast = parseCanonical(fixture);
    expect(ast.header.name).toBe('Christopher Cantu');
    expect(ast.header.tagline).toContain('Senior Engineering Leader');
    expect(ast.header.contact).toContain('christopher.cantu@gmail.com');
  });

  test('parses summary', () => {
    const ast = parseCanonical(fixture);
    expect(ast.summary).toContain('Senior Engineering Leader specializing');
  });

  test('parses 6 key accomplishments with label/description/impact', () => {
    const ast = parseCanonical(fixture);
    expect(ast.keyAccomplishments).toHaveLength(6);
    expect(ast.keyAccomplishments[0].label).toBe('Revenue Impact');
    expect(ast.keyAccomplishments[0].impact).toContain('European/Asian');
  });

  test('parses skills as array', () => {
    const ast = parseCanonical(fixture);
    expect(Array.isArray(ast.skills)).toBe(true);
    expect(ast.skills.length).toBeGreaterThan(10);
    expect(ast.skills).toContain('Delivery Transformation');
  });

  test('parses roles in order, newest first', () => {
    const ast = parseCanonical(fixture);
    expect(ast.roles[0].company).toBe('Procore Technologies');
    expect(ast.roles[1].company).toBe('Babylon Health');
    expect(ast.roles[2].company).toContain('Vrbo');
  });

  test('parses sub-roles for Vrbo', () => {
    const ast = parseCanonical(fixture);
    const vrbo = ast.roles[2];
    expect(vrbo.subRoles).toHaveLength(2);
    expect(vrbo.subRoles![0].label).toContain('Director of Engineering');
  });

  test('every bullet has impact text', () => {
    const ast = parseCanonical(fixture);
    for (const role of ast.roles) {
      const allBullets = role.subRoles
        ? role.subRoles.flatMap((s) => s.bullets)
        : role.bullets;
      for (const b of allBullets) {
        expect(b.impact.length).toBeGreaterThan(0);
      }
    }
  });

  test('parses education', () => {
    const ast = parseCanonical(fixture);
    expect(ast.education.degrees).toContain('Master of Science');
    expect(ast.education.school).toBe('Baylor University');
  });
});
```

- [ ] **Step 3: Build the fixture.** Copy `references/resume.md` into `tests/resume-tailor/fixtures/canonical-sample.md` (snapshot of canonical at this commit; updates require a deliberate fixture refresh).

- [ ] **Step 4: Run tests (expect FAIL).**

```bash
bun test tests/resume-tailor/parse-canonical.test.ts
```

Expected: all FAIL (module not found).

- [ ] **Step 5: Implement parser.**

```typescript
// src/resume-tailor/parse-canonical.ts
import type { ResumeAST, Bullet, Role, KeyAccomplishment, SubRole } from './types';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;
const SECTION_RE = /^## (.+)$/gm;

export function parseCanonical(md: string): ResumeAST {
  const fm = parseFrontmatter(md);
  const body = md.replace(FRONTMATTER_RE, '');
  const sections = splitSections(body);

  return {
    frontmatter: fm,
    header: parseHeader(sections.header),
    summary: parseSummary(sections.header),
    keyAccomplishments: parseKeyAccomplishments(sections['Key Accomplishments']),
    skills: parseSkills(sections['Skills']),
    roles: parseRoles(sections['Professional Experience']),
    education: parseEducation(sections['Education']),
  };
}

function parseFrontmatter(md: string) {
  const match = md.match(FRONTMATTER_RE);
  if (!match) throw new Error('frontmatter missing');
  const lines = match[1].split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const [k, ...rest] = line.split(':');
    if (!k) continue;
    result[k.trim()] = rest.join(':').trim();
  }
  return {
    template_version: parseInt(result.template_version, 10),
    canonical_version: result.canonical_version,
  };
}

function splitSections(body: string): Record<string, string> {
  // Header section runs from start until first `## `; subsequent sections keyed by H2.
  const out: Record<string, string> = {};
  const lines = body.split('\n');
  let current = 'header';
  let buf: string[] = [];
  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      out[current] = buf.join('\n').trim();
      current = h2[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  out[current] = buf.join('\n').trim();
  return out;
}

function parseHeader(headerSection: string) {
  const lines = headerSection.split('\n').filter((l) => l.trim());
  // Line 0: # Name
  // Line 1: **Tagline**
  // Line 2: contact (plain text)
  // Subsequent: summary paragraph(s)
  const name = lines[0].replace(/^# /, '').trim();
  const tagline = lines[1].replace(/^\*\*|\*\*$/g, '').trim();
  const contact = lines[2].trim();
  return { name, tagline, contact };
}

function parseSummary(headerSection: string) {
  const lines = headerSection.split('\n').filter((l) => l.trim());
  return lines.slice(3).join(' ').trim();
}

function parseKeyAccomplishments(section: string): KeyAccomplishment[] {
  return section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- **'))
    .map((line) => {
      const labelMatch = line.match(/^- \*\*(.+?)\*\* — (.+?)\s*\|\s*\*\*Impact:\*\*\s*(.+)$/);
      if (!labelMatch) {
        throw new Error(`key accomplishment malformed: ${line}`);
      }
      return {
        label: labelMatch[1].trim(),
        description: labelMatch[2].trim(),
        impact: labelMatch[3].trim(),
      };
    });
}

function parseSkills(section: string): string[] {
  const line = section.split('\n').find((l) => l.includes('|'));
  if (!line) throw new Error('skills line not found');
  return line.split('|').map((s) => s.trim()).filter(Boolean);
}

function parseRoles(section: string): Role[] {
  const roles: Role[] = [];
  const blocks = section.split(/^### /m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const heading = lines[0]; // "Title | Company"
    const [title, company] = heading.split(' | ').map((s) => s.trim());
    const meta = (lines.find((l) => l.startsWith('*')) ?? '').replace(/^\*|\*$/g, '').trim();
    const role: Role = { title, company, meta, bullets: [] };

    const subRolePattern = /^As (.+?):$/;
    const hasSubRoles = lines.some((l) => subRolePattern.test(l));
    if (hasSubRoles) {
      role.subRoles = [];
      let currentSub: SubRole | null = null;
      for (const line of lines) {
        const subMatch = line.match(subRolePattern);
        if (subMatch) {
          if (currentSub) role.subRoles.push(currentSub);
          currentSub = { label: subMatch[1], bullets: [] };
        } else if (currentSub && line.trim().startsWith('- ')) {
          currentSub.bullets.push(parseBullet(line));
        }
      }
      if (currentSub) role.subRoles.push(currentSub);
    } else {
      for (const line of lines) {
        if (line.trim().startsWith('- ')) {
          role.bullets.push(parseBullet(line));
        }
      }
    }
    roles.push(role);
  }
  return roles;
}

function parseBullet(line: string): Bullet {
  const trimmed = line.trim().replace(/^- /, '');
  const impactMatch = trimmed.match(/^(.+?)\s+\*\*Impact:\*\*\s+(.+)$/);
  if (!impactMatch) {
    throw new Error(`bullet missing **Impact:** clause: ${trimmed}`);
  }
  return {
    text: impactMatch[1].trim().replace(/\.$/, ''),
    impact: impactMatch[2].trim(),
  };
}

function parseEducation(section: string) {
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const degrees = lines[0].replace(/^\*\*|\*\*$/g, '');
  const school = lines[1];
  return { degrees, school };
}
```

- [ ] **Step 6: Run tests (expect PASS).**

```bash
bun test tests/resume-tailor/parse-canonical.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 7: Commit.**

```bash
git add src/resume-tailor/parse-canonical.ts src/resume-tailor/types.ts tests/resume-tailor/parse-canonical.test.ts tests/resume-tailor/fixtures/canonical-sample.md
git commit -m "feat(resume): markdown parser with bullet/Impact validation"
```

---

## Phase 3 — Selection Layer

### Task 3.1: Bullet relevance scoring

**Files:**
- Create: `src/resume-tailor/score-bullets.ts`
- Create: `tests/resume-tailor/score-bullets.test.ts`
- Create: `tests/resume-tailor/fixtures/jd-platform-vp.txt`

- [ ] **Step 1: Save a fixture JD.**

```text
# tests/resume-tailor/fixtures/jd-platform-vp.txt
We are hiring a VP of Engineering, Platform to scale our developer platform across
multiple international engineering teams. You will own CI/CD modernization, design
system adoption, and platform strategy. You will partner with product and customer
success leadership to drive a measurable increase in delivery velocity.

Requirements:
- 10+ years engineering leadership
- Experience scaling platforms across 50+ engineers
- Proven CI/CD transformation
- Design system and micro-frontend experience
- International team leadership
```

- [ ] **Step 2: Write failing test.**

```typescript
// tests/resume-tailor/score-bullets.test.ts
import { describe, expect, test } from 'bun:test';
import { scoreBullet, extractKeywords } from '../../src/resume-tailor/score-bullets';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const jd = readFileSync(resolve(__dirname, 'fixtures/jd-platform-vp.txt'), 'utf8');

describe('extractKeywords', () => {
  test('extracts platform-relevant terms', () => {
    const kws = extractKeywords(jd);
    expect(kws).toContain('platform');
    expect(kws).toContain('ci/cd');
    expect(kws).toContain('design system');
    expect(kws).toContain('international');
  });
});

describe('scoreBullet', () => {
  const kws = extractKeywords(jd);

  test('scores a high-relevance bullet > a low-relevance bullet', () => {
    const high = 'Achieved 85% design system adoption across 185 repositories via AI-driven automation.';
    const low = 'Pioneered WCAG-compliant accessibility with sustainable automation.';
    expect(scoreBullet(high, kws)).toBeGreaterThan(scoreBullet(low, kws));
  });

  test('returns 0 for an empty bullet', () => {
    expect(scoreBullet('', kws)).toBe(0);
  });

  test('higher score for multiple keyword matches', () => {
    const bullet = 'Led platform migration for international engineering teams modernizing CI/CD.';
    const score = scoreBullet(bullet, kws);
    expect(score).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 3: Run tests (expect FAIL).**

- [ ] **Step 4: Implement.**

```typescript
// src/resume-tailor/score-bullets.ts
const STOPWORDS = new Set([
  'the','a','an','and','or','of','for','to','in','on','at','by','with','as',
  'is','are','was','were','be','been','being','this','that','these','those',
  'we','you','they','it','its','our','your','their','i','my','me',
]);

const PHRASE_KEYWORDS = [
  'design system', 'micro-frontend', 'ci/cd', 'feature flags', 'progressive rollouts',
  'monolith to microservices', 'platform engineering', 'team leadership',
  'international team', 'delivery transformation', 'engineering strategy',
];

export function extractKeywords(jd: string): string[] {
  const lower = jd.toLowerCase();
  const phrases = PHRASE_KEYWORDS.filter((p) => lower.includes(p));
  const words = lower
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return Array.from(new Set([...phrases, ...words]));
}

export function scoreBullet(bullet: string, keywords: string[]): number {
  if (!bullet.trim()) return 0;
  const lower = bullet.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      // Multi-word keywords (phrase signals) count more.
      score += kw.includes(' ') || kw.includes('/') ? 2 : 1;
    }
  }
  return score;
}
```

- [ ] **Step 5: Run tests (expect PASS).**

- [ ] **Step 6: Commit.**

```bash
git add src/resume-tailor/score-bullets.ts tests/resume-tailor/score-bullets.test.ts tests/resume-tailor/fixtures/jd-platform-vp.txt
git commit -m "feat(resume): bullet relevance scoring against JD keywords"
```

---

### Task 3.2: Skills selection (5 floor + 5 JD-overlay)

**Files:**
- Create: `src/resume-tailor/select-skills.ts`
- Create: `tests/resume-tailor/select-skills.test.ts`

- [ ] **Step 1: Define the master loader.**

```typescript
// src/resume-tailor/skills-master.ts
export type SkillTag = 'always' | 'situational';
export type MasterSkill = { name: string; tag: SkillTag };

export function parseSkillsMaster(md: string): MasterSkill[] {
  const skills: MasterSkill[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^- (.+?) \[(always|situational)\]$/);
    if (m) skills.push({ name: m[1].trim(), tag: m[2] as SkillTag });
  }
  return skills;
}
```

- [ ] **Step 2: Write failing test.**

```typescript
// tests/resume-tailor/select-skills.test.ts
import { describe, expect, test } from 'bun:test';
import { selectSkills } from '../../src/resume-tailor/select-skills';
import { parseSkillsMaster } from '../../src/resume-tailor/skills-master';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const masterMd = readFileSync(resolve(__dirname, '../../references/skills-master.md'), 'utf8');
const master = parseSkillsMaster(masterMd);

describe('selectSkills', () => {
  test('returns exactly 10', () => {
    const out = selectSkills(master, ['platform', 'ci/cd', 'design system']);
    expect(out).toHaveLength(10);
  });

  test('first 5 are always-tagged floor', () => {
    const out = selectSkills(master, []);
    const floorTags = out.slice(0, 5).map((name) => master.find((m) => m.name === name)?.tag);
    expect(floorTags.every((t) => t === 'always')).toBe(true);
  });

  test('last 5 are JD-relevant when keywords match', () => {
    const out = selectSkills(master, ['design system', 'micro-frontend']);
    expect(out).toContain('Design Systems');
    expect(out).toContain('Micro-Frontends');
  });

  test('falls back to situational order when no JD match', () => {
    const out = selectSkills(master, ['nonsense-keyword-xyz']);
    expect(out).toHaveLength(10);
  });

  test('throws if floor < 5', () => {
    const tiny = [{ name: 'OnlyOne', tag: 'always' as const }];
    expect(() => selectSkills(tiny, [])).toThrow('floor');
  });

  test('does not duplicate', () => {
    const out = selectSkills(master, ['delivery transformation']); // already in floor
    expect(new Set(out).size).toBe(out.length);
  });
});
```

- [ ] **Step 3: Run tests (expect FAIL).**

- [ ] **Step 4: Implement.**

```typescript
// src/resume-tailor/select-skills.ts
import type { MasterSkill } from './skills-master';

export function selectSkills(master: MasterSkill[], keywords: string[]): string[] {
  const floor = master.filter((s) => s.tag === 'always').map((s) => s.name);
  if (floor.length < 5) {
    throw new Error('skills floor under-defined: need >=5 [always]-tagged entries');
  }
  const floorPicked = floor.slice(0, 5);

  const situational = master.filter((s) => s.tag === 'situational').map((s) => s.name);
  const lowered = keywords.map((k) => k.toLowerCase());
  const ranked = situational
    .map((name) => ({
      name,
      score: lowered.reduce((acc, kw) => acc + (name.toLowerCase().includes(kw) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  const overlay: string[] = [];
  for (const r of ranked) {
    if (overlay.length === 5) break;
    if (floorPicked.includes(r.name)) continue;
    overlay.push(r.name);
  }
  return [...floorPicked, ...overlay];
}
```

- [ ] **Step 5: Run tests (expect PASS).**

- [ ] **Step 6: Commit.**

```bash
git add src/resume-tailor/select-skills.ts src/resume-tailor/skills-master.ts tests/resume-tailor/select-skills.test.ts
git commit -m "feat(resume): skills selection — 5 floor + 5 JD-overlay"
```

---

### Task 3.3: Summary lead-clause swap

**Files:**
- Create: `src/resume-tailor/summary-swap.ts`
- Create: `tests/resume-tailor/summary-swap.test.ts`

- [ ] **Step 1: Write failing test.**

```typescript
// tests/resume-tailor/summary-swap.test.ts
import { describe, expect, test } from 'bun:test';
import { swapLeadClause } from '../../src/resume-tailor/summary-swap';

const baseline =
  'Senior Engineering Leader specializing in large-scale delivery transformation across post-IPO and enterprise technology organizations. ' +
  'Known for rescuing failing delivery systems, modernizing engineering practices, and building scalable platforms. ' +
  'Brings 15+ years leading multinational engineering teams through complex modernization efforts. ' +
  'Proven track record transforming CI/CD reliability from 1–5% to 95–99%.';

describe('swapLeadClause', () => {
  test('swaps lead clause when JD has stronger match', () => {
    const out = swapLeadClause(baseline, 'platform engineering at scale');
    expect(out.startsWith('Senior Engineering Leader specializing in platform engineering at scale')).toBe(true);
  });

  test('preserves the rest verbatim', () => {
    const out = swapLeadClause(baseline, 'platform engineering at scale');
    expect(out).toContain('rescuing failing delivery systems');
    expect(out).toContain('15+ years');
    expect(out).toContain('1–5% to 95–99%');
  });

  test('returns baseline when JD focus is empty', () => {
    expect(swapLeadClause(baseline, '')).toBe(baseline);
  });

  test('does not introduce new claims', () => {
    const out = swapLeadClause(baseline, 'AI infrastructure');
    expect(out.split('.').length).toBe(baseline.split('.').length);
  });
});
```

- [ ] **Step 2: Run (expect FAIL).**

- [ ] **Step 3: Implement.**

```typescript
// src/resume-tailor/summary-swap.ts
const LEAD_RE = /^Senior Engineering Leader specializing in [^.]+/;

export function swapLeadClause(baseline: string, jdFocus: string): string {
  if (!jdFocus.trim()) return baseline;
  const replacement = `Senior Engineering Leader specializing in ${jdFocus}`;
  return baseline.replace(LEAD_RE, replacement);
}
```

- [ ] **Step 4: Run (expect PASS).**

- [ ] **Step 5: Commit.**

```bash
git add src/resume-tailor/summary-swap.ts tests/resume-tailor/summary-swap.test.ts
git commit -m "feat(resume): summary lead-clause swap preserving rest verbatim"
```

---

### Task 3.4: Drop-target selection

**Files:**
- Create: `src/resume-tailor/drop-target.ts`
- Create: `tests/resume-tailor/drop-target.test.ts`

- [ ] **Step 1: Write failing test.**

```typescript
// tests/resume-tailor/drop-target.test.ts
import { describe, expect, test } from 'bun:test';
import { selectDropTarget } from '../../src/resume-tailor/drop-target';
import type { ResumeAST } from '../../src/resume-tailor/types';

function makeAST(): ResumeAST {
  return {
    frontmatter: { template_version: 1, canonical_version: '2026-05-01' },
    header: { name: 'X', tagline: 'Y', contact: 'Z' },
    summary: 'sum',
    keyAccomplishments: [],
    skills: [],
    education: { degrees: 'd', school: 's' },
    roles: [
      {
        title: 'Director', company: 'CurrentCo', meta: '',
        bullets: [
          { text: 'recent top', impact: 'i' },
          { text: 'recent bottom', impact: 'i' },
        ],
      },
      {
        title: 'Director', company: 'MidCo', meta: '',
        bullets: [
          { text: 'mid top', impact: 'i' },
          { text: 'mid bottom', impact: 'i' },
        ],
      },
      {
        title: 'Manager', company: 'OldestCo', meta: '',
        bullets: [
          { text: 'old top relevant', impact: 'i' },
          { text: 'old bottom irrelevant', impact: 'i' },
        ],
      },
    ],
  };
}

describe('selectDropTarget', () => {
  test('drops oldest role bottom bullet first', () => {
    const ast = makeAST();
    const scores = new Map([
      ['old top relevant', 10],
      ['old bottom irrelevant', 1],
      ['mid top', 5], ['mid bottom', 4],
      ['recent top', 8], ['recent bottom', 7],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.bulletText).toBe('old bottom irrelevant');
    expect(target?.roleCompany).toBe('OldestCo');
  });

  test('relevance tiebreak within oldest role', () => {
    const ast = makeAST();
    const scores = new Map([
      ['old top relevant', 1],
      ['old bottom irrelevant', 10],
      ['mid top', 5], ['mid bottom', 4],
      ['recent top', 8], ['recent bottom', 7],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.bulletText).toBe('old top relevant');
  });

  test('advances to second-oldest when oldest exhausted', () => {
    const ast = makeAST();
    ast.roles[2].bullets = [];
    const scores = new Map([
      ['mid top', 5], ['mid bottom', 4],
      ['recent top', 8], ['recent bottom', 7],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.roleCompany).toBe('MidCo');
    expect(target?.bulletText).toBe('mid bottom');
  });

  test('never drops from current role', () => {
    const ast = makeAST();
    ast.roles[1].bullets = [];
    ast.roles[2].bullets = [];
    const scores = new Map();
    expect(selectDropTarget(ast, scores)).toBeNull();
  });

  test('returns null when all eligible roles exhausted', () => {
    const ast = makeAST();
    ast.roles[1].bullets = [];
    ast.roles[2].bullets = [];
    const scores = new Map([['recent top', 1]]);
    expect(selectDropTarget(ast, scores)).toBeNull();
  });
});
```

- [ ] **Step 2: Run (expect FAIL).**

- [ ] **Step 3: Implement.**

```typescript
// src/resume-tailor/drop-target.ts
import type { ResumeAST, Bullet } from './types';

export type DropTarget = {
  roleIndex: number;
  roleCompany: string;
  bulletIndex: number;
  bulletText: string;
};

export function selectDropTarget(
  ast: ResumeAST,
  scores: Map<string, number>,
): DropTarget | null {
  // Drop pool: every role except index 0 (current role).
  for (let i = ast.roles.length - 1; i >= 1; i--) {
    const role = ast.roles[i];
    const bullets = collectBullets(role);
    if (bullets.length === 0) continue;
    // Sort by ascending score; tiebreak by descending position (bottom first).
    bullets.sort((a, b) => {
      const scoreA = scores.get(a.bullet.text) ?? 0;
      const scoreB = scores.get(b.bullet.text) ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.index - a.index;
    });
    const pick = bullets[0];
    return {
      roleIndex: i,
      roleCompany: role.company,
      bulletIndex: pick.index,
      bulletText: pick.bullet.text,
    };
  }
  return null;
}

function collectBullets(role: { bullets: Bullet[]; subRoles?: { bullets: Bullet[] }[] }) {
  const out: { bullet: Bullet; index: number }[] = [];
  if (role.subRoles?.length) {
    let idx = 0;
    for (const sub of role.subRoles) {
      for (const b of sub.bullets) {
        out.push({ bullet: b, index: idx++ });
      }
    }
  } else {
    role.bullets.forEach((b, i) => out.push({ bullet: b, index: i }));
  }
  return out;
}
```

- [ ] **Step 4: Run (expect PASS).**

- [ ] **Step 5: Commit.**

```bash
git add src/resume-tailor/drop-target.ts tests/resume-tailor/drop-target.test.ts
git commit -m "feat(resume): drop-target selection (oldest+lowest, current-role protected)"
```

---

### Task 3.5: Apply drop to AST

**Files:**
- Create: `src/resume-tailor/apply-drop.ts`
- Create: `tests/resume-tailor/apply-drop.test.ts`

- [ ] **Step 1: Write failing test.**

```typescript
// tests/resume-tailor/apply-drop.test.ts
import { describe, expect, test } from 'bun:test';
import { applyDrop } from '../../src/resume-tailor/apply-drop';
import type { ResumeAST } from '../../src/resume-tailor/types';

const baseAST = (): ResumeAST => ({
  frontmatter: { template_version: 1, canonical_version: '2026-05-01' },
  header: { name: '', tagline: '', contact: '' }, summary: '',
  keyAccomplishments: [], skills: [], education: { degrees: '', school: '' },
  roles: [
    { title: '', company: 'A', meta: '', bullets: [
      { text: 'a1', impact: 'i' }, { text: 'a2', impact: 'i' },
    ] },
  ],
});

describe('applyDrop', () => {
  test('removes the targeted bullet by index', () => {
    const ast = baseAST();
    applyDrop(ast, { roleIndex: 0, roleCompany: 'A', bulletIndex: 1, bulletText: 'a2' });
    expect(ast.roles[0].bullets).toHaveLength(1);
    expect(ast.roles[0].bullets[0].text).toBe('a1');
  });

  test('removes from sub-role when present', () => {
    const ast = baseAST();
    ast.roles[0].bullets = [];
    ast.roles[0].subRoles = [
      { label: 'sub', bullets: [{ text: 's1', impact: 'i' }, { text: 's2', impact: 'i' }] },
    ];
    applyDrop(ast, { roleIndex: 0, roleCompany: 'A', bulletIndex: 0, bulletText: 's1' });
    expect(ast.roles[0].subRoles[0].bullets).toHaveLength(1);
    expect(ast.roles[0].subRoles[0].bullets[0].text).toBe('s2');
  });
});
```

- [ ] **Step 2: Run (expect FAIL).**

- [ ] **Step 3: Implement.**

```typescript
// src/resume-tailor/apply-drop.ts
import type { ResumeAST } from './types';
import type { DropTarget } from './drop-target';

export function applyDrop(ast: ResumeAST, target: DropTarget): void {
  const role = ast.roles[target.roleIndex];
  if (role.subRoles?.length) {
    let cursor = 0;
    for (const sub of role.subRoles) {
      if (target.bulletIndex < cursor + sub.bullets.length) {
        sub.bullets.splice(target.bulletIndex - cursor, 1);
        return;
      }
      cursor += sub.bullets.length;
    }
    throw new Error(`drop target out of bounds: ${target.bulletText}`);
  }
  role.bullets.splice(target.bulletIndex, 1);
}
```

- [ ] **Step 4: Run (expect PASS).**

- [ ] **Step 5: Commit.**

```bash
git add src/resume-tailor/apply-drop.ts tests/resume-tailor/apply-drop.test.ts
git commit -m "feat(resume): apply drop target mutation to AST"
```

---

## Phase 4 — Composition Layer

### Task 4.1: Compose tailored markdown from AST

**Files:**
- Create: `src/resume-tailor/compose-tailored.ts`
- Create: `tests/resume-tailor/compose-tailored.test.ts`

- [ ] **Step 1: Write failing test.**

```typescript
// tests/resume-tailor/compose-tailored.test.ts
import { describe, expect, test } from 'bun:test';
import { composeTailored } from '../../src/resume-tailor/compose-tailored';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const md = readFileSync(resolve(__dirname, 'fixtures/canonical-sample.md'), 'utf8');

describe('composeTailored', () => {
  test('round-trips through parse without losing structure', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'Acme', role: 'VP', posting_url: 'https://x', generated: '2026-05-01',
    });
    const reparsed = parseCanonical(out);
    expect(reparsed.header.name).toBe(ast.header.name);
    expect(reparsed.roles).toHaveLength(ast.roles.length);
  });

  test('writes frontmatter with company/role/posting_url', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'Acme Corp', role: 'VP Engineering', posting_url: 'https://x', generated: '2026-05-01',
    });
    expect(out).toContain('company: Acme Corp');
    expect(out).toContain('role: VP Engineering');
  });

  test('skills line is single line, pipe-delimited', () => {
    const ast = parseCanonical(md);
    ast.skills = ['A', 'B', 'C'];
    const out = composeTailored(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).toMatch(/## Skills\n\nA \| B \| C\n/);
  });

  test('every bullet preserves Impact clause', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    const bulletLines = out.split('\n').filter((l) => l.trim().startsWith('- ') && !l.includes('**Revenue Impact**'));
    for (const line of bulletLines) {
      if (line.includes('## Key Accomplishments')) continue;
      if (line.match(/^- \*\*[A-Z]/)) continue; // Key Accomplishments lines start with bold label
      expect(line).toContain('**Impact:**');
    }
  });

  test('no Challenge:/Action:/Results: literals', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).not.toContain('**Challenge:**');
    expect(out).not.toContain('**Action:**');
    expect(out).not.toContain('**Results:**');
  });
});
```

- [ ] **Step 2: Run (expect FAIL).**

- [ ] **Step 3: Implement.**

```typescript
// src/resume-tailor/compose-tailored.ts
import type { ResumeAST, Role, Bullet, KeyAccomplishment } from './types';

export type TailoredFrontmatter = {
  company: string;
  role: string;
  posting_url: string;
  generated: string;
};

export function composeTailored(ast: ResumeAST, fm: TailoredFrontmatter): string {
  const parts: string[] = [];
  parts.push(renderFrontmatter(ast, fm));
  parts.push(`# ${ast.header.name}\n`);
  parts.push(`**${ast.header.tagline}**\n`);
  parts.push(`${ast.header.contact}\n`);
  parts.push(`${ast.summary}\n`);
  parts.push(`## Key Accomplishments\n`);
  parts.push(ast.keyAccomplishments.map(renderAccomplishment).join('\n') + '\n');
  parts.push(`## Skills\n`);
  parts.push(`${ast.skills.join(' | ')}\n`);
  parts.push(`## Professional Experience\n`);
  parts.push(ast.roles.map(renderRole).join('\n'));
  parts.push(`## Education\n`);
  parts.push(`**${ast.education.degrees}**\n`);
  parts.push(`${ast.education.school}\n`);
  return parts.join('\n');
}

function renderFrontmatter(ast: ResumeAST, fm: TailoredFrontmatter): string {
  return [
    '---',
    `generated: ${fm.generated}`,
    `company: ${fm.company}`,
    `role: ${fm.role}`,
    `posting_url: ${fm.posting_url}`,
    `template_version: ${ast.frontmatter.template_version}`,
    `canonical_version: ${ast.frontmatter.canonical_version}`,
    '---',
  ].join('\n') + '\n';
}

function renderAccomplishment(a: KeyAccomplishment): string {
  return `- **${a.label}** — ${a.description} | **Impact:** ${a.impact}`;
}

function renderRole(role: Role): string {
  const out: string[] = [];
  out.push(`### ${role.title} | ${role.company}\n`);
  out.push(`*${role.meta}*\n`);
  if (role.subRoles?.length) {
    for (const sub of role.subRoles) {
      out.push(`As ${sub.label}:\n`);
      out.push(sub.bullets.map(renderBullet).join('\n') + '\n');
    }
  } else {
    out.push(role.bullets.map(renderBullet).join('\n') + '\n');
  }
  return out.join('\n');
}

function renderBullet(b: Bullet): string {
  return `- ${b.text}. **Impact:** ${b.impact}`;
}
```

- [ ] **Step 4: Run (expect PASS).**

- [ ] **Step 5: Commit.**

```bash
git add src/resume-tailor/compose-tailored.ts tests/resume-tailor/compose-tailored.test.ts
git commit -m "feat(resume): compose tailored markdown from AST"
```

---

## Phase 5 — Render Integration

### Task 5.1: Render via `anthropic-skills:docx`

**Files:**
- Create: `src/resume-tailor/render.ts`
- Create: `tests/resume-tailor/render.test.ts`

**Carry-forward review notes from PR #96:**

- **I3 (Skills line ordering trap)** — `references/resume.md` Skills line is *category-ordered* (Leadership → Platform → DevOps → Technical → Tools, with `[always]` first within each category), NOT priority-ordered. Floor entries appear at positions 1, 2, 3, 10, 15 — NOT positions 1-5. Renderer MUST consult `skills-master.md` tags when selecting the 5 floor + 5 overlay entries; it MUST NOT read Skills line positionally. Add a header comment to `render.ts` documenting this contract. Add a renderer guard that fails loudly if `skills-master.md` is missing or has fewer than 5 `[always]` entries.

- **M3 (Vrbo subrole labels)** — `references/resume.md` lines 52 (`As Director of Engineering (July 2020 – February 2021):`) and 59 (`As Senior Software Engineering Manager (November 2016 – June 2020):`) are bare prose paragraphs separating Vrbo's two subroles. Spec render-mapping table (lines 257-269 of design doc) has no style assigned to this case. Decision needed in this task: either (a) map to existing `Role Meta` style with extra spacing, or (b) introduce a new `SubRoleLabel` style in the template. If (b), update `scripts/build-resume-template.js` to add the style and re-run the generator. Document the chosen approach in `render.md` (Task 6.4).

- [ ] **Step 1: Write failing integration test.**

```typescript
// tests/resume-tailor/render.test.ts
import { describe, expect, test } from 'bun:test';
import { renderResume } from '../../src/resume-tailor/render';
import { mkdtempSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const sampleMd = `---
template_version: 1
canonical_version: 2026-05-01
generated: 2026-05-01
company: TestCo
role: VP Eng
posting_url: ''
---

# Test Person

**Tagline Here**

email@x.com | City | linkedin

Summary paragraph about leadership.

## Key Accomplishments

- **Label** — desc | **Impact:** outcome

## Skills

A | B | C | D | E | F | G | H | I | J

## Professional Experience

### Title | Co

*loc | dates*

- bullet text. **Impact:** outcome

## Education

**Degree**

School
`;

describe('renderResume', () => {
  test('produces a valid docx', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'resume-render-'));
    const mdPath = join(dir, 'in.md');
    const outPath = join(dir, 'out.docx');
    writeFileSync(mdPath, sampleMd);
    await renderResume({
      markdownPath: mdPath,
      templatePath: resolve(process.cwd(), 'references/resume-template.docx'),
      outputPath: outPath,
    });
    const stat = statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run (expect FAIL).**

- [ ] **Step 3: Implement.** This wraps the `anthropic-skills:docx` skill invocation. The exact form depends on how that skill is invoked from the codebase — see `skills/_shared/` patterns and the docx skill's SKILL.md for the invocation contract. Pseudocode shape:

```typescript
// src/resume-tailor/render.ts
import { spawn } from 'bun';
import { existsSync } from 'node:fs';

export type RenderOpts = {
  markdownPath: string;
  templatePath: string;
  outputPath: string;
};

export async function renderResume(opts: RenderOpts): Promise<void> {
  if (!existsSync(opts.markdownPath)) throw new Error(`markdown missing: ${opts.markdownPath}`);
  if (!existsSync(opts.templatePath)) throw new Error(`template missing: ${opts.templatePath}`);

  // Invoke the anthropic-skills:docx renderer. The skill exposes a CLI entry point
  // (see skills/_shared/ patterns in the repo for how other skills shell out).
  const proc = spawn(
    [
      'bun', 'run', 'scripts/render-docx.ts',
      '--md', opts.markdownPath,
      '--template', opts.templatePath,
      '--out', opts.outputPath,
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`render failed (exit ${exitCode}): ${err.trim()}`);
  }
  if (!existsSync(opts.outputPath)) {
    throw new Error(`render did not produce ${opts.outputPath}`);
  }
}
```

- [ ] **Step 4: Add the bun-side render entry point** (`scripts/render-docx.ts`) that calls the docx skill. Inspect `anthropic-skills:docx` SKILL.md to determine the exact invocation API; populate this script accordingly. Since the docx skill is loaded at session start and its API is not statically known, leave a clear TODO marker only here — implementation must read the skill at execute time and adapt.

```typescript
// scripts/render-docx.ts
// Bridge to anthropic-skills:docx. Reads --md, --template, --out args and invokes
// the skill's render function. The exact API depends on the docx skill version;
// inspect skills/anthropic-skills/docx/SKILL.md (or equivalent path) for the
// current contract before completing this script.
//
// The skill reads markdown, applies named-style mappings from the template,
// and writes the docx to --out. If the skill's API differs, adapt the call here
// — keep this file small (under 50 lines).

import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    md: { type: 'string' },
    template: { type: 'string' },
    out: { type: 'string' },
  },
});

if (!values.md || !values.template || !values.out) {
  console.error('usage: render-docx.ts --md <path> --template <path> --out <path>');
  process.exit(1);
}

// PLACEHOLDER for the docx skill invocation. Replace with the actual call
// once the skill's API is read. Throwing here ensures tests fail loudly until wired.
throw new Error('render-docx.ts: anthropic-skills:docx invocation not yet wired');
```

- [ ] **Step 5: Wire the docx skill** by reading `skills/_shared/` and the docx skill's SKILL.md, then replacing the `throw` in `scripts/render-docx.ts` with the real call. Re-run the test from Step 2.

- [ ] **Step 6: Run (expect PASS).**

- [ ] **Step 7: Commit.**

```bash
git add src/resume-tailor/render.ts scripts/render-docx.ts tests/resume-tailor/render.test.ts
git commit -m "feat(resume): render bridge to anthropic-skills:docx"
```

---

### Task 5.2: Enforcement loop (drop until ≤2 pages)

**Files:**
- Create: `src/resume-tailor/enforce-pages.ts`
- Create: `tests/resume-tailor/enforce-pages.test.ts`

- [ ] **Step 1: Write failing test.**

```typescript
// tests/resume-tailor/enforce-pages.test.ts
import { describe, expect, test } from 'bun:test';
import { enforceTwoPages } from '../../src/resume-tailor/enforce-pages';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const oversize = readFileSync(resolve(__dirname, 'fixtures/oversize-canonical.md'), 'utf8');

describe('enforceTwoPages', () => {
  test('drops bullets until ≤2 pages and logs decisions', async () => {
    const ast = parseCanonical(oversize);
    const fakeRender = async (_ast: typeof ast) => {
      // simulate page count by AST size
      const totalBullets = ast.roles.flatMap((r) =>
        r.subRoles ? r.subRoles.flatMap((s) => s.bullets) : r.bullets,
      ).length;
      return totalBullets > 8 ? 3 : 2;
    };
    const result = await enforceTwoPages(ast, new Map(), { render: fakeRender, max: 5 });
    expect(result.pages).toBeLessThanOrEqual(2);
    expect(result.dropped.length).toBeGreaterThan(0);
  });

  test('throws when drop pool exhausted', async () => {
    const ast = parseCanonical(oversize);
    ast.roles.slice(1).forEach((r) => {
      if (r.subRoles) r.subRoles.forEach((s) => (s.bullets = []));
      else r.bullets = [];
    });
    const fakeRender = async () => 3;
    expect(
      enforceTwoPages(ast, new Map(), { render: fakeRender, max: 5 }),
    ).rejects.toThrow(/drop pool exhausted/);
  });

  test('throws when iteration limit reached', async () => {
    const ast = parseCanonical(oversize);
    const fakeRender = async () => 3;
    expect(
      enforceTwoPages(ast, new Map(), { render: fakeRender, max: 2 }),
    ).rejects.toThrow(/did not converge/);
  });
});
```

- [ ] **Step 2: Build the oversize fixture.** Copy `references/resume.md` and append duplicated bullets to force >2 pages. Save as `tests/resume-tailor/fixtures/oversize-canonical.md`.

- [ ] **Step 3: Run (expect FAIL).**

- [ ] **Step 4: Implement.**

```typescript
// src/resume-tailor/enforce-pages.ts
import { selectDropTarget } from './drop-target';
import { applyDrop } from './apply-drop';
import type { ResumeAST } from './types';

export type EnforceOpts = {
  render: (ast: ResumeAST) => Promise<number>;
  max: number;
};

export type EnforceResult = {
  pages: number;
  dropped: { roleCompany: string; bulletText: string; iteration: number }[];
};

export async function enforceTwoPages(
  ast: ResumeAST,
  scores: Map<string, number>,
  opts: EnforceOpts,
): Promise<EnforceResult> {
  const dropped: EnforceResult['dropped'] = [];
  for (let iter = 1; iter <= opts.max; iter++) {
    const pages = await opts.render(ast);
    if (pages <= 2) return { pages, dropped };
    const target = selectDropTarget(ast, scores);
    if (target === null) {
      throw new Error(`drop pool exhausted; pages=${pages} after ${iter - 1} drops`);
    }
    applyDrop(ast, target);
    dropped.push({
      roleCompany: target.roleCompany,
      bulletText: target.bulletText,
      iteration: iter,
    });
  }
  throw new Error(
    `enforce-pages did not converge in ${opts.max} iterations after ${dropped.length} drops`,
  );
}
```

- [ ] **Step 5: Run (expect PASS).**

- [ ] **Step 6: Commit.**

```bash
git add src/resume-tailor/enforce-pages.ts tests/resume-tailor/enforce-pages.test.ts tests/resume-tailor/fixtures/oversize-canonical.md
git commit -m "feat(resume): enforcement loop with drop-target + page-count gate"
```

---

## Phase 6 — Skill Orchestration

### Task 6.1: Rewrite `skills/resume-tailor/SKILL.md`

**Files:**
- Modify: `skills/resume-tailor/SKILL.md` (full rewrite)

- [ ] **Step 1: Replace the file** with the new orchestration. Keep structure (frontmatter + Phase 0..N pattern).

```markdown
---
name: resume-tailor
description: >
  Customize resume for a specific role — produces ATS-safe, ≤2-page .docx tailored
  per recruiter spec. Drives off references/resume.md (canonical), references/skills-master.md,
  and references/resume-template.docx. Output saved to
  output/{company-slug}/{Name}_Resume_{Company}.{md,docx,decisions.md}.
  Triggers: "tailor my resume", "customize resume for", "ATS resume for"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob
---

# Resume Tailor (ATS edition)

Takes a job posting and produces a role-optimized, ATS-safe resume in `.docx`,
≤2 pages, per recruiter feedback (2026-05-01). See `tailoring-rules.md`,
`drop-strategy.md`, and `render.md` for the operational rules.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute. Additionally:

- Verify `references/resume.md` exists; halt with extraction instruction if not.
- Verify `references/skills-master.md` exists with ≥5 `[always]`-tagged entries.
- Verify `references/resume-template.docx` exists.
- Verify `soffice` and `pdfinfo` on PATH; halt with brew install instructions if missing.

### Phase Cache Check

Before starting analysis, check for cached results from a prior interrupted run.
See `skills/_shared/phase-cache.md` for the full caching convention.

1. `bun scripts/cache.js read resume-tailor analysis`
   - If exit 0: cached. Display: "Posting analysis cached at {cached_at} for {company}.
     Resume from compose? (yes / fresh)"
2. If not cached, proceed with Phase 1 normally.

## Required Inputs

- **Job posting URL** (required)
- **Specific points to emphasize** (optional)

## Phase 1 — Company Extraction

Read `skills/_shared/company-extraction.md` and execute. Then run the
`output/{company-slug}/evaluation.md` gate per existing convention.

## Phase 2 — Analyze, Score, Compose

Read `skills/resume-tailor/tailoring-rules.md` and execute. The pipeline:

1. Fetch JD; extract top 3-5 reqs, seniority signals, keywords.
2. Score every bullet in `references/resume.md` against keywords.
3. Reorder Key Accomplishments (6 fixed, by relevance).
4. Select 10 skills (5 floor + 5 JD-overlay) from `references/skills-master.md`.
5. Swap summary lead clause with the JD's top requirement.
6. Compose tailored markdown via `composeTailored`.

Cache analysis results before composing:

```fish
bun scripts/cache.js write resume-tailor analysis '<json>'
```

## Phase 3 — Render & Enforce

1. Render the tailored .md to .docx via `renderResume` (bridges to `anthropic-skills:docx`).
2. Verify page count via `pageCount` (wraps `scripts/resume-page-count.fish`).
3. If pages > 2, run `enforceTwoPages` — drops oldest+lowest bullet, re-renders, up to 5 iterations.
4. Hard fail with diagnostics if drop pool exhausted or iteration limit reached.

Output:

```
output/{company-slug}/{Name}_Resume_{Company}.md
output/{company-slug}/{Name}_Resume_{Company}.docx
output/{company-slug}/{Name}_Resume_{Company}.decisions.md
```

## Phase 4 — State Update

Read `skills/_shared/state-io.md`. Append `RESUME TAILORED` flag to the seen-postings entry.

If the company has an applications-pipeline entry:

```fish
bun scripts/state.js add-note applications --company "{company}" --note "Resume tailored {YYYY-MM-DD}"
```

If exit non-zero, log a note: "No application entry — run /application-tracker to add it."

## Error Handling

See full table in `docs/superpowers/specs/2026-05-01-ats-resume-template-design.md`.
Hard-fail philosophy: every fail surfaces (a) what failed, (b) why, (c) remediation.
Tailored .md preserved on failure.

## Key Constraints

- Never fabricate experience.
- Bullet facts (numbers, scope, outcomes) verbatim from canonical.
- Education and Header are verbatim.
- Recruiter spec (no CAR labels, every bullet has Impact, Skills max 10 pipe-delimited)
  is binding.
- 2-page limit is HARD — content drops first per drop-strategy.md.
```

- [ ] **Step 2: Commit.**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "refactor(resume): rewrite SKILL.md for ATS pipeline"
```

---

### Task 6.2: Rewrite `skills/resume-tailor/tailoring-rules.md`

**Files:**
- Modify: `skills/resume-tailor/tailoring-rules.md` (full rewrite)

- [ ] **Step 1: Replace contents.**

```markdown
# Resume Tailor — Tailoring Rules

## Phase 1: Analyze the Posting

Extract from the job posting (or company-research brief if available):

1. **Top 3-5 requirements** — capabilities the role most demands.
2. **Seniority signals** — scope indicators (budget, team size, org breadth).
3. **Domain context** — industry, tech stack, company stage.

## Phase 2: Score and Map Content

Read `references/resume.md`. For every bullet and accomplishment:

- Score relevance against the extracted keywords (`scoreBullet`).
- Reorder all 6 Key Accomplishments by score; total count stays at 6.
- Reorder bullets within each role by score.

## Phase 3: Skills Selection

Read `references/skills-master.md`. Select 10:

- 5 floor (always-tagged)
- 5 JD-overlay (situational, ranked by JD-keyword match)

Output: ` | `-delimited single line under `## Skills`.

## Phase 4: Summary Lead-Clause Swap

Use the recruiter draft from `references/resume.md` as the baseline. Swap the lead
clause ("Senior Engineering Leader specializing in ___") with the JD's top requirement.
Preserve the rest verbatim.

## Phase 5: Compose

Compose tailored markdown via `composeTailored`. Schema:

```markdown
---
generated: <date>
company: <name>
role: <title>
posting_url: <url>
template_version: 1
canonical_version: <date from resume.md>
---

# Christopher Cantu

**<Tagline>**

<contact line>

<Summary paragraph — recruiter draft, lead clause swapped per JD>

## Key Accomplishments

- **<Label>** — <description> | **Impact:** <outcome>
- ...(6 total)

## Skills

A | B | C | D | E | F | G | H | I | J

## Professional Experience

### Title | Company

*Location | Date range | Team size context*

- Bullet text. **Impact:** outcome.
- ...

## Education

**Degrees**

School
```

**Schema rules (binding):**

- No `Challenge:`/`Action:`/`Results:` literals.
- Every bullet ends with `**Impact:** <clause>.`
- Skills line: single line, ` | `-delimited, max 10.
- Key Accomplishments: pipe-delimited fields per the schema.

## Phase 6: Render and Enforce

Render via `renderResume`. Verify page count via `pageCount`. If > 2 pages, run
`enforceTwoPages` per `drop-strategy.md`.

## Anti-Patterns (Summary)

- "I'm passionate about driving organizational excellence"
- "I'm uniquely positioned to leverage my experience"
- "I've been fortunate enough to lead..."
- Anything LinkedIn-influencer flavored.

## Key Constraints

- **Never fabricate experience** — only reorder, re-emphasize, swap lead clauses.
- **Drop content for 2-page fit per `drop-strategy.md`.** This SUPERSEDES the
  legacy "never remove" rule.
- **Bullet facts are sacred** — numbers, scope, outcomes verbatim from canonical.
- **Education and Header are verbatim** — no trimming.
- **Flag gaps honestly** in the decisions log.
```

- [ ] **Step 2: Commit.**

```bash
git add skills/resume-tailor/tailoring-rules.md
git commit -m "refactor(resume): rewrite tailoring-rules for recruiter spec"
```

---

### Task 6.3: Add `skills/resume-tailor/drop-strategy.md`

**Files:**
- Create: `skills/resume-tailor/drop-strategy.md`

- [ ] **Step 1: Author the file.**

```markdown
# Resume Tailor — Drop Strategy

When a tailored resume exceeds 2 pages, drop bullets per this rule.

## Drop Pool

Eligible:
- Bullets in roles 2..N (oldest first)

Protected:
- Header (name, tagline, contact)
- Summary
- Key Accomplishments (all 6)
- Skills line (10 entries)
- Education
- Current role (role index 0) — never drop

## Selection Order

1. Identify the oldest role with eligible bullets.
2. Within that role, sort bullets by ascending JD-relevance score.
3. Tiebreak: bottom of the role section first.
4. If oldest role exhausted, advance to second-oldest.
5. Continue until pages ≤ 2 OR drop pool exhausted.

## Hard Failures

- **Drop pool exhausted with pages > 2** — surface `output/{slug}/{Name}_Resume_{Co}.docx`
  + decisions.md to user; suggest "template visual budget likely too verbose; reduce
  font, tighten margins, or audit Word styles."
- **Iteration > 5** — surface "drop loop did not converge" with diagnostics.

## Decisions Log

For every drop, append a row to `decisions.md`:

```
1. Vrbo / Sr Manager / "<bullet text first 50 chars...>" — score 1.2/5, oldest role bottom
```

The decisions log is the audit trail for why each tailored resume looks the way it does.
```

- [ ] **Step 2: Commit.**

```bash
git add skills/resume-tailor/drop-strategy.md
git commit -m "docs(resume): drop-strategy companion for tailoring rules"
```

---

### Task 6.4: Add `skills/resume-tailor/render.md`

**Files:**
- Create: `skills/resume-tailor/render.md`

- [ ] **Step 1: Author the file.**

```markdown
# Resume Tailor — Render Contract

The render layer bridges tailored markdown to `.docx` via `anthropic-skills:docx`.
Styling lives in `references/resume-template.docx`. No styling in markdown.

## Style Mapping

| Markdown element | Style name in template |
|---|---|
| `# H1` | `Heading 1` (overridden as name banner) |
| `**bold-only line** under H1` | `Tagline` |
| Plain paragraph after tagline | `Contact` |
| `## H2` | `Heading 2` (section dividers) |
| `### H3` | `Heading 3` (role title \| company) |
| `*italic line*` | `Role Meta` |
| Bullet list `- ...` | `List Bullet` (overridden: tight) |
| Skills line (single para after `## Skills`) | `Skills Line` |
| Accomplishment line (single bullet after `## Key Accomplishments`) | `Accomplishment` |
| `**bold run** within paragraph` | inline bold run (no style) |

## Invocation

```typescript
import { renderResume } from 'src/resume-tailor/render';

await renderResume({
  markdownPath: 'output/{slug}/{Name}_Resume_{Co}.md',
  templatePath: 'references/resume-template.docx',
  outputPath:   'output/{slug}/{Name}_Resume_{Co}.docx',
});
```

## Page Count

```typescript
import { pageCount } from 'src/resume-tailor/page-count';

const pages = await pageCount('output/.../resume.docx');
```

Wraps `scripts/resume-page-count.fish` (`soffice` + `pdfinfo`).

## Restyling

Edit named styles in `references/resume-template.docx` (Word → Styles pane). Save.
No code change needed. The next render picks up the new visuals.
```

- [ ] **Step 2: Commit.**

```bash
git add skills/resume-tailor/render.md
git commit -m "docs(resume): render-contract companion documenting style mapping"
```

---

## Phase 7 — End-to-End and Cleanup

### Task 7.1: E2E test against three JD fixtures

**Files:**
- Create: `tests/resume-tailor/e2e.test.ts`
- Create: `tests/resume-tailor/fixtures/jd-scaling-director.txt`
- Create: `tests/resume-tailor/fixtures/jd-ai-infra.txt`

- [ ] **Step 1: Save the two missing JD fixtures.** Hand-author `jd-scaling-director.txt` and `jd-ai-infra.txt` reflecting realistic requirements lists (~150 words each).

- [ ] **Step 2: Write the e2e test.**

```typescript
// tests/resume-tailor/e2e.test.ts
import { describe, expect, test } from 'bun:test';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { extractKeywords, scoreBullet } from '../../src/resume-tailor/score-bullets';
import { selectSkills } from '../../src/resume-tailor/select-skills';
import { swapLeadClause } from '../../src/resume-tailor/summary-swap';
import { composeTailored } from '../../src/resume-tailor/compose-tailored';
import { renderResume } from '../../src/resume-tailor/render';
import { enforceTwoPages } from '../../src/resume-tailor/enforce-pages';
import { pageCount } from '../../src/resume-tailor/page-count';
import { parseSkillsMaster } from '../../src/resume-tailor/skills-master';
import { readFileSync, mkdtempSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const fixtures = ['jd-platform-vp.txt', 'jd-scaling-director.txt', 'jd-ai-infra.txt'];

describe('e2e tailor', () => {
  for (const f of fixtures) {
    test(`tailor produces ≤2-page docx for ${f}`, async () => {
      const canonical = readFileSync(resolve(process.cwd(), 'references/resume.md'), 'utf8');
      const masterMd = readFileSync(resolve(process.cwd(), 'references/skills-master.md'), 'utf8');
      const jd = readFileSync(resolve(__dirname, 'fixtures', f), 'utf8');

      const ast = parseCanonical(canonical);
      const keywords = extractKeywords(jd);
      const master = parseSkillsMaster(masterMd);
      ast.skills = selectSkills(master, keywords);
      ast.summary = swapLeadClause(ast.summary, keywords[0] ?? '');

      // Score bullets for drop-target selection.
      const scores = new Map<string, number>();
      for (const role of ast.roles) {
        const bullets = role.subRoles
          ? role.subRoles.flatMap((s) => s.bullets)
          : role.bullets;
        for (const b of bullets) scores.set(b.text, scoreBullet(b.text, keywords));
      }

      const dir = mkdtempSync(join(tmpdir(), `e2e-${f}-`));
      const mdPath = join(dir, 'r.md');
      const docxPath = join(dir, 'r.docx');

      const renderAndCount = async (currentAST: typeof ast) => {
        writeFileSync(mdPath, composeTailored(currentAST, {
          generated: '2026-05-01',
          company: 'TestCo',
          role: f.replace(/\.txt$/, ''),
          posting_url: '',
        }));
        await renderResume({
          markdownPath: mdPath,
          templatePath: resolve(process.cwd(), 'references/resume-template.docx'),
          outputPath: docxPath,
        });
        return pageCount(docxPath);
      };

      const result = await enforceTwoPages(ast, scores, { render: renderAndCount, max: 5 });
      expect(result.pages).toBeLessThanOrEqual(2);
      expect(statSync(docxPath).size).toBeGreaterThan(0);
    }, 60_000);
  }
});
```

- [ ] **Step 3: Run.**

```bash
bun test tests/resume-tailor/e2e.test.ts
```

Expected: all 3 PASS, each producing a ≤2-page docx.

- [ ] **Step 4: Commit.**

```bash
git add tests/resume-tailor/e2e.test.ts tests/resume-tailor/fixtures/jd-scaling-director.txt tests/resume-tailor/fixtures/jd-ai-infra.txt
git commit -m "test(resume): e2e against three JD fixtures with page-count gate"
```

---

### Task 7.2: Manual ATS smoke test

**Files:**
- Create: `tests/resume-tailor/ats-smoke-2026-05-01.md`

- [ ] **Step 1: Run one e2e fixture end-to-end** to produce a final `.docx` (e.g. `/tmp/e2e-jd-platform-vp/r.docx`).

- [ ] **Step 2: Upload to https://www.jobscan.co/** (free tier sufficient). Paste the JD; upload the docx; run the parse.

- [ ] **Step 3: Record the result.**

```markdown
# ATS Smoke Test — 2026-05-01

**Tooling:** jobscan.co
**JD:** jd-platform-vp.txt
**Resume:** /tmp/e2e-jd-platform-vp/r.docx

## Parse Results

- Header / contact: <pass | fail>
- Skills section parsed: <list every skill jobscan extracted>
- Education parsed: <pass | fail>
- Roles extracted: <list company names jobscan extracted>
- Bullets extracted: <count>

## Match Score
<jobscan-reported score>

## Gaps Reported
<list>

## Decision
<pass / fail / actionable adjustments>
```

- [ ] **Step 4: Commit the smoke-test record.**

```bash
git add tests/resume-tailor/ats-smoke-2026-05-01.md
git commit -m "test(resume): ATS smoke test record from jobscan.co"
```

---

### Task 7.3: Delete superseded renderer

**Files:**
- Delete: `scripts/generate_resume_docx.js`

- [ ] **Step 1: Confirm nothing references it.**

```fish
grep -rn 'generate_resume_docx' --exclude-dir=node_modules --exclude-dir=.git .
```

Expected: only matches inside the file itself or this plan.

- [ ] **Step 2: Delete.**

```bash
git rm scripts/generate_resume_docx.js
```

- [ ] **Step 3: Commit.**

```bash
git commit -m "chore(resume): remove superseded generate_resume_docx.js"
```

---

### Task 7.4: Delete `references/resume-ats.md`

**Files:**
- Delete: `references/resume-ats.md`

- [ ] **Step 1: Confirm nothing references it.**

```fish
grep -rn 'resume-ats\.md' --exclude-dir=node_modules --exclude-dir=.git .
```

Expected: only matches inside the file or this plan.

- [ ] **Step 2: Delete.**

```bash
git rm references/resume-ats.md
git commit -m "chore(resume): remove stale resume-ats.md, superseded by canonical resume.md"
```

---

### Task 7.5: Audit downstream skills for canonical-source change

**Files:**
- Modify: any of `skills/cover-letter/`, `skills/interview-prep/`, `skills/evaluate/` that reference `references/resume.pdf`

- [ ] **Step 1: Find references.**

```fish
grep -rn 'references/resume\.pdf' --exclude-dir=node_modules --exclude-dir=.git skills/
```

- [ ] **Step 2: For each match, decide:**
  - Skill reads PDF only for content → swap to `references/resume.md`.
  - Skill writes PDF or expects PDF byte stream → keep `resume.pdf` as archive (one-time export from latest tailored docx) and document.

- [ ] **Step 3: Apply edits.** For each skill that switches to `.md`:
  - Edit the SKILL.md path reference.
  - If the skill parses content, swap to `parseCanonical` (import from `src/resume-tailor/parse-canonical`).
  - Add a smoke check at skill startup: read `references/resume.md`, confirm parses without throwing.

- [ ] **Step 4: Commit per skill.**

```bash
git add skills/cover-letter/SKILL.md
git commit -m "refactor(cover-letter): read references/resume.md (canonical) instead of pdf"
# repeat for interview-prep and evaluate
```

---

## Phase 8 — Verification Gate

### Task 8.1: Full verification gate

- [ ] **Step 1: Type-check.**

```bash
bun x tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run all tests.**

```bash
bun test
```

Expected: green.

- [ ] **Step 3: Run e2e against all 3 JD fixtures.**

```bash
bun test tests/resume-tailor/e2e.test.ts
```

Expected: all 3 produce ≤2-page docx.

- [ ] **Step 4: Confirm ATS smoke run logged.**

```bash
ls tests/resume-tailor/ats-smoke-*.md
```

Expected: at least one file dated within the last week.

- [ ] **Step 5: Final commit + push.**

```bash
git log --oneline -20
git push origin <feature-branch>
```

- [ ] **Step 6: PR open** with the spec link in the description.

---

## Self-Review (already run)

- **Spec coverage**: every section of the spec has at least one task. Architecture → Phase 0/1/5/6. Schema → Tasks 0.2 + 4.1 + 6.2. Drop strategy → Tasks 3.4/3.5/5.2 + 6.3. Render → Tasks 5.1 + 6.4. Tests → Phase 2-7.
- **Placeholder scan**: one explicit `PLACEHOLDER` in `scripts/render-docx.ts` (Task 5.1 Step 4) — flagged for the implementer to wire by reading the docx skill at execute time. Not a hidden gap.
- **Type consistency**: `ResumeAST`, `Bullet`, `KeyAccomplishment`, `DropTarget` all defined in Task 2.1 and reused unchanged through Tasks 3.4–7.1. `pageCount` signature stable from Task 1.2 onward.
