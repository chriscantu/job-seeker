# state.js Derived-State Subcommands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three derived-state subcommands (`stale-applications`, `flag-for-review`, `mark-status-changed`, `infer-stage`) to `scripts/state.js` so skills stop reaching into `scripts/lib/*` directly and stop recomputing days-since-lastActivity.

**Architecture:** Additive only — no changes to `state.js` internals or existing 9 subcommands. Each new dispatch case is a thin wrapper that parses CLI args/JSON and delegates to a `scripts/lib/*` function. One brand-new pure module (`lib/stage-inference.js`) for the natural-language → stage mapping. Skill prose updates wire `follow-up` and `scan-email` to the new CLI seam.

**Tech Stack:** Node `node:test` runner via `bun test`; `node:assert/strict`; existing fixtures in `tests/fixtures/multi/`; `child_process.execSync` for CLI dispatch tests.

---

## Context

This plan implements the recommendation in `~/.claude/plans/encapsulated-weaving-castle.md` (Change Set 1 + Change Set 3 follow-on). The earlier mechanical cleanup (daily-digest + company-research) shipped as part of the `/improve-codebase-architecture` skill exit. Two bypass classes remain unresolved because they require new CLI subcommands:

- **Class B (lib import bypass):** `skills/scan-email/SKILL.md:270-294` and `:308-328` use `bun -e "require('./scripts/lib/applications')"` to call `markStatusChanged` and `flagForReview` directly. The CLI doesn't expose these functions.
- **Class C (recomputed derived state):** `skills/follow-up/SKILL.md:58` recomputes days-since-`lastActivity.date` inline. Each consumer that needs "is this stale?" reimplements the date math.

After this plan lands:
- All write paths to `output/*-applications.md` route through `scripts/state.js`.
- `daysSinceLastActivity` lives in exactly one place (`lib/applications.staleApplications`).
- Stage-inference table from `pipeline-schema.md:43-54` exists as a tested pure function.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `scripts/lib/applications.js` | modify | Add `daysBetween(a, b)` helper + `staleApplications(dir, opts)` aggregator |
| `scripts/lib/stage-inference.js` | **create** | Pure function `inferStage(text) → stage|null` from `pipeline-schema.md:43-54` |
| `scripts/state.js` | modify | Add 4 new dispatch cases + handlers (`stale-applications`, `flag-for-review`, `mark-status-changed`, `infer-stage`) |
| `tests/applications.test.js` | modify | TDD for `daysBetween` + `staleApplications` |
| `tests/stage-inference.test.js` | **create** | TDD for `inferStage` |
| `tests/state-cli.test.js` | modify | TDD for the 4 new CLI subcommands |
| `skills/follow-up/SKILL.md` | modify | Replace days-since recompute with `state.js stale-applications` call |
| `skills/scan-email/SKILL.md` | modify | Replace `bun -e require` blocks with `state.js mark-status-changed` and `state.js flag-for-review` |

**Why split this way:** lib functions own data + computation; state.js owns CLI dispatch + arg parsing; tests mirror module shape (one test file per lib module + one combined CLI test file matching the existing convention). Each task touches exactly one lib module + one test file + (later) state.js + (last) skill prose, so commits stay reviewable.

## Execution-Mode Decision

Per `rules/execution-mode.md` sizing guard:

- 10 tasks (≥5 ✓), 8 files (≥2 ✓), ~400 LOC total
- BUT each task is an independent TDD increment ≤50 LOC with no integration coupling between tasks (additive subcommands; no shared state; no ordered handoffs)
- Single-implementer wins on the disjunctive `≤50 LOC TDD increment` criterion (`execution-mode.md` ANY-of clause)

> **[Execution mode: single-implementer]** Plan: 10 tasks across 8 files, ~400 LOC, additive-only with zero integration coupling between tasks. Each task is a self-contained TDD increment. Final cross-task review at the end per `verification.md`.

---

## Task 1: `daysBetween` helper

