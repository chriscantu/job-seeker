# Applications State Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add applications state management to `scripts/state.js` — parser, writer, stage transitions, note-appending — and wire cross-skill writes from cover-letter and resume-tailor.

**Architecture:** New `scripts/lib/applications.js` module mirrors the seen-postings pattern (regex parser, in-place writer, atomicWriteFileSync). CLI gets `applications` as a third type with `read`, `create`, `update`, and `add-note` commands. Two skills wire into `add-note` for end-to-end validation.

**Tech Stack:** Node.js/Bun, node:test, CommonJS modules (matching existing codebase)

---

## File Structure

### New files to create

```
scripts/lib/applications.js        ← parser, writer, update, add-note
tests/applications.test.js         ← unit tests for parser and writer
tests/fixtures/applications.md     ← test fixture — well-formed applications file
```

### Files to modify

```
scripts/lib/validators.js          ← add validateApplicationEntry
scripts/state.js                   ← add applications type, update, add-note, create commands
tests/state-cli.test.js            ← add CLI integration tests for applications
skills/_shared/state-io.md         ← document applications CLI subcommands
skills/cover-letter/SKILL.md       ← add post-generation add-note call
skills/resume-tailor/SKILL.md      ← add post-generation add-note call
```

---

### Task 1: Create test fixture

**Files:**
- Create: `tests/fixtures/applications.md`

- [ ] **Step 1: Write the fixture file**

This file mirrors the schema from `skills/application-tracker/pipeline-schema.md` with enough variety to test active, closed, multi-history, and edge cases.

```markdown
# Application Pipeline

Last updated: 2026-04-08

## Active Applications

### Maven — VP Engineering
- **Stage**: Screen
- **Applied**: 2026-04-01
- **Last activity**: 2026-04-08 — Phone screen with recruiter
- **Next action**: Prep for technical interview
- **Contacts**: Jane Doe (Recruiter)
- **URL**: https://jobs.lever.co/maven/abc123
- **Notes**: Strong culture fit

#### History
- 2026-04-01: Applied — Submitted via website
- 2026-04-05: Screen — Recruiter reached out
- 2026-04-08: Screen — Phone screen with recruiter

---

### Acme Corp — Senior Director of Engineering
- **Stage**: Applied
- **Applied**: 2026-04-03
- **Last activity**: 2026-04-03 — Application submitted
- **Next action**: Wait for recruiter response
- **Contacts**:
- **URL**: https://jobs.ashbyhq.com/acme/def456
- **Notes**:

#### History
- 2026-04-03: Applied — Application submitted

---

## Closed Applications

### Initech — VP of Engineering
- **Stage**: Closed (rejected)
- **Applied**: 2026-03-15
- **Closed**: 2026-03-28
- **Summary**: No response after phone screen

#### History
- 2026-03-15: Applied — Submitted via referral
- 2026-03-20: Screen — Phone screen with HR
- 2026-03-28: Closed — Rejected, no feedback provided
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/applications.md
git commit -m "test: add applications state fixture"
```

---

### Task 2: Add `validateApplicationEntry` to validators

**Files:**
- Modify: `scripts/lib/validators.js`
- Modify: `tests/validators.test.js`

- [ ] **Step 1: Write failing tests for the validator**

Add to `tests/validators.test.js`:

```js
const { validateApplicationEntry } = require('../scripts/lib/validators');

describe('validateApplicationEntry', () => {
  it('accepts a valid entry with required fields', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('accepts a valid entry with all fields', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Screen',
      url: 'https://jobs.lever.co/maven/abc123',
      applied: '2026-04-01',
      notes: 'Strong culture fit',
      contacts: 'Jane Doe (Recruiter)',
      nextAction: 'Prep for technical interview',
    });
    assert.equal(result.valid, true);
  });

  it('rejects empty company', () => {
    const result = validateApplicationEntry({
      company: '',
      title: 'VP Engineering',
      stage: 'Applied',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('company')));
  });

  it('rejects empty title', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: '',
      stage: 'Applied',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('title')));
  });

  it('rejects missing stage', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: 'VP Engineering',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('stage')));
  });

  it('rejects invalid stage', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Vibing',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('stage')));
  });

  it('rejects invalid URL', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
      url: 'not-a-url',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('url')));
  });

  it('rejects invalid applied date format', () => {
    const result = validateApplicationEntry({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
      applied: '04/01/2026',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('applied')));
  });

  it('rejects pipe in company name', () => {
    const result = validateApplicationEntry({
      company: 'Maven | Clinic',
      title: 'VP Engineering',
      stage: 'Applied',
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('pipe')));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/validators.test.js`
Expected: FAIL — `validateApplicationEntry` is not a function

- [ ] **Step 3: Implement the validator**

Add to `scripts/lib/validators.js`:

```js
const VALID_STAGES = [
  'Discovery', 'Research', 'Applied', 'Screen',
  'Interview (1)', 'Interview (2+)', 'Final Round',
  'Offer', 'Decision', 'Closed',
];

function validateApplicationEntry(entry) {
  const errors = [];

  if (!entry.company || typeof entry.company !== 'string' || !entry.company.trim()) {
    errors.push('company is required');
  } else if (entry.company.includes('|')) {
    errors.push('company must not contain pipe character (|)');
  }

  if (!entry.title || typeof entry.title !== 'string' || !entry.title.trim()) {
    errors.push('title is required');
  } else if (entry.title.includes('|')) {
    errors.push('title must not contain pipe character (|)');
  }

  if (!entry.stage || typeof entry.stage !== 'string') {
    errors.push('stage is required');
  } else if (!VALID_STAGES.includes(entry.stage)) {
    errors.push(`stage must be one of: ${VALID_STAGES.join(', ')}`);
  }

  if (entry.url !== null && entry.url !== undefined && !/^https?:\/\/.+/.test(entry.url)) {
    errors.push('url must be a valid HTTP(S) URL or null');
  }

  if (entry.applied && !/^\d{4}-\d{2}-\d{2}$/.test(entry.applied)) {
    errors.push('applied date must be in YYYY-MM-DD format');
  }

  return { valid: errors.length === 0, errors };
}
```

Export `VALID_STAGES` and `validateApplicationEntry` from the module.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/validators.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/validators.js tests/validators.test.js
git commit -m "feat: add validateApplicationEntry to validators"
```

---

### Task 3: Build the applications parser

**Files:**
- Create: `scripts/lib/applications.js`
- Create: `tests/applications.test.js`

- [ ] **Step 1: Write failing tests for the parser**

Create `tests/applications.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { parseApplicationsFile, parseApplicationsContent } = require('../scripts/lib/applications');

const FIXTURE = path.join(__dirname, 'fixtures', 'applications.md');

