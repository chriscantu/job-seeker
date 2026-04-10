# State File Frontmatter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YAML frontmatter metadata to the three central state files (applications, seen-postings, preferences), using the existing `frontmatter.js` module.

**Architecture:** Each lib module (`applications.js`, `seen-postings.js`, `preferences.js`) gains frontmatter awareness on both read and write paths. Parsers strip frontmatter before processing content. Writers serialize frontmatter on output. Files without frontmatter get it on next write (backfill).

**Tech Stack:** Node.js, `node:test` runner, existing `scripts/lib/frontmatter.js` (parseFrontmatter / serializeFrontmatter)

---

### Task 1: Applications — Parser (Read Path)

**Files:**
- Modify: `scripts/lib/applications.js:1-5` (add require)
- Modify: `scripts/lib/applications.js:30-34` (parseApplicationsContent)
- Test: `tests/applications.test.js`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `tests/applications.test.js`:

```javascript
describe('frontmatter support', () => {
  it('parseApplicationsContent ignores frontmatter and parses body', () => {
    const content = `---
format_version: 1
last_updated: 2026-04-09
active_count: 1
closed_count: 0
---
# Application Pipeline

Last updated: 2026-04-09

## Active Applications

### Acme — VP Engineering

- **Stage**: Applied
- **Applied**: 2026-04-09
- **Last activity**: 2026-04-09 — Applied — Added to pipeline
- **Next action**: 
- **Contacts**: 
- **URL**: https://example.com/job/1
- **Notes**: Test entry

#### History
- 2026-04-09: Applied — Added to pipeline