**Files:**
- Modify: `scripts/lib/applications.js` (add new function near top, before `parseApplicationsFile`)
- Test: `tests/applications.test.js` (add new describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/applications.test.js`:

```javascript
const { daysBetween } = require('../scripts/lib/applications');

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    assert.equal(daysBetween('2026-05-04', '2026-05-04'), 0);
  });

  it('returns positive integer days for later "to" date', () => {
    assert.equal(daysBetween('2026-04-20', '2026-05-04'), 14);
  });

  it('returns negative for earlier "to" date', () => {
    assert.equal(daysBetween('2026-05-04', '2026-04-20'), -14);
  });

  it('handles month boundaries', () => {
    assert.equal(daysBetween('2026-04-30', '2026-05-02'), 2);
  });

  it('handles year boundaries', () => {
    assert.equal(daysBetween('2025-12-31', '2026-01-02'), 2);
  });

  it('throws on invalid input', () => {
    assert.throws(() => daysBetween('2026-05', '2026-05-04'), /YYYY-MM-DD/);
    assert.throws(() => daysBetween(null, '2026-05-04'), /YYYY-MM-DD/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/applications.test.js
```

Expected: 6 failing assertions in the `daysBetween` describe block — undefined import.

- [ ] **Step 3: Write minimal implementation**

Insert near the top of `scripts/lib/applications.js`, after the existing `require` block, before `parseApplicationsFile`:

```javascript
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(fromDate, toDate) {
  if (typeof fromDate !== 'string' || !DATE_RE.test(fromDate)) {
    throw new Error(`daysBetween: fromDate must be YYYY-MM-DD, got ${fromDate}`);
  }
  if (typeof toDate !== 'string' || !DATE_RE.test(toDate)) {
    throw new Error(`daysBetween: toDate must be YYYY-MM-DD, got ${toDate}`);
  }
  const MS_PER_DAY = 86_400_000;
  const from = Date.UTC(+fromDate.slice(0, 4), +fromDate.slice(5, 7) - 1, +fromDate.slice(8, 10));
  const to = Date.UTC(+toDate.slice(0, 4), +toDate.slice(5, 7) - 1, +toDate.slice(8, 10));
  return Math.round((to - from) / MS_PER_DAY);
}
```

Add `daysBetween` to the existing `module.exports` block at the bottom of the file.

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/applications.test.js
```

Expected: all `daysBetween` tests PASS. No regressions in other tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(state): add daysBetween helper in lib/applications

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `staleApplications` aggregator

**Files:**
- Modify: `scripts/lib/applications.js` (add function after `daysBetween`)
- Test: `tests/applications.test.js` (add new describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/applications.test.js`:

```javascript
const { staleApplications } = require('../scripts/lib/applications');
const path = require('path');

describe('staleApplications', () => {
  const fs = require('fs');
  const APPLICATIONS_FIXTURE = path.join(__dirname, 'fixtures', 'applications.md');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(__dirname, 'tmp-stale-'));
    fs.cpSync(APPLICATIONS_FIXTURE, path.join(tmpDir, '2026-05-04-applications.md'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns active entries enriched with daysSinceLastActivity', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    for (const entry of result) {
      assert.ok(typeof entry.daysSinceLastActivity === 'number');
      assert.ok(entry.daysSinceLastActivity >= 0);
      assert.ok(entry.company);
      assert.ok(entry.stage);
    }
  });

  it('omits closed entries', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    for (const entry of result) {
      assert.ok(!entry.stage.startsWith('Closed'));
    }
  });

  it('uses lastActivity.date when present, falls back to applied date', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    const e = result.find(x => x.lastActivity?.date);
    if (e) {
      assert.equal(e.daysSinceLastActivity, daysBetween(e.lastActivity.date, '2026-05-04'));
    }
  });

  it('tags stalenessLevel when --warn and --alert provided', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04', warn: 14, alert: 21 });
    for (const entry of result) {
      assert.ok(['ok', 'warn', 'alert'].includes(entry.stalenessLevel));
      if (entry.daysSinceLastActivity >= 21) {
        assert.equal(entry.stalenessLevel, 'alert');
      } else if (entry.daysSinceLastActivity >= 14) {
        assert.equal(entry.stalenessLevel, 'warn');
      } else {
        assert.equal(entry.stalenessLevel, 'ok');
      }
    }
  });

  it('omits stalenessLevel when thresholds not provided', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    for (const entry of result) {
      assert.equal(entry.stalenessLevel, undefined);
    }
  });

  it('returns [] when no applications file exists', () => {
    const empty = fs.mkdtempSync(path.join(__dirname, 'tmp-empty-'));
    try {
      assert.deepEqual(staleApplications(empty, { today: '2026-05-04' }), []);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/applications.test.js
```

Expected: failures in the `staleApplications` describe block — undefined import.

- [ ] **Step 3: Write minimal implementation**

Insert in `scripts/lib/applications.js` after the `daysBetween` function:

```javascript
function staleApplications(dir, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) return [];

  const data = parseApplicationsFile(filePath);
  return (data.active || []).map(entry => {
    const referenceDate = entry.lastActivity?.date || entry.applied || today;
    const days = daysBetween(referenceDate, today);
    const enriched = { ...entry, daysSinceLastActivity: days };
    if (typeof opts.warn === 'number' && typeof opts.alert === 'number') {
      enriched.stalenessLevel = days >= opts.alert ? 'alert' : days >= opts.warn ? 'warn' : 'ok';
    }
    return enriched;
  });
}
```

Add `staleApplications` to `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/applications.test.js
```

Expected: all `staleApplications` tests PASS. No regressions.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(state): add staleApplications aggregator with optional staleness levels

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `state.js stale-applications` dispatch

**Files:**
- Modify: `scripts/state.js` (add command + handler)
- Test: `tests/state-cli.test.js` (add new describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/state-cli.test.js`:

```javascript
describe('stale-applications', () => {
  let staleTmp;

  beforeEach(() => {
    staleTmp = fs.mkdtempSync(path.join(TMP_DIR, 'stale-'));
    fs.cpSync(path.join(__dirname, 'fixtures', 'applications.md'), path.join(staleTmp, '2026-05-04-applications.md'));
  });

  afterEach(() => {
    fs.rmSync(staleTmp, { recursive: true, force: true });
  });

  it('returns active entries with daysSinceLastActivity', () => {
    const { stdout } = run('stale-applications applications --today 2026-05-04', { outputDir: staleTmp });
    const data = JSON.parse(stdout);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    for (const entry of data) {
      assert.ok(typeof entry.daysSinceLastActivity === 'number');
      assert.equal(entry.stalenessLevel, undefined);
    }
  });

  it('attaches stalenessLevel when --warn and --alert provided', () => {
    const { stdout } = run('stale-applications applications --today 2026-05-04 --warn 14 --alert 21', { outputDir: staleTmp });
    const data = JSON.parse(stdout);
    for (const entry of data) {
      assert.ok(['ok', 'warn', 'alert'].includes(entry.stalenessLevel));
    }
  });

  it('rejects --warn or --alert that are not integers', () => {
    const { stderr, exitCode } = run('stale-applications applications --warn abc --alert 21', { expectError: true, outputDir: staleTmp });
    assert.equal(exitCode, 1);
    assert.match(stderr, /integer/);
  });

  it('only supports the applications type', () => {
    const { stderr, exitCode } = run('stale-applications seen-postings', { expectError: true });
    assert.equal(exitCode, 1);
    assert.match(stderr, /only supported for applications/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/state-cli.test.js
```

Expected: 4 failing tests — `stale-applications` is not a known command (or returns wrong shape).

- [ ] **Step 3: Write minimal implementation**

In `scripts/state.js`, extend the `APPLICATIONS_COMMANDS` constant near the top:

```javascript
const APPLICATIONS_COMMANDS = ['update', 'add-note', 'create', 'close', 'reopen', 'stale-applications', 'flag-for-review', 'mark-status-changed'];
```

Add a case in the `switch (command)` block in `main()` (alongside the existing cases):

```javascript
      case 'stale-applications':
        handleStaleApplications(args.slice(2));
        break;
```

Add the handler at the bottom of the file (before `main()`):

```javascript
function handleStaleApplications(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  const aggregatorOpts = {};
  if (opts.today) aggregatorOpts.today = opts.today;
  if (opts.warn !== undefined) {
    const n = Number(opts.warn);
    if (!Number.isInteger(n)) {
      console.error('--warn must be an integer');
      process.exit(1);
    }
    aggregatorOpts.warn = n;
  }
  if (opts.alert !== undefined) {
    const n = Number(opts.alert);
    if (!Number.isInteger(n)) {
      console.error('--alert must be an integer');
      process.exit(1);
    }
    aggregatorOpts.alert = n;
  }
  const result = applications.staleApplications(OUTPUT_DIR, aggregatorOpts);
  console.log(JSON.stringify(result, null, 2));
}
```

Update the `usage()` string to document the new subcommand:

```javascript
//   bun scripts/state.js stale-applications applications [--today YYYY-MM-DD] [--warn N] [--alert N]
```

(top-of-file comment block + `usage()` Commands section).

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/state-cli.test.js
```

Expected: all 4 new tests PASS. Existing CLI tests still pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/state.js tests/state-cli.test.js
git commit -m "feat(state): add stale-applications CLI subcommand

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `state.js flag-for-review` dispatch

**Files:**
- Modify: `scripts/state.js`
- Test: `tests/state-cli.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/state-cli.test.js`:

```javascript
describe('flag-for-review', () => {
  let tmpFixtures;

  beforeEach(() => {
    tmpFixtures = path.join(__dirname, 'tmp-flag-review');
    fs.mkdirSync(tmpFixtures, { recursive: true });
    fs.cpSync(path.join(__dirname, 'fixtures', 'applications.md'), path.join(tmpFixtures, '2026-05-04-applications.md'));
  });

  afterEach(() => {
    fs.rmSync(tmpFixtures, { recursive: true, force: true });
  });

  it('appends a flagged entry from JSON arg', () => {
    const json = JSON.stringify({
      company: 'Acme',
      title: 'VP Eng',
      signal: 'Application withdrawn',
      status: 'Rejected',
      sender: 'noreply@acme.com',
      matchMethod: 'company-name',
      msgId: 'abc-123',
      detectedAt: '2026-05-04',
    });
    const { stdout } = run(`flag-for-review applications '${json}'`, { outputDir: tmpFixtures });
    const result = JSON.parse(stdout);
    assert.equal(result.success, true);
    assert.equal(result.skipped, false);
  });

  it('returns skipped:true when msgId already processed', () => {
    const json = JSON.stringify({
      company: 'Acme',
      title: 'VP Eng',
      msgId: 'dup-id',
      detectedAt: '2026-05-04',
    });
    run(`flag-for-review applications '${json}'`, { outputDir: tmpFixtures });
    const { stdout } = run(`flag-for-review applications '${json}'`, { outputDir: tmpFixtures });
    const result = JSON.parse(stdout);
    assert.equal(result.skipped, true);
    assert.match(result.reason, /msg-id/);
  });

  it('rejects malformed JSON', () => {
    const { stderr, exitCode } = run("flag-for-review applications '{not json'", { expectError: true, outputDir: tmpFixtures });
    assert.equal(exitCode, 1);
    assert.match(stderr, /JSON/);
  });

  it('only supports the applications type', () => {
    const { stderr, exitCode } = run("flag-for-review seen-postings '{}'", { expectError: true });
    assert.equal(exitCode, 1);
    assert.match(stderr, /only supported for applications/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/state-cli.test.js
```

Expected: 4 failing tests — `flag-for-review` not yet a known command.

- [ ] **Step 3: Write minimal implementation**

In `scripts/state.js`, add a case in the switch:

```javascript
      case 'flag-for-review':
        handleFlagForReview(type, args[2]);
        break;
```

Add handler:

```javascript
function handleFlagForReview(type, jsonStr) {
  if (!jsonStr) {
    console.error('flag-for-review requires a JSON argument');
    process.exit(1);
  }
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
    process.exit(1);
  }
  const result = applications.flagForReview(OUTPUT_DIR, entry);
  console.log(JSON.stringify({ success: true, ...result }));
}
```

Update top-of-file usage block + `usage()` Commands section:

```
flag-for-review applications '<json>'  Append a flagged-for-review entry
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/state-cli.test.js
```

Expected: all 4 new tests PASS. Existing tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add scripts/state.js tests/state-cli.test.js
git commit -m "feat(state): add flag-for-review CLI subcommand

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `state.js mark-status-changed` dispatch

**Files:**
- Modify: `scripts/state.js`
- Test: `tests/state-cli.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/state-cli.test.js`:

```javascript
describe('mark-status-changed', () => {
  let tmpFixtures;

  beforeEach(() => {
    tmpFixtures = path.join(__dirname, 'tmp-mark-status');
    fs.mkdirSync(tmpFixtures, { recursive: true });
    fs.cpSync(path.join(__dirname, 'fixtures', 'applications.md'), path.join(tmpFixtures, '2026-05-04-applications.md'));
  });

  afterEach(() => {
    fs.rmSync(tmpFixtures, { recursive: true, force: true });
  });

  it('rejects when matchedEntry is missing', () => {
    const json = JSON.stringify({
      msgId: 'abc',
      status: 'Interview',
      atsSender: 'greenhouse',
    });
    const { stderr, exitCode } = run(`mark-status-changed applications '${json}'`, { expectError: true, outputDir: tmpFixtures });
    assert.equal(exitCode, 1);
    assert.match(stderr, /matchedEntry/);
  });

  it('passes through to lib.markStatusChanged when args complete', () => {
    // Pull a real active entry from the fixture so the company match succeeds.
    const data = JSON.parse(run('read applications', { outputDir: tmpFixtures }).stdout);
    const active = data.find(e => !e.stage.startsWith('Closed'));
    assert.ok(active, 'fixture must contain at least one active entry');

    const json = JSON.stringify({
      msgId: 'newmsg-001',
      matchedEntry: { company: active.company, title: active.title, url: active.url || null, stage: active.stage, section: 'active' },
      status: 'Interview',
      signal: 'panel scheduled',
      atsSender: 'greenhouse',
      detectedAt: '2026-05-04',
    });
    const { stdout } = run(`mark-status-changed applications '${json}'`, { outputDir: tmpFixtures });
    const result = JSON.parse(stdout);
    assert.equal(result.success, true);
    assert.equal(result.skipped, false);
  });

  it('only supports the applications type', () => {
    const { stderr, exitCode } = run("mark-status-changed seen-postings '{}'", { expectError: true });
    assert.equal(exitCode, 1);
    assert.match(stderr, /only supported for applications/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/state-cli.test.js
```

Expected: 3 failing tests — `mark-status-changed` not yet a known command.

- [ ] **Step 3: Write minimal implementation**

In `scripts/state.js`, add a case in the switch:

```javascript
      case 'mark-status-changed':
        handleMarkStatusChanged(type, args[2]);
        break;
```

Add handler:

```javascript
function handleMarkStatusChanged(type, jsonStr) {
  if (!jsonStr) {
    console.error('mark-status-changed requires a JSON argument');
    process.exit(1);
  }
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
    process.exit(1);
  }
  const result = applications.markStatusChanged(OUTPUT_DIR, entry);
  console.log(JSON.stringify({ success: true, ...result }));
}
```

Update usage docs:

```
mark-status-changed applications '<json>'  Apply a status-change classifier result
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/state-cli.test.js
```

Expected: 3 new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/state.js tests/state-cli.test.js
git commit -m "feat(state): add mark-status-changed CLI subcommand

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `lib/stage-inference.js` pure module

**Files:**
- Create: `scripts/lib/stage-inference.js`
- Create: `tests/stage-inference.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/stage-inference.test.js`:

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { inferStage } = require('../scripts/lib/stage-inference');

describe('inferStage', () => {
  const cases = [
    ['applied', 'Applied'],
    ['I just submitted application', 'Applied'],
    ['phone screen tomorrow', 'Screen'],
    ['recruiter call went well', 'Screen'],
    ['initial call scheduled', 'Screen'],
    ['first interview today', 'Interview (1)'],
    ['technical interview prep', 'Interview (1)'],
    ['met with hiring manager', 'Interview (1)'],
    ['second interview confirmed', 'Interview (2+)'],
    ['another round next week', 'Interview (2+)'],
    ['panel interview Friday', 'Interview (2+)'],
    ['final round next monday', 'Final Round'],
    ['exec interview at 3pm', 'Final Round'],
    ['onsite scheduled', 'Final Round'],
    ['got an offer!', 'Offer'],
    ['they made an offer', 'Offer'],
    ['negotiating comp', 'Decision'],
    ['accepted the role', 'Decision'],
    ['still deciding', 'Decision'],
    ['rejected via email', 'Closed'],
    ['ghosted for 4 weeks', 'Closed'],
    ['I withdrew', 'Closed'],
    ['position closed', 'Closed'],
  ];

  for (const [input, expected] of cases) {
    it(`maps "${input}" → ${expected}`, () => {
      assert.equal(inferStage(input), expected);
    });
  }

  it('returns null on unknown text', () => {
    assert.equal(inferStage('the weather is nice'), null);
  });

  it('returns null on non-string input', () => {
    assert.equal(inferStage(null), null);
    assert.equal(inferStage(undefined), null);
    assert.equal(inferStage(42), null);
  });

  it('first-match wins (rules ordered most-specific first)', () => {
    // "second interview" must NOT match the broader Interview (1) rule
    assert.equal(inferStage('second interview today'), 'Interview (2+)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/stage-inference.test.js
```

Expected: failures — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/stage-inference.js`:

```javascript
// Maps natural-language activity descriptions to the canonical stage values
// from skills/application-tracker/pipeline-schema.md (lines 43-54).
//
// Order matters: more specific patterns must come before broader ones (e.g.
// "second interview" before "first interview" / "interview").

const RULES = [
  [/\b(rejected|ghosted|withdrew|withdrew the application|position closed)\b/i, 'Closed'],
  [/\b(negotiating|accepted|deciding)\b/i, 'Decision'],
  [/\b(got an offer|made an offer)\b/i, 'Offer'],
  [/\b(final round|exec interview|onsite)\b/i, 'Final Round'],
  [/\b(second interview|another round|panel interview)\b/i, 'Interview (2+)'],
  [/\b(first interview|technical interview|met with hiring manager)\b/i, 'Interview (1)'],
  [/\b(phone screen|recruiter call|initial call)\b/i, 'Screen'],
  [/\b(applied|submitted application)\b/i, 'Applied'],
];

function inferStage(text) {
  if (typeof text !== 'string') return null;
  for (const [re, stage] of RULES) {
    if (re.test(text)) return stage;
  }
  return null;
}

module.exports = { inferStage };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/stage-inference.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/stage-inference.js tests/stage-inference.test.js
git commit -m "feat(state): add stage-inference module for natural-language→stage mapping

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `state.js infer-stage` dispatch

**Files:**
- Modify: `scripts/state.js`
- Test: `tests/state-cli.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/state-cli.test.js`:

```javascript
describe('infer-stage', () => {
  it('returns the stage as JSON for a recognized phrase', () => {
    const { stdout } = run(`infer-stage applications --from "phone screen tomorrow"`);
    const result = JSON.parse(stdout);
    assert.equal(result.stage, 'Screen');
  });

  it('returns null stage for unrecognized phrases', () => {
    const { stdout } = run(`infer-stage applications --from "the weather is nice"`);
    const result = JSON.parse(stdout);
    assert.equal(result.stage, null);
  });

  it('rejects missing --from', () => {
    const { stderr, exitCode } = run('infer-stage applications', { expectError: true });
    assert.equal(exitCode, 1);
    assert.match(stderr, /--from/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/state-cli.test.js
```

Expected: 3 failing tests.

- [ ] **Step 3: Write minimal implementation**

In `scripts/state.js`:

1. Add to the `APPLICATIONS_COMMANDS` constant: `'infer-stage'`.

2. Add an import near the top with the other lib requires:

```javascript
const { inferStage } = require('./lib/stage-inference');
```

3. Add a case in the switch:

```javascript
      case 'infer-stage':
        handleInferStage(args.slice(2));
        break;
```

4. Add handler:

```javascript
function handleInferStage(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.from) {
    console.error('infer-stage requires --from "<text>"');
    process.exit(1);
  }
  const stage = inferStage(opts.from);
  console.log(JSON.stringify({ stage }));
}
```

5. Update usage docs.

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/state-cli.test.js
```

Expected: 3 new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/state.js tests/state-cli.test.js
git commit -m "feat(state): add infer-stage CLI subcommand

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire `follow-up` to `stale-applications`

**Files:**
- Modify: `skills/follow-up/SKILL.md` (lines 40-58)

- [ ] **Step 1: Replace days-since recompute with CLI call**

In `skills/follow-up/SKILL.md`, find the block starting "Read application state:" through "Calculate days since last activity using `lastActivity.date` and today's date." (currently lines 40-58).

Replace this block:

```markdown
Read application state:
```bash
bun scripts/state.js read applications
```

Parse the JSON output. Filter for **active applications** that meet staleness
thresholds:

| Stage | Days since last activity |
| ----- | ----------------------- |
| Applied | 10 |
| Screen | 7 |
| Interview (1) | 5 |
| Interview (2+) | 5 |
| Final Round | 5 |
| Offer | 3 |
| Decision | 3 |

Calculate days since last activity using `lastActivity.date` and today's date.
```

with this:

```markdown
Read enriched application state via the CLI (each entry includes
`daysSinceLastActivity`, computed once in `lib/applications`):

```bash
bun scripts/state.js stale-applications applications
```

Parse the JSON array. Filter for entries that meet the per-stage thresholds
below — follow-up uses stricter thresholds than the view-mode 14/21 rule
because action urgency varies by stage:

| Stage | Days since last activity |
| ----- | ----------------------- |
| Applied | 10 |
| Screen | 7 |
| Interview (1) | 5 |
| Interview (2+) | 5 |
| Final Round | 5 |
| Offer | 3 |
| Decision | 3 |
```

- [ ] **Step 2: Smoke-test the new CLI invocation**

```bash
bun scripts/state.js stale-applications applications | head -30
```

Expected: JSON array; each entry has `company`, `title`, `stage`, `daysSinceLastActivity` (integer ≥ 0). No `stalenessLevel` field (none requested).

- [ ] **Step 3: Run validators**

```bash
bun scripts/validate-structure.js
bun scripts/validate-links.js
```

Expected: no NEW issues introduced (pre-existing `mlx_env/` and `.vscode/` warnings from validate-structure are out of scope).

- [ ] **Step 4: Commit**

```bash
git add skills/follow-up/SKILL.md
git commit -m "feat(follow-up): wire to state.js stale-applications

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Wire `scan-email` to `mark-status-changed` and `flag-for-review` CLI

**Files:**
- Modify: `skills/scan-email/SKILL.md` (lines 270-294 and 308-328)

- [ ] **Step 1: Replace `markStatusChanged` inline-eval block with CLI call**

In `skills/scan-email/SKILL.md`, find the "Write status changes (from Gate 2 confirmations)" block (currently around lines 266-294).

Replace this block:

````markdown
```bash
# Write the classifier result to a temp file (the classifier output itself
# is a JSON object; capture it from the Phase 3.5 classify-status-email.js
# invocation in /tmp/scan-email-classifier-{msgId-slug}.json).

bun -e "
const fs = require('fs');
const { markStatusChanged } = require('./scripts/lib/applications');
try {
  const classifier = JSON.parse(fs.readFileSync('{classifier_result_path}', 'utf8'));
  const r = markStatusChanged('{plugin_root}/output', {
    msgId: classifier.msgId,
    matchedEntry: classifier.matchedEntry,
    status: classifier.status,
    signal: classifier.signal,
    atsSender: classifier.atsSender,
    detectedAt: '{today}',
  });
  console.log(JSON.stringify({ ok: true, result: r }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
}
"
```
````

with this:

````markdown
```bash
# The classifier result was captured in /tmp/scan-email-classifier-{msgId-slug}.json
# during Phase 3.5. Pass it through to the CLI subcommand — the CLI mirrors
# lib.markStatusChanged 1:1 and validates matchedEntry.

CLASSIFIER_JSON=$(bun -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('/tmp/scan-email-classifier-{msgId-slug}.json', 'utf8'));
process.stdout.write(JSON.stringify({
  msgId: c.msgId,
  matchedEntry: c.matchedEntry,
  status: c.status,
  signal: c.signal,
  atsSender: c.atsSender,
  detectedAt: '{today}',
}));
")
bun scripts/state.js mark-status-changed applications "$CLASSIFIER_JSON"
```

The CLI returns the same JSON shape as the prior inline `bun -e` form:

- `{success: true, skipped: false}` — applications.md was mutated
- `{success: true, skipped: true, reason: "msg-id already processed"}` — re-run idempotency
- `{success: true, skipped: true, reason: "matched closed entry"}` — courtesy email for already-closed app
- Non-zero exit + stderr — surface to user; do NOT silently continue the batch
````

Update the "REQUIRED caller contract" bullets immediately below the code block (currently lines 296-302) to reference the new shape:

Replace:

```markdown
- `{ok: false, error: ...}` — surface the error, do NOT silently continue the batch.
- `{ok: true, result: {skipped: false}}` — success, applications.md was mutated.
- `{ok: true, result: {skipped: true, reason: 'msg-id already processed'}}` — re-run idempotency; safe to ignore.
- `{ok: true, result: {skipped: true, reason: 'matched closed entry'}}` — courtesy email for an already-closed app; safe to ignore, but log to the user so they know why Gate 2 approvals sometimes don't produce writes.
- `{ok: true, result: {skipped: false}}` with a new flagged entry appearing in `## Flagged for Review` — the Active entry disappeared mid-batch; surface this to the user as a pipeline-integrity warning.
```

with:

```markdown
- Non-zero exit + stderr — surface the error, do NOT silently continue the batch.
- `{success: true, skipped: false}` — applications.md was mutated.
- `{success: true, skipped: true, reason: "msg-id already processed"}` — re-run idempotency; safe to ignore.
- `{success: true, skipped: true, reason: "matched closed entry"}` — courtesy email for an already-closed app; safe to ignore, but log to the user so they know why Gate 2 approvals sometimes don't produce writes.
- `{success: true, skipped: false}` with a new flagged entry appearing in `## Flagged for Review` — the Active entry disappeared mid-batch; surface this to the user as a pipeline-integrity warning.
```

- [ ] **Step 2: Replace `flagForReview` inline-eval block with CLI call**

In the same file, find the "Write Flagged for Review entries (LOW tier)" block (currently around lines 304-328).

Replace:

````markdown
```bash
bun -e "
const { flagForReview } = require('./scripts/lib/applications');
try {
  const r = flagForReview('{plugin_root}/output', {
    company: '<classifier.matchedEntry?.company || extract-from-sender>',
    title: '<classifier.matchedEntry?.title || \"Unknown role\">',
    signal: '<classifier.signal>',
    status: '<classifier.status>',
    sender: '<email.sender>',
    matchMethod: '<classifier.matchMethod>',
    msgId: '<classifier.msgId>',
    detectedAt: '{today}',
  });
  console.log(JSON.stringify({ ok: true, result: r }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
}
"
```
````

with:

````markdown
```bash
bun scripts/state.js flag-for-review applications '{
  "company": "<classifier.matchedEntry?.company || extract-from-sender>",
  "title": "<classifier.matchedEntry?.title || Unknown role>",
  "signal": "<classifier.signal>",
  "status": "<classifier.status>",
  "sender": "<email.sender>",
  "matchMethod": "<classifier.matchMethod>",
  "msgId": "<classifier.msgId>",
  "detectedAt": "{today}"
}'
```

The CLI returns `{success: true, skipped: false}` on append, or
`{success: true, skipped: true, reason: "msg-id already processed"}` on
re-run idempotency. Non-zero exit means JSON parse failure or unrecoverable
write error — surface to user.
````

- [ ] **Step 3: Smoke-test both CLI invocations**

```bash
# Use a tmp output dir to avoid mutating real state
mkdir -p /tmp/state-smoke
cp tests/fixtures/multi/applications.md /tmp/state-smoke/2026-05-04-applications.md

OUTPUT_DIR=/tmp/state-smoke bun scripts/state.js flag-for-review applications '{"company":"Smoke","title":"Test","msgId":"smoke-1","detectedAt":"2026-05-04"}'

OUTPUT_DIR=/tmp/state-smoke bun scripts/state.js read applications | head -5

rm -rf /tmp/state-smoke
```

Expected: first call returns `{success:true,skipped:false}`; subsequent `read` shows the flagged entry; teardown clean.

- [ ] **Step 4: Run validators**

```bash
bun scripts/validate-structure.js
bun scripts/validate-links.js
```

Expected: no NEW issues.

- [ ] **Step 5: Commit**

```bash
git add skills/scan-email/SKILL.md
git commit -m "feat(scan-email): wire to state.js mark-status-changed + flag-for-review

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final cross-task verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
bun test
```

Expected: all tests PASS. No regressions in existing applications.test.js, state-cli.test.js, or any other suite.

- [ ] **Step 2: Confirm new subcommand surface**

```bash
bun scripts/state.js 2>&1 | head -40
```

Expected: usage block lists `stale-applications`, `flag-for-review`, `mark-status-changed`, `infer-stage` alongside existing subcommands.

- [ ] **Step 3: Confirm no remaining `bun -e require.*lib/applications` in skills**

```bash
grep -rn "require.*lib/applications" skills/ scripts/ 2>&1 | grep -v "scripts/state.js" | grep -v "scripts/lib/"
```

Expected: empty output. Any hit means a skill still bypasses the CLI; investigate before declaring done.

- [ ] **Step 4: Confirm follow-up no longer recomputes days**

```bash
grep -n "Calculate days since\|lastActivity.date.*today" skills/follow-up/SKILL.md
```

Expected: empty output.

- [ ] **Step 5: Run validators**

```bash
bun scripts/validate-structure.js
bun scripts/validate-links.js
```

Expected: no new issues.

- [ ] **Step 6: Final summary commit (if any docs/usage updates straggled)**

If steps 1-5 surface no issues, no extra commit is needed. Otherwise fix and commit per discovered issue.

---

## Self-Review Checklist

After all tasks complete, run:

- [ ] **Spec coverage:** Each item in `~/.claude/plans/encapsulated-weaving-castle.md` Recommended Changes (Change Set 1 + Change Set 3 follow-on) traces to a task above:
  - "Add `flag-for-review` subcommand" → Task 4
  - "Add `stale-applications` subcommand" → Task 2 (lib) + Task 3 (CLI)
  - "Add `infer-stage` subcommand" → Task 6 (lib) + Task 7 (CLI)
  - "scan-email cleanup (lib import → CLI)" → Task 9
  - "follow-up cleanup (recompute → CLI)" → Task 8
  - **Note:** Change Set 2 (state-io.md CLI-first rewrite) is out of this plan's scope. It can ride later as a separate doc PR.

- [ ] **No placeholders:** Every step has either a concrete code block or an exact command. No "TBD", "implement appropriate handling", or "similar to Task N".

- [ ] **Type consistency:** `daysBetween` signature `(fromDate, toDate)` consistent across Task 1 + Task 2. `staleApplications` signature `(dir, opts)` consistent across Task 2 + Task 3. `inferStage(text)` consistent across Task 6 + Task 7. `flagForReview` opts mirror Task 4 + Task 9 prose. `markStatusChanged` opts mirror Task 5 + Task 9 prose.

- [ ] **Date safety:** Tests pass `--today 2026-05-04` explicitly so they don't drift as real time advances. The fixture in `tests/fixtures/multi/applications.md` is dated relative to that anchor; if fixture dates change, update the test anchor in lockstep.

## Out of Scope (deferred)

- **Change Set 2** — `skills/_shared/state-io.md` CLI-first rewrite. Mechanical doc work; ride as separate PR.
- `state.js` internal redesign / consolidation of `lib/{applications,seen-postings,preferences}.js`. User locked "no redesign of state.js internals — additive only" during the architecture-improvement skill grilling. Revisit only with new bypass evidence.
- Read-side bypasses where a skill needs an ad-hoc filter the CLI doesn't expose. Per "writes-only hard rule" decision.