describe('applications parser', () => {
  describe('parseApplicationsContent', () => {
    it('parses active applications', () => {
      const { active } = parseApplicationsFile(FIXTURE);
      assert.equal(active.length, 2);
    });

    it('parses closed applications', () => {
      const { closed } = parseApplicationsFile(FIXTURE);
      assert.equal(closed.length, 1);
    });

    it('extracts company and title from heading', () => {
      const { active } = parseApplicationsFile(FIXTURE);
      const maven = active.find(e => e.company === 'Maven');
      assert.ok(maven);
      assert.equal(maven.title, 'VP Engineering');
    });

    it('extracts all key-value fields', () => {
      const { active } = parseApplicationsFile(FIXTURE);
      const maven = active.find(e => e.company === 'Maven');
      assert.equal(maven.stage, 'Screen');
      assert.equal(maven.applied, '2026-04-01');
      assert.equal(maven.nextAction, 'Prep for technical interview');
      assert.equal(maven.contacts, 'Jane Doe (Recruiter)');
      assert.equal(maven.url, 'https://jobs.lever.co/maven/abc123');
      assert.equal(maven.notes, 'Strong culture fit');
    });

    it('extracts lastActivity as object', () => {
      const { active } = parseApplicationsFile(FIXTURE);
      const maven = active.find(e => e.company === 'Maven');
      assert.deepEqual(maven.lastActivity, {
        date: '2026-04-08',
        detail: 'Phone screen with recruiter',
      });
    });

    it('extracts history entries', () => {
      const { active } = parseApplicationsFile(FIXTURE);
      const maven = active.find(e => e.company === 'Maven');
      assert.equal(maven.history.length, 3);
      assert.deepEqual(maven.history[0], {
        date: '2026-04-01',
        stage: 'Applied',
        detail: 'Submitted via website',
      });
    });

    it('handles empty optional fields', () => {
      const { active } = parseApplicationsFile(FIXTURE);
      const acme = active.find(e => e.company === 'Acme Corp');
      assert.equal(acme.contacts, '');
      assert.equal(acme.notes, '');
    });

    it('parses closed entry with reason and summary', () => {
      const { closed } = parseApplicationsFile(FIXTURE);
      const initech = closed.find(e => e.company === 'Initech');
      assert.ok(initech);
      assert.deepEqual(initech.closed, {
        date: '2026-03-28',
        reason: 'rejected',
        summary: 'No response after phone screen',
      });
    });

    it('parses closed entry stage as "Closed"', () => {
      const { closed } = parseApplicationsFile(FIXTURE);
      const initech = closed.find(e => e.company === 'Initech');
      assert.equal(initech.stage, 'Closed (rejected)');
    });

    it('returns empty arrays for empty content', () => {
      const result = parseApplicationsContent('');
      assert.deepEqual(result, { active: [], closed: [] });
    });

    it('returns empty arrays for header-only content', () => {
      const result = parseApplicationsContent('# Application Pipeline\n\nLast updated: 2026-04-08\n');
      assert.deepEqual(result, { active: [], closed: [] });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/applications.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the parser**

Create `scripts/lib/applications.js`:

```js
const fs = require('fs');
const path = require('path');
const { resolveStateFile, atomicWriteFileSync, ensureDir } = require('./util');

const HEADING_RE = /^### (.+?) — (.+)$/;
const KEY_VALUE_RE = /^- \*\*(.+?)\*\*:\s*(.*)$/;
const HISTORY_RE = /^- (\d{4}-\d{2}-\d{2}):\s*(.+?)\s*—\s*(.+)$/;
const LAST_ACTIVITY_RE = /^(\d{4}-\d{2}-\d{2})\s*—\s*(.+)$/;
const CLOSED_STAGE_RE = /^Closed\s*\((\w+)\)$/;
const SECTION_RE = /^## (Active Applications|Closed Applications)$/;

function makeEntry() {
  return {
    company: null,
    title: null,
    stage: null,
    applied: null,
    lastActivity: { date: null, detail: null },
    nextAction: null,
    contacts: null,
    url: null,
    notes: null,
    history: [],
    closed: null,
  };
}

function parseApplicationsContent(content) {
  if (!content || !content.trim()) {
    return { active: [], closed: [] };
  }

  const lines = content.split('\n');
  const active = [];
  const closed = [];
  let currentSection = null;
  let currentEntry = null;
  let inHistory = false;

  function pushEntry() {
    if (!currentEntry || !currentEntry.company) return;
    if (currentSection === 'active') {
      active.push(currentEntry);
    } else if (currentSection === 'closed') {
      closed.push(currentEntry);
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    const sectionMatch = trimmed.match(SECTION_RE);
    if (sectionMatch) {
      pushEntry();
      currentEntry = null;
      inHistory = false;
      currentSection = sectionMatch[1] === 'Active Applications' ? 'active' : 'closed';
      continue;
    }

    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      pushEntry();
      currentEntry = makeEntry();
      currentEntry.company = headingMatch[1];
      currentEntry.title = headingMatch[2];
      inHistory = false;
      continue;
    }

    if (!currentEntry) continue;

    if (trimmed === '#### History') {
      inHistory = true;
      continue;
    }

    if (trimmed === '---') {
      continue;
    }

    if (inHistory) {
      const histMatch = trimmed.match(HISTORY_RE);
      if (histMatch) {
        currentEntry.history.push({
          date: histMatch[1],
          stage: histMatch[2],
          detail: histMatch[3],
        });
      }
      continue;
    }

    const kvMatch = trimmed.match(KEY_VALUE_RE);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      switch (key) {
        case 'Stage':
          currentEntry.stage = value;
          if (currentSection === 'closed') {
            const closedMatch = value.match(CLOSED_STAGE_RE);
            if (closedMatch) {
              currentEntry.closed = currentEntry.closed || {};
              currentEntry.closed.reason = closedMatch[1];
            }
          }
          break;
        case 'Applied':
          currentEntry.applied = value || null;
          break;
        case 'Last activity': {
          const laMatch = value.match(LAST_ACTIVITY_RE);
          if (laMatch) {
            currentEntry.lastActivity = { date: laMatch[1], detail: laMatch[2] };
          } else {
            currentEntry.lastActivity = { date: value, detail: null };
          }
          break;
        }
        case 'Next action':
          currentEntry.nextAction = value || null;
          break;
        case 'Contacts':
          currentEntry.contacts = value;
          break;
        case 'URL':
          currentEntry.url = value || null;
          break;
        case 'Notes':
          currentEntry.notes = value;
          break;
        case 'Closed':
          currentEntry.closed = currentEntry.closed || {};
          currentEntry.closed.date = value || null;
          break;
        case 'Summary':
          currentEntry.closed = currentEntry.closed || {};
          currentEntry.closed.summary = value || null;
          break;
      }
    }
  }

  pushEntry();
  return { active, closed };
}

function parseApplicationsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseApplicationsContent(content);
}

function parseApplications(dir) {
  const file = resolveStateFile(dir, 'applications');
  if (!file) return { active: [], closed: [] };
  return parseApplicationsFile(file);
}

module.exports = {
  parseApplicationsContent,
  parseApplicationsFile,
  parseApplications,
  makeEntry,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/applications.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat: add applications markdown parser"
```

---

### Task 4: Build the formatter (round-trip)

**Files:**
- Modify: `scripts/lib/applications.js`
- Modify: `tests/applications.test.js`

- [ ] **Step 1: Write failing tests for the formatter**

Add to `tests/applications.test.js`:

```js
const { formatApplication, formatApplicationsFile } = require('../scripts/lib/applications');

describe('applications formatter', () => {
  it('formats a single active entry', () => {
    const md = formatApplication({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Screen',
      applied: '2026-04-01',
      lastActivity: { date: '2026-04-08', detail: 'Phone screen with recruiter' },
      nextAction: 'Prep for technical interview',
      contacts: 'Jane Doe (Recruiter)',
      url: 'https://jobs.lever.co/maven/abc123',
      notes: 'Strong culture fit',
      history: [
        { date: '2026-04-01', stage: 'Applied', detail: 'Submitted via website' },
      ],
      closed: null,
    });
    assert.ok(md.includes('### Maven — VP Engineering'));
    assert.ok(md.includes('- **Stage**: Screen'));
    assert.ok(md.includes('- **Applied**: 2026-04-01'));
    assert.ok(md.includes('- 2026-04-01: Applied — Submitted via website'));
  });

  it('formats a closed entry with reason', () => {
    const md = formatApplication({
      company: 'Initech',
      title: 'VP of Engineering',
      stage: 'Closed (rejected)',
      applied: '2026-03-15',
      lastActivity: { date: null, detail: null },
      nextAction: null,
      contacts: null,
      url: null,
      notes: null,
      history: [
        { date: '2026-03-15', stage: 'Applied', detail: 'Submitted via referral' },
      ],
      closed: { date: '2026-03-28', reason: 'rejected', summary: 'No response' },
    });
    assert.ok(md.includes('- **Stage**: Closed (rejected)'));
    assert.ok(md.includes('- **Closed**: 2026-03-28'));
    assert.ok(md.includes('- **Summary**: No response'));
  });

  it('round-trips: parse → format → parse produces equivalent entries', () => {
    const original = parseApplicationsFile(FIXTURE);
    const formatted = formatApplicationsFile(original);
    const reparsed = parseApplicationsContent(formatted);

    assert.equal(reparsed.active.length, original.active.length);
    assert.equal(reparsed.closed.length, original.closed.length);

    for (let i = 0; i < original.active.length; i++) {
      assert.equal(reparsed.active[i].company, original.active[i].company);
      assert.equal(reparsed.active[i].stage, original.active[i].stage);
      assert.equal(reparsed.active[i].applied, original.active[i].applied);
      assert.equal(reparsed.active[i].history.length, original.active[i].history.length);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/applications.test.js`
Expected: FAIL — `formatApplication` is not a function

- [ ] **Step 3: Implement the formatter**

Add to `scripts/lib/applications.js`:

```js
function formatApplication(entry) {
  const lines = [];
  lines.push(`### ${entry.company} — ${entry.title}`);

  lines.push(`- **Stage**: ${entry.stage}`);
  lines.push(`- **Applied**: ${entry.applied || ''}`);

  if (entry.closed) {
    lines.push(`- **Closed**: ${entry.closed.date || ''}`);
    lines.push(`- **Summary**: ${entry.closed.summary || ''}`);
  } else {
    const la = entry.lastActivity || {};
    const laValue = la.date && la.detail ? `${la.date} — ${la.detail}` : (la.date || '');
    lines.push(`- **Last activity**: ${laValue}`);
    lines.push(`- **Next action**: ${entry.nextAction || ''}`);
    lines.push(`- **Contacts**: ${entry.contacts || ''}`);
    lines.push(`- **URL**: ${entry.url || ''}`);
    lines.push(`- **Notes**: ${entry.notes || ''}`);
  }

  if (entry.history && entry.history.length > 0) {
    lines.push('');
    lines.push('#### History');
    for (const h of entry.history) {
      lines.push(`- ${h.date}: ${h.stage} — ${h.detail}`);
    }
  }

  return lines.join('\n');
}

function formatApplicationsFile({ active, closed }) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [];

  lines.push('# Application Pipeline');
  lines.push('');
  lines.push(`Last updated: ${today}`);
  lines.push('');
  lines.push('## Active Applications');

  for (let i = 0; i < active.length; i++) {
    lines.push('');
    lines.push(formatApplication(active[i]));
    lines.push('');
    lines.push('---');
  }

  lines.push('');
  lines.push('## Closed Applications');

  for (let i = 0; i < closed.length; i++) {
    lines.push('');
    lines.push(formatApplication(closed[i]));
    lines.push('');
    lines.push('---');
  }

  return lines.join('\n') + '\n';
}
```

Export `formatApplication` and `formatApplicationsFile`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/applications.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat: add applications markdown formatter with round-trip"
```

---

### Task 5: Build `createApplication`

**Files:**
- Modify: `scripts/lib/applications.js`
- Modify: `tests/applications.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/applications.test.js`:

```js
const fs = require('fs');
const os = require('os');
const { createApplication, parseApplications } = require('../scripts/lib/applications');

describe('createApplication', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a new file when none exists', () => {
    createApplication(tmpDir, {
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
      url: 'https://jobs.lever.co/maven/abc123',
    });

    const { active } = parseApplications(tmpDir);
    assert.equal(active.length, 1);
    assert.equal(active[0].company, 'Maven');
    assert.equal(active[0].stage, 'Applied');
  });

  it('defaults applied date to today', () => {
    createApplication(tmpDir, {
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
    });

    const today = new Date().toISOString().slice(0, 10);
    const { active } = parseApplications(tmpDir);
    assert.equal(active[0].applied, today);
  });

  it('appends to existing file', () => {
    createApplication(tmpDir, {
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
    });
    createApplication(tmpDir, {
      company: 'Acme',
      title: 'Senior Director',
      stage: 'Discovery',
    });

    const { active } = parseApplications(tmpDir);
    assert.equal(active.length, 2);
  });

  it('creates initial history entry', () => {
    createApplication(tmpDir, {
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
    });

    const { active } = parseApplications(tmpDir);
    assert.equal(active[0].history.length, 1);
    assert.equal(active[0].history[0].stage, 'Applied');
  });

  it('rejects invalid entry', () => {
    assert.throws(() => {
      createApplication(tmpDir, { company: '', title: 'VP', stage: 'Applied' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/applications.test.js`
Expected: FAIL — `createApplication` is not a function

- [ ] **Step 3: Implement `createApplication`**

Add to `scripts/lib/applications.js`:

```js
const { validateApplicationEntry } = require('./validators');

function createApplication(dir, entry) {
  const validation = validateApplicationEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid application entry: ${validation.errors.join(', ')}`);
  }

  ensureDir(dir);

  const today = new Date().toISOString().slice(0, 10);
  const applied = entry.applied || today;

  const newEntry = {
    ...makeEntry(),
    company: entry.company,
    title: entry.title,
    stage: entry.stage,
    applied,
    url: entry.url || null,
    notes: entry.notes || '',
    contacts: entry.contacts || '',
    nextAction: entry.nextAction || null,
    lastActivity: { date: applied, detail: `${entry.stage} — Added to pipeline` },
    history: [{ date: applied, stage: entry.stage, detail: 'Added to pipeline' }],
  };

  const existing = resolveStateFile(dir, 'applications');

  if (existing) {
    const data = parseApplicationsFile(existing);
    data.active.push(newEntry);
    atomicWriteFileSync(existing, formatApplicationsFile(data));
  } else {
    const fileName = `${today}-applications.md`;
    const data = { active: [newEntry], closed: [] };
    atomicWriteFileSync(path.join(dir, fileName), formatApplicationsFile(data));
  }
}
```

Export `createApplication`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/applications.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat: add createApplication for new pipeline entries"
```

---

### Task 6: Build `updateApplication` and `addNote`

**Files:**
- Modify: `scripts/lib/applications.js`
- Modify: `tests/applications.test.js`

- [ ] **Step 1: Write failing tests for `updateApplication`**

Add to `tests/applications.test.js`:

```js
const { updateApplication } = require('../scripts/lib/applications');

describe('updateApplication', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-'));
    createApplication(tmpDir, {
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('transitions stage and appends history', () => {
    updateApplication(tmpDir, {
      company: 'Maven',
      stage: 'Screen',
      detail: 'Phone screen with recruiter',
    });

    const { active } = parseApplications(tmpDir);
    const maven = active.find(e => e.company === 'Maven');
    assert.equal(maven.stage, 'Screen');
    assert.equal(maven.history.length, 2);
    assert.equal(maven.history[1].stage, 'Screen');
    assert.equal(maven.history[1].detail, 'Phone screen with recruiter');
  });

  it('updates lastActivity date to today', () => {
    updateApplication(tmpDir, {
      company: 'Maven',
      stage: 'Screen',
      detail: 'Phone screen',
    });

    const today = new Date().toISOString().slice(0, 10);
    const { active } = parseApplications(tmpDir);
    assert.equal(active[0].lastActivity.date, today);
  });

  it('finds company case-insensitively', () => {
    updateApplication(tmpDir, {
      company: 'maven',
      stage: 'Screen',
      detail: 'Phone screen',
    });

    const { active } = parseApplications(tmpDir);
    assert.equal(active[0].stage, 'Screen');
  });

  it('finds company by substring', () => {
    updateApplication(tmpDir, {
      company: 'Mav',
      stage: 'Screen',
      detail: 'Phone screen',
    });

    const { active } = parseApplications(tmpDir);
    assert.equal(active[0].stage, 'Screen');
  });

  it('throws for invalid stage', () => {
    assert.throws(() => {
      updateApplication(tmpDir, {
        company: 'Maven',
        stage: 'Vibing',
        detail: 'test',
      });
    }, /stage must be one of/);
  });

  it('throws for no matching company', () => {
    assert.throws(() => {
      updateApplication(tmpDir, {
        company: 'Nonexistent',
        stage: 'Screen',
        detail: 'test',
      });
    }, /No application found/);
  });

  it('throws for ambiguous company match', () => {
    createApplication(tmpDir, {
      company: 'Maven Clinic',
      title: 'Director',
      stage: 'Applied',
    });

    assert.throws(() => {
      updateApplication(tmpDir, {
        company: 'Maven',
        stage: 'Screen',
        detail: 'test',
      });
    }, /Multiple applications match/);
  });
});
```

- [ ] **Step 2: Write failing tests for `addNote`**

Add to `tests/applications.test.js`:

```js
const { addNote } = require('../scripts/lib/applications');

describe('addNote', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-'));
    createApplication(tmpDir, {
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Applied',
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends note text to Notes field', () => {
    addNote(tmpDir, {
      company: 'Maven',
      note: 'Cover letter generated 2026-04-09',
    });

    const { active } = parseApplications(tmpDir);
    assert.ok(active[0].notes.includes('Cover letter generated 2026-04-09'));
  });

  it('appends history entry', () => {
    addNote(tmpDir, {
      company: 'Maven',
      note: 'Cover letter generated 2026-04-09',
    });

    const { active } = parseApplications(tmpDir);
    const last = active[0].history[active[0].history.length - 1];
    assert.ok(last.detail.includes('Cover letter generated'));
  });

  it('updates lastActivity', () => {
    addNote(tmpDir, {
      company: 'Maven',
      note: 'Resume tailored',
    });

    const today = new Date().toISOString().slice(0, 10);
    const { active } = parseApplications(tmpDir);
    assert.equal(active[0].lastActivity.date, today);
  });

  it('throws for no matching company', () => {
    assert.throws(() => {
      addNote(tmpDir, { company: 'Nonexistent', note: 'test' });
    }, /No application found/);
  });

  it('preserves existing notes when appending', () => {
    addNote(tmpDir, { company: 'Maven', note: 'First note' });
    addNote(tmpDir, { company: 'Maven', note: 'Second note' });

    const { active } = parseApplications(tmpDir);
    assert.ok(active[0].notes.includes('First note'));
    assert.ok(active[0].notes.includes('Second note'));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test tests/applications.test.js`
Expected: FAIL — `updateApplication` and `addNote` are not functions

- [ ] **Step 4: Implement `updateApplication` and `addNote`**

Add to `scripts/lib/applications.js`:

```js
const { VALID_STAGES } = require('./validators');

function findApplication(data, companyQuery) {
  const query = companyQuery.toLowerCase();
  const allEntries = [...data.active, ...data.closed];
  const matches = allEntries.filter(e =>
    e.company.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    throw new Error(`No application found matching "${companyQuery}"`);
  }
  if (matches.length > 1) {
    const names = matches.map(e => e.company).join(', ');
    throw new Error(`Multiple applications match "${companyQuery}": ${names}`);
  }

  return matches[0];
}

function updateApplication(dir, { company, stage, detail }) {
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`stage must be one of: ${VALID_STAGES.join(', ')}`);
  }

  const file = resolveStateFile(dir, 'applications');
  if (!file) {
    throw new Error('No applications file found');
  }

  const data = parseApplicationsFile(file);
  const entry = findApplication(data, company);
  const today = new Date().toISOString().slice(0, 10);

  entry.stage = stage;
  entry.lastActivity = { date: today, detail: detail || stage };
  entry.history.push({ date: today, stage, detail: detail || stage });

  atomicWriteFileSync(file, formatApplicationsFile(data));
}

function addNote(dir, { company, note }) {
  const file = resolveStateFile(dir, 'applications');
  if (!file) {
    throw new Error('No applications file found');
  }

  const data = parseApplicationsFile(file);
  const entry = findApplication(data, company);
  const today = new Date().toISOString().slice(0, 10);

  if (entry.notes) {
    entry.notes = entry.notes + '; ' + note;
  } else {
    entry.notes = note;
  }

  entry.lastActivity = { date: today, detail: note };
  entry.history.push({ date: today, stage: entry.stage, detail: note });

  atomicWriteFileSync(file, formatApplicationsFile(data));
}
```

Export `updateApplication`, `addNote`, and `findApplication`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test tests/applications.test.js`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat: add updateApplication and addNote for stage transitions and annotations"
```

---

### Task 7: Wire CLI — add applications to `scripts/state.js`

**Files:**
- Modify: `scripts/state.js`

- [ ] **Step 1: Add applications require and type recognition**

At the top of `scripts/state.js`, add:

```js
const applications = require('./lib/applications');
```

Update the type validation (line 80):

```js
if (!['seen-postings', 'preferences', 'applications'].includes(type)) {
  console.error(`Unknown type: ${type}. Must be "seen-postings", "preferences", or "applications".`);
  process.exit(1);
}
```

Add `applications`-only commands to the guard:

```js
const SEEN_POSTINGS_COMMANDS = ['query', 'dedup-check', 'flag'];
const APPLICATIONS_COMMANDS = ['update', 'add-note', 'create'];
```

Add guard check after the seen-postings guard:

```js
if (APPLICATIONS_COMMANDS.includes(command) && type !== 'applications') {
  console.error(`${command} is only supported for applications`);
  process.exit(1);
}
```

- [ ] **Step 2: Add switch cases for new commands**

In the `switch (command)` block, add:

```js
case 'update':
  handleUpdate(args.slice(2));
  break;
case 'add-note':
  handleAddNote(args.slice(2));
  break;
case 'create':
  handleCreate(type, args[2]);
  break;
```

- [ ] **Step 3: Add handler functions**

```js
function handleUpdate(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.company) {
    console.error('update requires --company');
    process.exit(1);
  }
  if (!opts.stage) {
    console.error('update requires --stage');
    process.exit(1);
  }
  applications.updateApplication(OUTPUT_DIR, {
    company: opts.company,
    stage: opts.stage,
    detail: opts.detail || null,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleAddNote(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.company) {
    console.error('add-note requires --company');
    process.exit(1);
  }
  if (!opts.note) {
    console.error('add-note requires --note');
    process.exit(1);
  }
  applications.addNote(OUTPUT_DIR, {
    company: opts.company,
    note: opts.note,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleCreate(type, jsonStr) {
  if (!jsonStr) {
    console.error('create requires a JSON argument');
    process.exit(1);
  }
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
    process.exit(1);
  }
  applications.createApplication(OUTPUT_DIR, entry);
  console.log(JSON.stringify({ success: true }));
}
```

- [ ] **Step 4: Update `handleRead` for applications**

Add an `else if` branch in `handleRead`:

```js
} else if (type === 'applications') {
  const data = applications.parseApplications(OUTPUT_DIR);
  const opts = parseArgs(process.argv.slice(4));
  let entries = [...data.active, ...data.closed];
  if (opts.stage) {
    entries = entries.filter(e => e.stage === opts.stage);
  }
  console.log(JSON.stringify(entries, null, 2));
}
```

- [ ] **Step 5: Update usage text**

Update the `usage()` function to include the new commands and type.

- [ ] **Step 6: Run existing tests to verify nothing is broken**

Run: `bun test`
Expected: All existing tests still PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/state.js
git commit -m "feat: wire applications type into state.js CLI"
```

---

### Task 8: Add CLI integration tests for applications

**Files:**
- Modify: `tests/state-cli.test.js`

- [ ] **Step 1: Add CLI tests**

Add a new `describe` block to `tests/state-cli.test.js`:

```js
describe('applications', () => {
  const APP_ENTRY = JSON.stringify({
    company: 'TestCorp',
    title: 'VP Engineering',
    stage: 'Applied',
    url: 'https://example.com/job/123',
  });

  // Clean up test file after all application tests
  afterEach(() => {
    const fs = require('fs');
    const outputDir = path.join(__dirname, '..', 'output');
    const files = fs.readdirSync(outputDir).filter(f => f.includes('-applications.md'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(outputDir, f), 'utf8');
      if (content.includes('TestCorp')) {
        fs.unlinkSync(path.join(outputDir, f));
      }
    }
  });

  it('read returns valid JSON (empty when no file)', () => {
    const { stdout } = run('read applications');
    const data = JSON.parse(stdout);
    assert.ok(Array.isArray(data));
  });

  it('create + read round-trips', () => {
    run(`create applications '${APP_ENTRY}'`);
    const { stdout } = run('read applications');
    const data = JSON.parse(stdout);
    const entry = data.find(e => e.company === 'TestCorp');
    assert.ok(entry);
    assert.equal(entry.stage, 'Applied');
  });

  it('update transitions stage', () => {
    run(`create applications '${APP_ENTRY}'`);
    run('update applications --company TestCorp --stage Screen --detail "Recruiter call"');
    const { stdout } = run('read applications');
    const data = JSON.parse(stdout);
    const entry = data.find(e => e.company === 'TestCorp');
    assert.equal(entry.stage, 'Screen');
  });

  it('add-note appends note', () => {
    run(`create applications '${APP_ENTRY}'`);
    run('add-note applications --company TestCorp --note "Cover letter generated"');
    const { stdout } = run('read applications');
    const data = JSON.parse(stdout);
    const entry = data.find(e => e.company === 'TestCorp');
    assert.ok(entry.notes.includes('Cover letter generated'));
  });

  it('exits non-zero for update with unknown stage', () => {
    run(`create applications '${APP_ENTRY}'`);
    const { exitCode } = run('update applications --company TestCorp --stage Vibing', true);
    assert.ok(exitCode !== 0);
  });

  it('exits non-zero for update with missing --company', () => {
    const { exitCode } = run('update applications --stage Screen', true);
    assert.ok(exitCode !== 0);
  });

  it('exits non-zero for add-note with no matching company', () => {
    const { exitCode } = run('add-note applications --company Nonexistent --note "test"', true);
    assert.ok(exitCode !== 0);
  });

  it('exits non-zero for update on wrong type', () => {
    const { exitCode } = run('update seen-postings --company Test --stage Screen', true);
    assert.ok(exitCode !== 0);
  });

  it('exits non-zero for add-note on wrong type', () => {
    const { exitCode } = run('add-note preferences --company Test --note "test"', true);
    assert.ok(exitCode !== 0);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/state-cli.test.js
git commit -m "test: add CLI integration tests for applications state management"
```

---

### Task 9: Update `skills/_shared/state-io.md`

**Files:**
- Modify: `skills/_shared/state-io.md`

- [ ] **Step 1: Replace the applications section**

Replace lines 77-83 of `skills/_shared/state-io.md` (the current brief applications section) with:

```markdown
### Entry Format (applications)

The applications state file uses a different structure from the append-only
types. See `skills/application-tracker/pipeline-schema.md` for the full schema.

**CLI subcommands for applications:**

\`\`\`bash
# Read all entries (or filter by stage)
bun scripts/state.js read applications
bun scripts/state.js read applications --stage Applied

# Create a new pipeline entry
bun scripts/state.js create applications '{"company":"...","title":"...","stage":"Applied","url":"..."}'

# Transition to a new stage
bun scripts/state.js update applications --company "Company Name" --stage Screen --detail "Phone screen with recruiter"

# Append a note (e.g., after generating a cover letter or tailoring a resume)
bun scripts/state.js add-note applications --company "Company Name" --note "Cover letter generated 2026-04-09"
\`\`\`

The `update` and `add-note` commands find entries by case-insensitive substring
match on company name. They auto-timestamp `lastActivity` and append to the
entry's history log. If no matching entry is found, the command exits non-zero.

Skills that call `add-note` as a side effect (e.g., cover-letter, resume-tailor)
should treat a non-zero exit as non-fatal — log a note and continue.
```

- [ ] **Step 2: Commit**

```bash
git add skills/_shared/state-io.md
git commit -m "docs: add applications CLI subcommands to state-io module"
```

---

### Task 10: Wire cover-letter skill

**Files:**
- Modify: `skills/cover-letter/SKILL.md`

- [ ] **Step 1: Add applications note after state update**

After the existing `## State Update` section (after line 133 of `skills/cover-letter/SKILL.md`), add:

```markdown

### Applications Pipeline (if tracked)

If the company has an entry in the applications pipeline, record the cover letter:

\`\`\`fish
bun scripts/state.js add-note applications --company "{company}" --note "Cover letter generated {YYYY-MM-DD}"
\`\`\`

If the command exits non-zero (no matching application entry), this is expected
for roles not yet in the pipeline. Log a note to the user:

> "No application entry found for {company} — skipping pipeline update.
> Run /application-tracker to add it."

Do not fail the skill run.
```

- [ ] **Step 2: Commit**

```bash
git add skills/cover-letter/SKILL.md
git commit -m "feat: wire cover-letter skill to applications add-note"
```

---

### Task 11: Wire resume-tailor skill

**Files:**
- Modify: `skills/resume-tailor/SKILL.md`

- [ ] **Step 1: Add applications note after state update**

After the existing `## Phase 4 — State Update` section (after line 107 of `skills/resume-tailor/SKILL.md`), add:

```markdown

### Applications Pipeline (if tracked)

If the company has an entry in the applications pipeline, record the resume tailoring:

\`\`\`fish
bun scripts/state.js add-note applications --company "{company}" --note "Resume tailored {YYYY-MM-DD}"
\`\`\`

If the command exits non-zero (no matching application entry), this is expected
for roles not yet in the pipeline. Log a note to the user:

> "No application entry found for {company} — skipping pipeline update.
> Run /application-tracker to add it."

Do not fail the skill run.
```

- [ ] **Step 2: Commit**

```bash
git add skills/resume-tailor/SKILL.md
git commit -m "feat: wire resume-tailor skill to applications add-note"
```

---

### Task 12: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: All tests PASS — unit tests, CLI integration tests, and existing tests.

- [ ] **Step 2: Manual smoke test of the CLI**

```bash
# Create
bun scripts/state.js create applications '{"company":"SmokeTest Inc","title":"VP Engineering","stage":"Applied","url":"https://example.com/job"}'

# Read
bun scripts/state.js read applications

# Update
bun scripts/state.js update applications --company SmokeTest --stage Screen --detail "Recruiter call"

# Add note
bun scripts/state.js add-note applications --company SmokeTest --note "Resume tailored 2026-04-09"

# Read again to verify
bun scripts/state.js read applications

# Clean up
rm output/*-applications.md
```

- [ ] **Step 3: Final commit if any fixes were needed**

Only if smoke testing revealed issues that needed fixing.