## Closed Applications
`;
    const result = parseApplicationsContent(content);
    assert.equal(result.active.length, 1);
    assert.equal(result.active[0].company, 'Acme');
    assert.equal(result.active[0].stage, 'Applied');
    assert.equal(result.closed.length, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: PASS (the current parser happens to tolerate frontmatter because `---` is skipped by the `trimmed === '---'` check and `key: value` lines don't match any parser patterns). If it passes, that's fine — proceed to the write path. If it fails, proceed to step 3.

- [ ] **Step 3: Add frontmatter require and strip in parser**

At the top of `scripts/lib/applications.js`, add the require:

```javascript
const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');
```

In `parseApplicationsContent`, strip frontmatter before parsing:

```javascript
function parseApplicationsContent(content) {
  if (!content || !content.trim()) return { active: [], closed: [] };

  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');
  // ... rest unchanged
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(applications): strip frontmatter in parser read path (#48)"
```

---

### Task 2: Applications — Formatter (Write Path)

**Files:**
- Modify: `scripts/lib/applications.js:207-226` (formatApplicationsFile)
- Test: `tests/applications.test.js`

- [ ] **Step 1: Write the failing test**

Add to the `frontmatter support` describe block in `tests/applications.test.js`:

```javascript
it('formatApplicationsFile includes frontmatter with correct fields', () => {
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  const data = {
    active: [makeEntry({ company: 'Acme', title: 'VP Eng', stage: 'Applied', applied: '2026-04-09', history: [{ date: '2026-04-09', stage: 'Applied', detail: 'Added' }] })],
    closed: [makeEntry({ company: 'Old Co', title: 'Director', stage: 'Closed (rejected)', applied: '2026-03-01', closed: { date: '2026-03-15', reason: 'rejected', summary: 'No fit' }, history: [{ date: '2026-03-01', stage: 'Applied', detail: 'Added' }] })],
  };
  const output = formatApplicationsFile(data);
  const { meta, body } = parseFrontmatter(output);

  assert.equal(meta.format_version, '1');
  assert.ok(meta.last_updated);
  assert.equal(meta.active_count, '1');
  assert.equal(meta.closed_count, '1');
  assert.ok(body.includes('# Application Pipeline'));
  assert.ok(body.includes('### Acme — VP Eng'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: FAIL — `meta` is empty object because `formatApplicationsFile` doesn't produce frontmatter yet.

- [ ] **Step 3: Implement frontmatter in formatApplicationsFile**

Replace `formatApplicationsFile` in `scripts/lib/applications.js`:

```javascript
function formatApplicationsFile({ active, closed }) {
  const today = new Date().toISOString().slice(0, 10);
  const parts = [];

  parts.push(`# Application Pipeline\n\nLast updated: ${today}\n`);

  parts.push('## Active Applications\n');
  if (active.length > 0) {
    parts.push(active.map(formatApplication).join('\n\n---\n\n'));
    parts.push('\n');
  }

  parts.push('\n## Closed Applications\n');
  if (closed.length > 0) {
    parts.push(closed.map(formatApplication).join('\n\n---\n\n'));
    parts.push('\n');
  }

  const body = parts.join('\n') + '\n';
  const meta = {
    format_version: 1,
    last_updated: today,
    active_count: active.length,
    closed_count: closed.length,
  };
  return serializeFrontmatter(meta, body);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(applications): add frontmatter to formatApplicationsFile (#48)"
```

---

### Task 3: Applications — Round-Trip Stability

**Files:**
- Test: `tests/applications.test.js`

- [ ] **Step 1: Write the round-trip test**

Add to the `frontmatter support` describe block in `tests/applications.test.js`:

```javascript
it('round-trip: formatApplicationsFile -> parseApplicationsContent -> formatApplicationsFile is stable', () => {
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  const data = {
    active: [makeEntry({ company: 'Acme', title: 'VP Eng', stage: 'Screen', applied: '2026-04-01', lastActivity: { date: '2026-04-08', detail: 'Phone screen' }, nextAction: 'Technical interview', contacts: 'Jane Doe', url: 'https://example.com/job/1', notes: 'Good fit', history: [{ date: '2026-04-01', stage: 'Applied', detail: 'Submitted' }, { date: '2026-04-08', stage: 'Screen', detail: 'Phone screen' }] })],
    closed: [],
  };

  const firstPass = formatApplicationsFile(data);
  const parsed = parseApplicationsContent(firstPass);
  const secondPass = formatApplicationsFile(parsed);

  const first = parseFrontmatter(firstPass);
  const second = parseFrontmatter(secondPass);

  // Meta fields should match (except last_updated which is always today)
  assert.equal(first.meta.format_version, second.meta.format_version);
  assert.equal(first.meta.active_count, second.meta.active_count);
  assert.equal(first.meta.closed_count, second.meta.closed_count);

  // Body should be identical
  assert.equal(first.body, second.body);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: PASS — if it fails, debug and fix the parser/formatter until stable.

- [ ] **Step 3: Verify existing round-trip test still passes**

The existing round-trip test (`round-trips: parse → format → parse produces equivalent entries`) uses the fixture file which has no frontmatter. It should still pass because `parseApplicationsContent` strips frontmatter (empty meta for fixture), and `formatApplicationsFile` adds it, then `parseApplicationsContent` strips it again.

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```
git add tests/applications.test.js
git commit -m "test(applications): add frontmatter round-trip stability test (#48)"
```

---

### Task 4: Applications — createApplication Frontmatter Verification

**Files:**
- Test: `tests/applications.test.js`

- [ ] **Step 1: Write test verifying createApplication preserves frontmatter**

Add to the `frontmatter support` describe block:

```javascript
describe('createApplication with frontmatter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-fm-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('new file has frontmatter with correct counts', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    createApplication(tmpDir, { company: 'Acme', title: 'VP Eng', stage: 'Applied' });

    const { resolveStateFile } = require('../scripts/lib/util');
    const filePath = resolveStateFile(tmpDir, 'applications');
    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta } = parseFrontmatter(raw);

    assert.equal(meta.format_version, '1');
    assert.equal(meta.active_count, '1');
    assert.equal(meta.closed_count, '0');
  });

  it('second create updates counts in frontmatter', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    createApplication(tmpDir, { company: 'Acme', title: 'VP Eng', stage: 'Applied' });
    createApplication(tmpDir, { company: 'Beta', title: 'Director', stage: 'Screen' });

    const { resolveStateFile } = require('../scripts/lib/util');
    const filePath = resolveStateFile(tmpDir, 'applications');
    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta } = parseFrontmatter(raw);

    assert.equal(meta.active_count, '2');
    assert.equal(meta.closed_count, '0');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test tests/applications.test.js 2>&1 | tail -20`
Expected: PASS — `createApplication` calls `formatApplicationsFile` which now produces frontmatter.

- [ ] **Step 3: Commit**

```
git add tests/applications.test.js
git commit -m "test(applications): verify createApplication produces frontmatter (#48)"
```

---

### Task 5: Seen-Postings — Parser (Read Path)

**Files:**
- Modify: `scripts/lib/seen-postings.js:1-3` (add require)
- Modify: `scripts/lib/seen-postings.js:178-219` (parseSeenPostingsContent)
- Test: `tests/seen-postings.test.js`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `tests/seen-postings.test.js`:

```javascript
const { parseSeenPostingsContent } = require('../scripts/lib/seen-postings');

// Add at the end of the file:
describe('frontmatter support', () => {
  it('parseSeenPostingsContent ignores frontmatter and parses body', () => {
    const content = `---
format_version: 1
last_updated: 2026-04-09
---
# Job Search — Seen Postings

## 2026-04-09
- TestCo | VP Engineering | https://example.com/job/1 | posted:2026-04-09
`;
    const entries = parseSeenPostingsContent(content);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].company, 'TestCo');
    assert.equal(entries[0].url, 'https://example.com/job/1');
  });
});
```

Note: add `parseSeenPostingsContent` to the destructured require at the top of the test file if not already imported (it's imported in `seen-postings.test.js` — check the existing require and add if needed).

- [ ] **Step 2: Run test to verify it fails (or passes)**

Run: `bun test tests/seen-postings.test.js 2>&1 | tail -20`
Expected: May pass already since the parser skips lines that don't match known patterns. If it passes, good — still add the code change for explicitness.

- [ ] **Step 3: Add frontmatter require and strip in parser**

At the top of `scripts/lib/seen-postings.js`, add:

```javascript
const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');
```

In `parseSeenPostingsContent`, strip frontmatter:

```javascript
function parseSeenPostingsContent(content) {
  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');
  // ... rest unchanged
```

- [ ] **Step 4: Run all seen-postings tests to verify no regressions**

Run: `bun test tests/seen-postings.test.js tests/seen-postings-writer.test.js tests/seen-postings-query.test.js 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/seen-postings.js tests/seen-postings.test.js
git commit -m "feat(seen-postings): strip frontmatter in parser read path (#48)"
```

---

### Task 6: Seen-Postings — appendSeenPosting (Write Path)

**Files:**
- Modify: `scripts/lib/seen-postings.js:283-313` (appendSeenPosting)
- Test: `tests/seen-postings-writer.test.js`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `tests/seen-postings-writer.test.js`:

```javascript
describe('frontmatter support', () => {
  it('appendSeenPosting preserves existing frontmatter and updates last_updated', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}-seen-postings.md`;
    fs.writeFileSync(path.join(TMP_DIR, fileName),
      `---\nformat_version: 1\nlast_updated: 2026-01-01\n---\n# Job Search — Seen Postings\n\n## ${today}\n- Old | VP Eng | https://example.com/old | posted:${today}\n`
    );

    appendSeenPosting(TMP_DIR, {
      company: 'NewCo',
      title: 'VP Engineering',
      url: 'https://example.com/new',
      posted: '2026-04-09',
    });

    const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    assert.equal(meta.format_version, '1');
    assert.equal(meta.last_updated, today);
    assert.ok(body.includes('Old'));
    assert.ok(body.includes('NewCo'));
  });

  it('appendSeenPosting backfills frontmatter when none exists', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}-seen-postings.md`;
    fs.writeFileSync(path.join(TMP_DIR, fileName),
      `# Job Search — Seen Postings\n\n## ${today}\n- Old | VP Eng | https://example.com/old | posted:${today}\n`
    );

    appendSeenPosting(TMP_DIR, {
      company: 'NewCo',
      title: 'VP Engineering',
      url: 'https://example.com/new',
      posted: '2026-04-09',
    });

    const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
    const { meta } = parseFrontmatter(content);

    assert.equal(meta.format_version, '1');
    assert.equal(meta.last_updated, today);
  });

  it('appendSeenPosting creates new file with frontmatter', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');

    appendSeenPosting(TMP_DIR, {
      company: 'FreshCo',
      title: 'VP Engineering',
      url: 'https://example.com/fresh',
      posted: '2026-04-09',
    });

    const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('seen-postings'));
    const content = fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    assert.equal(meta.format_version, '1');
    assert.ok(meta.last_updated);
    assert.ok(body.includes('FreshCo'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/seen-postings-writer.test.js 2>&1 | tail -20`
Expected: FAIL — backfill and new-file tests fail because frontmatter isn't produced yet.

- [ ] **Step 3: Implement frontmatter in appendSeenPosting**

Replace `appendSeenPosting` in `scripts/lib/seen-postings.js`:

```javascript
function appendSeenPosting(dir, entry) {
  ensureDir(dir);

  const today = new Date().toISOString().slice(0, 10);
  const line = formatEntry(entry);
  const existing = resolveStateFile(dir, 'seen-postings');

  if (existing) {
    const raw = fs.readFileSync(existing, 'utf8');
    const { meta: existingMeta, body: content } = parseFrontmatter(raw);

    const meta = Object.keys(existingMeta).length > 0
      ? { ...existingMeta, last_updated: today }
      : { format_version: 1, last_updated: today };

    const todayHeader = `## ${today}`;
    let body = content;

    if (body.includes(todayHeader)) {
      const headerIdx = body.indexOf(todayHeader);
      const afterHeader = body.indexOf('\n', headerIdx) + 1;
      const nextSection = body.indexOf('\n## ', afterHeader);
      const insertAt = nextSection !== -1 ? nextSection : body.length;

      const before = body.slice(0, insertAt);
      const after = body.slice(insertAt);
      body = before.trimEnd() + '\n' + line + '\n' + after;
    } else {
      body = body.trimEnd() + '\n\n' + todayHeader + '\n' + line + '\n';
    }

    atomicWriteFileSync(existing, serializeFrontmatter(meta, body));
  } else {
    const fileName = `${today}-seen-postings.md`;
    const body = `# Job Search — Seen Postings\n\n## ${today}\n${line}\n`;
    const meta = { format_version: 1, last_updated: today };
    atomicWriteFileSync(path.join(dir, fileName), serializeFrontmatter(meta, body));
  }
}
```

- [ ] **Step 4: Run all seen-postings tests to verify no regressions**

Run: `bun test tests/seen-postings.test.js tests/seen-postings-writer.test.js tests/seen-postings-query.test.js 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/seen-postings.js tests/seen-postings-writer.test.js
git commit -m "feat(seen-postings): add frontmatter to appendSeenPosting (#48)"
```

---

### Task 7: Seen-Postings — flagSeenPosting (Write Path)

**Files:**
- Modify: `scripts/lib/seen-postings.js:315-353` (flagSeenPosting)
- Test: `tests/seen-postings-writer.test.js`

- [ ] **Step 1: Write the failing test**

Add to the `frontmatter support` describe block in `tests/seen-postings-writer.test.js`:

```javascript
it('flagSeenPosting preserves frontmatter and updates last_updated', () => {
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  const targetUrl = 'https://example.com/job/flag-test';
  const fileName = '2026-04-01-seen-postings.md';
  fs.writeFileSync(path.join(TMP_DIR, fileName),
    `---\nformat_version: 1\nlast_updated: 2026-04-01\n---\n# Seen Postings\n\n## 2026-04-01\n- FlagCo | VP Eng | ${targetUrl} | posted:2026-04-01\n`
  );

  const result = flagSeenPosting(TMP_DIR, targetUrl, 'RESEARCHED');
  assert.equal(result.success, true);

  const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
  const { meta, body } = parseFrontmatter(content);

  assert.equal(meta.format_version, '1');
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(meta.last_updated, today);
  assert.ok(body.includes('RESEARCHED'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/seen-postings-writer.test.js 2>&1 | tail -20`
Expected: FAIL — `flagSeenPosting` doesn't handle frontmatter yet.

- [ ] **Step 3: Implement frontmatter in flagSeenPosting**

Replace `flagSeenPosting` in `scripts/lib/seen-postings.js`:

```javascript
function flagSeenPosting(dir, url, flag) {
  if (!fs.existsSync(dir)) {
    return { success: false, error: `Directory not found: ${dir}` };
  }

  const pattern = /\d{4}-\d{2}-\d{2}-seen-postings\.md$/;
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();

  if (files.length === 0) {
    return { success: false, error: `No seen-postings file found in ${dir}` };
  }

  const normalizedTarget = normalizeUrl(url);
  const today = new Date().toISOString().slice(0, 10);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta: existingMeta, body } = parseFrontmatter(raw);
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const lineUrl = extractUrl(lines[i]);
      if (lineUrl && normalizeUrl(lineUrl) === normalizedTarget) {
        if (lines[i].includes(flag)) {
          return { success: true, alreadyFlagged: true };
        }

        lines[i] = lines[i].trimEnd() + ' | ' + flag;

        const meta = Object.keys(existingMeta).length > 0
          ? { ...existingMeta, last_updated: today }
          : { format_version: 1, last_updated: today };

        atomicWriteFileSync(filePath, serializeFrontmatter(meta, lines.join('\n')));
        return { success: true, alreadyFlagged: false };
      }
    }
  }

  return { success: false, error: `No entry found for URL: ${url}` };
}
```

- [ ] **Step 4: Run all seen-postings tests to verify no regressions**

Run: `bun test tests/seen-postings.test.js tests/seen-postings-writer.test.js tests/seen-postings-query.test.js 2>&1 | tail -30`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/seen-postings.js tests/seen-postings-writer.test.js
git commit -m "feat(seen-postings): add frontmatter to flagSeenPosting (#48)"
```

---

### Task 8: Preferences — Parser (Read Path)

**Files:**
- Modify: `scripts/lib/preferences.js:1-3` (add require)
- Modify: `scripts/lib/preferences.js:10-11` (parsePreferencesFile)
- Test: `tests/preferences.test.js`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `tests/preferences.test.js`:

```javascript
describe('frontmatter support', () => {
  it('parsePreferencesFile ignores frontmatter and parses body', () => {
    const tmpFile = path.join(TMP_DIR, '2026-04-09-preferences.md');
    setupTmpDir();
    fs.writeFileSync(tmpFile,
      `---\nformat_version: 1\nlast_updated: 2026-04-09\n---\n# Job Search — Preferences\n\n## 2026-04-09\n### Source Effectiveness\n- Indeed: 3 relevant roles\n`
    );

    const result = parsePreferencesFile(tmpFile);
    assert.equal(result.last_run_date, '2026-04-09');
    assert.ok(result.sections['2026-04-09']);
    assert.ok(result.sections['2026-04-09']['Source Effectiveness']);
    teardownTmpDir();
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes)**

Run: `bun test tests/preferences.test.js 2>&1 | tail -20`

- [ ] **Step 3: Add frontmatter require and strip in parser**

At the top of `scripts/lib/preferences.js`, add:

```javascript
const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');
```

In `parsePreferencesFile`, strip frontmatter:

```javascript
function parsePreferencesFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');
  // ... rest unchanged (was: const lines = content.split('\n');)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/preferences.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/preferences.js tests/preferences.test.js
git commit -m "feat(preferences): strip frontmatter in parser read path (#48)"
```

---

### Task 9: Preferences — appendPreferences (Write Path)

**Files:**
- Modify: `scripts/lib/preferences.js:93-130` (appendPreferences)
- Test: `tests/preferences.test.js`

- [ ] **Step 1: Write the failing tests**

Add to the `frontmatter support` describe block in `tests/preferences.test.js`:

```javascript
it('appendPreferences preserves existing frontmatter and updates last_updated', () => {
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `${today}-preferences.md`;
  setupTmpDir();
  fs.writeFileSync(path.join(TMP_DIR, fileName),
    `---\nformat_version: 1\nlast_updated: 2026-01-01\n---\n# Preferences\n\n## ${today}\n### Old Section\n- old data\n`
  );

  appendPreferences(TMP_DIR, {
    section: 'New Section',
    entries: ['new data'],
  });

  const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
  const { meta, body } = parseFrontmatter(content);

  assert.equal(meta.format_version, '1');
  assert.equal(meta.last_updated, today);
  assert.ok(body.includes('Old Section'));
  assert.ok(body.includes('New Section'));
  teardownTmpDir();
});

it('appendPreferences backfills frontmatter when none exists', () => {
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `${today}-preferences.md`;
  setupTmpDir();
  fs.writeFileSync(path.join(TMP_DIR, fileName),
    `# Preferences\n\n## ${today}\n### Old Section\n- old data\n`
  );

  appendPreferences(TMP_DIR, {
    section: 'New Section',
    entries: ['new data'],
  });

  const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
  const { meta } = parseFrontmatter(content);

  assert.equal(meta.format_version, '1');
  assert.equal(meta.last_updated, today);
  teardownTmpDir();
});

it('appendPreferences creates new file with frontmatter', () => {
  const { parseFrontmatter } = require('../scripts/lib/frontmatter');
  setupTmpDir();

  appendPreferences(TMP_DIR, {
    section: 'Source Effectiveness',
    entries: ['Indeed: 3 relevant roles'],
  });

  const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('preferences'));
  const content = fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8');
  const { meta, body } = parseFrontmatter(content);

  assert.equal(meta.format_version, '1');
  assert.ok(meta.last_updated);
  assert.ok(body.includes('Source Effectiveness'));
  teardownTmpDir();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/preferences.test.js 2>&1 | tail -20`
Expected: FAIL — no frontmatter produced yet.

- [ ] **Step 3: Implement frontmatter in appendPreferences**

Replace `appendPreferences` in `scripts/lib/preferences.js`:

```javascript
function appendPreferences(dir, entry) {
  const { validatePreferencesEntry } = require('./validators');
  const validation = validatePreferencesEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid preferences entry: ${validation.errors.join(', ')}`);
  }

  ensureDir(dir);

  const today = new Date().toISOString().slice(0, 10);
  const existing = resolveStateFile(dir, 'preferences');

  const sectionContent = `### ${entry.section}\n${entry.entries.map(e => `- ${e}`).join('\n')}\n`;

  if (existing) {
    const raw = fs.readFileSync(existing, 'utf8');
    const { meta: existingMeta, body: content } = parseFrontmatter(raw);

    const meta = Object.keys(existingMeta).length > 0
      ? { ...existingMeta, last_updated: today }
      : { format_version: 1, last_updated: today };

    const todayHeader = `## ${today}`;
    let body = content;

    if (body.includes(todayHeader)) {
      const headerIdx = body.indexOf(todayHeader);
      const afterHeader = body.indexOf('\n', headerIdx) + 1;
      const nextSection = body.indexOf('\n## ', afterHeader);
      const insertAt = nextSection !== -1 ? nextSection : body.length;

      const before = body.slice(0, insertAt);
      const after = body.slice(insertAt);
      body = before.trimEnd() + '\n\n' + sectionContent + after;
    } else {
      body = body.trimEnd() + '\n\n' + todayHeader + '\n' + sectionContent;
    }

    atomicWriteFileSync(existing, serializeFrontmatter(meta, body));
  } else {
    const fileName = `${today}-preferences.md`;
    const body = `# Job Search — Preferences & Source Effectiveness\n\n## ${today}\n${sectionContent}`;
    const meta = { format_version: 1, last_updated: today };
    atomicWriteFileSync(path.join(dir, fileName), serializeFrontmatter(meta, body));
  }
}
```

- [ ] **Step 4: Run all tests to verify no regressions**

Run: `bun test tests/preferences.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/preferences.js tests/preferences.test.js
git commit -m "feat(preferences): add frontmatter to appendPreferences (#48)"
```

---

### Task 10: CLI Integration Test

**Files:**
- Test: `tests/state-cli.test.js`

- [ ] **Step 1: Write the integration test**

Add to the `applications` describe block in `tests/state-cli.test.js`:

```javascript
it('create produces file with frontmatter on disk', () => {
  run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });

  const files = fs.readdirSync(appTmpDir).filter(f => f.includes('applications'));
  assert.equal(files.length, 1);

  const content = fs.readFileSync(path.join(appTmpDir, files[0]), 'utf8');
  assert.ok(content.startsWith('---\n'), 'file should start with frontmatter delimiter');
  assert.ok(content.includes('format_version: 1'));
  assert.ok(content.includes('active_count: 1'));
  assert.ok(content.includes('closed_count: 0'));
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test tests/state-cli.test.js 2>&1 | tail -20`
Expected: PASS — `createApplication` already produces frontmatter from Task 2.

- [ ] **Step 3: Commit**

```
git add tests/state-cli.test.js
git commit -m "test(cli): verify applications create produces frontmatter on disk (#48)"
```

---

### Task 11: Documentation Updates

**Files:**
- Modify: `skills/_shared/state-io.md`
- Modify: `skills/_shared/frontmatter.md`

- [ ] **Step 1: Update state-io.md**

Add a new section after the "## Writing State" section in `skills/_shared/state-io.md`:

```markdown
## Frontmatter

All state files include a YAML frontmatter block before the markdown body.
The `scripts/lib/frontmatter.js` module handles parsing and serialization.

### Shared Fields (all state file types)

| Field | Type | Description |
|-------|------|-------------|
| `format_version` | integer | Format version (currently `1`), bumped on breaking changes |
| `last_updated` | date | Date the file was last written (YYYY-MM-DD) |

### Applications-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `active_count` | integer | Number of active applications (computed on write) |
| `closed_count` | integer | Number of closed applications (computed on write) |

### Backfill Behavior

Files created before frontmatter was added will receive frontmatter on their
next write operation. Parsers handle the no-frontmatter case gracefully —
`parseFrontmatter` returns empty metadata and the full content as the body.
```

- [ ] **Step 2: Update frontmatter.md**

Add a new section at the end of `skills/_shared/frontmatter.md`, after the "Reading Frontmatter (Consumers)" section:

```markdown
## Central State Files

In addition to per-company skill output files, the three central state files
also use frontmatter. These are managed by the parsers in `scripts/lib/`.

### Shared Fields

| Field | Type | Description |
|-------|------|-------------|
| `format_version` | integer | Format version (currently `1`) |
| `last_updated` | date | Date the file was last written (YYYY-MM-DD) |

### applications.md

| Field | Type | Description |
|-------|------|-------------|
| `active_count` | integer | Number of active applications (computed on write) |
| `closed_count` | integer | Number of closed applications (computed on write) |

### seen-postings.md and preferences.md

Use only the shared fields (`format_version`, `last_updated`). No computed fields.
```

- [ ] **Step 3: Commit**

```
git add skills/_shared/state-io.md skills/_shared/frontmatter.md
git commit -m "docs: document state file frontmatter schemas (#48)"
```

---

### Task 12: Full Test Suite Verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test 2>&1 | tail -30`
Expected: All tests PASS with zero failures.

- [ ] **Step 2: If any failures, debug and fix**

Read the failure output carefully. Common issues:
- Existing tests that create files manually may now get unexpected frontmatter on round-trip. Check that parsers strip it correctly.
- String assertions on file content (e.g., `content.includes('# Application Pipeline')`) should still work because frontmatter is before the heading.

- [ ] **Step 3: Final commit if any fixes were needed**

```
git add -A
git commit -m "fix: resolve test regressions from state file frontmatter (#48)"
```
