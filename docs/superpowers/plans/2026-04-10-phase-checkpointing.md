# Phase Checkpointing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `scripts/cache.js` CLI utility for phase checkpointing so multi-phase skills can resume from where they left off after failures.

**Architecture:** A lib module (`scripts/lib/cache.js`) provides `readCache`, `writeCache`, `listCaches`, `cleanCaches` functions. A CLI entrypoint (`scripts/cache.js`) routes commands to the lib module. Skills call the CLI at phase boundaries. A shared doc (`skills/_shared/phase-cache.md`) defines the convention.

**Tech Stack:** Node.js, `node:test` runner, existing `scripts/lib/util.js` (atomicWriteFileSync, ensureDir)

---

### Task 1: Cache Lib — writeCache and readCache

**Files:**
- Create: `scripts/lib/cache.js`
- Test: `tests/cache.test.js`

- [ ] **Step 1: Write the failing tests for writeCache**

Create `tests/cache.test.js`:

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'tmp-cache', '.cache');
const OUTPUT_DIR = path.join(__dirname, 'tmp-cache');

function setup() {
  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function teardown() {
  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
}

describe('cache lib', () => {
  beforeEach(() => setup());
  afterEach(() => teardown());

  describe('writeCache', () => {
    it('creates a cache file with correct metadata', () => {
      const { writeCache } = require('../scripts/lib/cache');
      writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: ['a', 'b'] });

      const filePath = path.join(CACHE_DIR, 'daily-digest-phase1.json');
      assert.ok(fs.existsSync(filePath), 'cache file should exist');

      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      assert.equal(content.skill, 'daily-digest');
      assert.equal(content.phase, 'phase1');
      assert.ok(content.cached_at);
      assert.ok(content.expires_at);
      assert.deepEqual(content.data, { roles: ['a', 'b'] });
    });

    it('sets expires_at to 2 hours after cached_at', () => {
      const { writeCache } = require('../scripts/lib/cache');
      writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: [] });

      const filePath = path.join(CACHE_DIR, 'daily-digest-phase1.json');
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const cachedAt = new Date(content.cached_at).getTime();
      const expiresAt = new Date(content.expires_at).getTime();
      assert.equal(expiresAt - cachedAt, 2 * 60 * 60 * 1000);
    });

    it('creates .cache directory if it does not exist', () => {
      const { writeCache } = require('../scripts/lib/cache');
      fs.rmSync(CACHE_DIR, { recursive: true });

      writeCache(OUTPUT_DIR, 'scan-email', 'body-fetch', { emails: [] });

      const filePath = path.join(CACHE_DIR, 'scan-email-body-fetch.json');
      assert.ok(fs.existsSync(filePath));
    });
  });

  describe('readCache', () => {
    it('returns cached data when file exists and is fresh', () => {
      const { writeCache, readCache } = require('../scripts/lib/cache');
      writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: ['x'] });

      const result = readCache(OUTPUT_DIR, 'daily-digest', 'phase1');
      assert.ok(result);
      assert.equal(result.skill, 'daily-digest');
      assert.deepEqual(result.data, { roles: ['x'] });
    });

    it('returns null when file does not exist', () => {
      const { readCache } = require('../scripts/lib/cache');
      const result = readCache(OUTPUT_DIR, 'daily-digest', 'phase1');
      assert.equal(result, null);
    });

    it('returns null when file is expired', () => {
      const { readCache } = require('../scripts/lib/cache');
      const filePath = path.join(CACHE_DIR, 'daily-digest-phase1.json');
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const content = {
        skill: 'daily-digest',
        phase: 'phase1',
        cached_at: threeHoursAgo.toISOString(),
        expires_at: new Date(threeHoursAgo.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        data: { roles: [] },
      };
      fs.writeFileSync(filePath, JSON.stringify(content));

      const result = readCache(OUTPUT_DIR, 'daily-digest', 'phase1');
      assert.equal(result, null);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/cache.test.js 2>&1 | tail -20`
Expected: FAIL — module not found

- [ ] **Step 3: Implement writeCache and readCache**

Create `scripts/lib/cache.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync, ensureDir } = require('./util');

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function cacheDir(outputDir) {
  return path.join(outputDir, '.cache');
}

function cacheFilePath(outputDir, skill, phase) {
  return path.join(cacheDir(outputDir), `${skill}-${phase}.json`);
}

function writeCache(outputDir, skill, phase, data) {
  const dir = cacheDir(outputDir);
  ensureDir(dir);

  const now = new Date();
  const content = {
    skill,
    phase,
    cached_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    data,
  };

  atomicWriteFileSync(cacheFilePath(outputDir, skill, phase), JSON.stringify(content, null, 2));
}

function readCache(outputDir, skill, phase) {
  const filePath = cacheFilePath(outputDir, skill, phase);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const content = JSON.parse(raw);

  const expiresAt = new Date(content.expires_at).getTime();
  if (Date.now() > expiresAt) return null;

  return content;
}

module.exports = { writeCache, readCache, cacheDir, cacheFilePath, CACHE_TTL_MS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/cache.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/cache.js tests/cache.test.js
git commit -m "feat(cache): add writeCache and readCache (#35)"
```

---

### Task 2: Cache Lib — listCaches and cleanCaches

**Files:**
- Modify: `scripts/lib/cache.js`
- Test: `tests/cache.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/cache.test.js`:

```javascript
describe('listCaches', () => {
  it('returns all cache entries with metadata', () => {
    const { writeCache, listCaches } = require('../scripts/lib/cache');
    writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: [] });
    writeCache(OUTPUT_DIR, 'daily-digest', 'phase2', { verified: [] });
    writeCache(OUTPUT_DIR, 'scan-email', 'body-fetch', { emails: [] });

    const entries = listCaches(OUTPUT_DIR);
    assert.equal(entries.length, 3);
    assert.ok(entries.some(e => e.skill === 'daily-digest' && e.phase === 'phase1'));
    assert.ok(entries.some(e => e.skill === 'daily-digest' && e.phase === 'phase2'));
    assert.ok(entries.some(e => e.skill === 'scan-email' && e.phase === 'body-fetch'));
  });

  it('filters by skill name', () => {
    const { writeCache, listCaches } = require('../scripts/lib/cache');
    writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: [] });
    writeCache(OUTPUT_DIR, 'scan-email', 'body-fetch', { emails: [] });

    const entries = listCaches(OUTPUT_DIR, 'daily-digest');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].skill, 'daily-digest');
  });

  it('returns empty array when no cache files exist', () => {
    const { listCaches } = require('../scripts/lib/cache');
    const entries = listCaches(OUTPUT_DIR);
    assert.deepEqual(entries, []);
  });

  it('returns empty array when .cache directory does not exist', () => {
    const { listCaches } = require('../scripts/lib/cache');
    fs.rmSync(CACHE_DIR, { recursive: true });
    const entries = listCaches(OUTPUT_DIR);
    assert.deepEqual(entries, []);
  });
});

describe('cleanCaches', () => {
  it('removes all cache files and returns count', () => {
    const { writeCache, cleanCaches } = require('../scripts/lib/cache');
    writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: [] });
    writeCache(OUTPUT_DIR, 'daily-digest', 'phase2', { verified: [] });

    const count = cleanCaches(OUTPUT_DIR);
    assert.equal(count, 2);
    assert.deepEqual(fs.readdirSync(CACHE_DIR), []);
  });

  it('removes only specified skill caches', () => {
    const { writeCache, cleanCaches, listCaches } = require('../scripts/lib/cache');
    writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: [] });
    writeCache(OUTPUT_DIR, 'scan-email', 'body-fetch', { emails: [] });

    const count = cleanCaches(OUTPUT_DIR, 'daily-digest');
    assert.equal(count, 1);

    const remaining = listCaches(OUTPUT_DIR);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].skill, 'scan-email');
  });

  it('returns 0 when no cache files exist', () => {
    const { cleanCaches } = require('../scripts/lib/cache');
    const count = cleanCaches(OUTPUT_DIR);
    assert.equal(count, 0);
  });

  it('returns 0 when .cache directory does not exist', () => {
    const { cleanCaches } = require('../scripts/lib/cache');
    fs.rmSync(CACHE_DIR, { recursive: true });
    const count = cleanCaches(OUTPUT_DIR);
    assert.equal(count, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/cache.test.js 2>&1 | tail -20`
Expected: FAIL — `listCaches` and `cleanCaches` not defined

- [ ] **Step 3: Implement listCaches and cleanCaches**

Add to `scripts/lib/cache.js` before `module.exports`:

```javascript
function listCaches(outputDir, skill) {
  const dir = cacheDir(outputDir);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const entries = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const content = JSON.parse(raw);
    if (skill && content.skill !== skill) continue;
    entries.push(content);
  }

  return entries;
}

function cleanCaches(outputDir, skill) {
  const dir = cacheDir(outputDir);
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let count = 0;

  for (const file of files) {
    if (skill) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const content = JSON.parse(raw);
      if (content.skill !== skill) continue;
    }
    fs.unlinkSync(path.join(dir, file));
    count++;
  }

  return count;
}
```

Update `module.exports`:

```javascript
module.exports = { writeCache, readCache, listCaches, cleanCaches, cacheDir, cacheFilePath, CACHE_TTL_MS };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/cache.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/cache.js tests/cache.test.js
git commit -m "feat(cache): add listCaches and cleanCaches (#35)"
```

---

### Task 3: Cache Lib — writeCache input validation

**Files:**
- Modify: `scripts/lib/cache.js`
- Test: `tests/cache.test.js`

- [ ] **Step 1: Write the failing test**

Add to the `writeCache` describe block in `tests/cache.test.js`:

```javascript
it('throws on null data', () => {
  const { writeCache } = require('../scripts/lib/cache');
  assert.throws(
    () => writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', null),
    /data is required/
  );
});

it('throws on empty skill name', () => {
  const { writeCache } = require('../scripts/lib/cache');
  assert.throws(
    () => writeCache(OUTPUT_DIR, '', 'phase1', { x: 1 }),
    /skill is required/
  );
});

it('throws on empty phase name', () => {
  const { writeCache } = require('../scripts/lib/cache');
  assert.throws(
    () => writeCache(OUTPUT_DIR, 'daily-digest', '', { x: 1 }),
    /phase is required/
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/cache.test.js 2>&1 | tail -20`
Expected: FAIL — no validation in writeCache yet

- [ ] **Step 3: Add validation to writeCache**

Add at the top of `writeCache` in `scripts/lib/cache.js`:

```javascript
function writeCache(outputDir, skill, phase, data) {
  if (!skill || typeof skill !== 'string') throw new Error('skill is required');
  if (!phase || typeof phase !== 'string') throw new Error('phase is required');
  if (data === null || data === undefined) throw new Error('data is required');

  const dir = cacheDir(outputDir);
  // ... rest unchanged
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/cache.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/lib/cache.js tests/cache.test.js
git commit -m "feat(cache): add writeCache input validation (#35)"
```

---

### Task 4: Cache CLI Entrypoint

**Files:**
- Create: `scripts/cache.js`
- Test: `tests/cache-cli.test.js`

- [ ] **Step 1: Write the CLI integration tests**

Create `tests/cache-cli.test.js`:

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CACHE_JS = path.join(__dirname, '..', 'scripts', 'cache.js');
const TMP_DIR = path.join(__dirname, 'tmp-cache-cli');
const CACHE_DIR = path.join(TMP_DIR, '.cache');

function run(args, { expectError = false } = {}) {
  try {
    const result = execSync(`bun ${CACHE_JS} ${args}`, {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, OUTPUT_DIR: TMP_DIR },
    });
    return { stdout: result.trim(), exitCode: 0 };
  } catch (err) {
    if (expectError) {
      return { stderr: (err.stderr || '').trim(), exitCode: err.status };
    }
    throw err;
  }
}

describe('cache.js CLI', () => {
  beforeEach(() => {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
  });

  it('write + read round-trip', () => {
    run('write daily-digest phase1 \'{"roles":["a","b"]}\'');
    const { stdout } = run('read daily-digest phase1');
    const data = JSON.parse(stdout);
    assert.deepEqual(data.data, { roles: ['a', 'b'] });
    assert.equal(data.skill, 'daily-digest');
  });

  it('read returns exit 1 for missing cache', () => {
    const { exitCode } = run('read daily-digest phase1', { expectError: true });
    assert.ok(exitCode !== 0);
  });

  it('list shows cache entries', () => {
    run('write daily-digest phase1 \'{"roles":[]}\'');
    const { stdout } = run('list');
    assert.ok(stdout.includes('daily-digest'));
    assert.ok(stdout.includes('phase1'));
  });

  it('list filters by skill', () => {
    run('write daily-digest phase1 \'{"roles":[]}\'');
    run('write scan-email body-fetch \'{"emails":[]}\'');
    const { stdout } = run('list daily-digest');
    assert.ok(stdout.includes('daily-digest'));
    assert.ok(!stdout.includes('scan-email'));
  });

  it('clean removes cache files', () => {
    run('write daily-digest phase1 \'{"roles":[]}\'');
    run('write daily-digest phase2 \'{"verified":[]}\'');
    const { stdout } = run('clean daily-digest');
    assert.ok(stdout.includes('2'));

    const { exitCode } = run('read daily-digest phase1', { expectError: true });
    assert.ok(exitCode !== 0);
  });

  it('write rejects invalid JSON', () => {
    const { exitCode } = run('write daily-digest phase1 not-json', { expectError: true });
    assert.ok(exitCode !== 0);
  });

  it('exits non-zero for unknown command', () => {
    const { exitCode } = run('bogus daily-digest phase1', { expectError: true });
    assert.ok(exitCode !== 0);
  });

  it('exits non-zero for missing arguments', () => {
    const { exitCode } = run('read', { expectError: true });
    assert.ok(exitCode !== 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/cache-cli.test.js 2>&1 | tail -20`
Expected: FAIL — script not found

- [ ] **Step 3: Implement the CLI entrypoint**

Create `scripts/cache.js`:

```javascript
#!/usr/bin/env node
// scripts/cache.js
// Phase cache utility for resumable skill execution.
//
// Usage:
//   bun scripts/cache.js read <skill> <phase>
//   bun scripts/cache.js write <skill> <phase> '<json>'
//   bun scripts/cache.js list [skill]
//   bun scripts/cache.js clean [skill]
//
// Exit codes: 0 = success, 1 = error or cache miss
// Output: JSON on stdout (read, write) or text (list, clean)

const path = require('path');
const { readCache, writeCache, listCaches, cleanCaches } = require('./lib/cache');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'output');

function usage() {
  console.error(`Usage: bun scripts/cache.js <command> [args]

Commands:
  read <skill> <phase>           Read cached phase result (exit 1 if miss/expired)
  write <skill> <phase> '<json>' Write phase result to cache
  list [skill]                   List active cache entries
  clean [skill]                  Remove cache files`);
  process.exit(1);
}

function formatAge(cachedAt) {
  const ms = Date.now() - new Date(cachedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const command = args[0];

  try {
    switch (command) {
      case 'read': {
        if (args.length < 3) {
          console.error('read requires <skill> <phase>');
          process.exit(1);
        }
        const result = readCache(OUTPUT_DIR, args[1], args[2]);
        if (!result) process.exit(1);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'write': {
        if (args.length < 4) {
          console.error('write requires <skill> <phase> <json>');
          process.exit(1);
        }
        let data;
        try {
          data = JSON.parse(args[3]);
        } catch (err) {
          console.error(`Invalid JSON: ${err.message}`);
          process.exit(1);
        }
        writeCache(OUTPUT_DIR, args[1], args[2], data);
        console.log(JSON.stringify({ success: true }));
        break;
      }
      case 'list': {
        const entries = listCaches(OUTPUT_DIR, args[1] || undefined);
        if (entries.length === 0) {
          console.log('No cache entries found');
        } else {
          for (const entry of entries) {
            console.log(`${entry.skill}/${entry.phase}  ${entry.cached_at.slice(0, 16).replace('T', ' ')}  (${formatAge(entry.cached_at)})`);
          }
        }
        break;
      }
      case 'clean': {
        const count = cleanCaches(OUTPUT_DIR, args[1] || undefined);
        console.log(`Removed ${count} cache file${count !== 1 ? 's' : ''}`);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        usage();
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/cache-cli.test.js 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```
git add scripts/cache.js tests/cache-cli.test.js
git commit -m "feat(cache): add cache.js CLI entrypoint (#35)"
```

---

### Task 5: Shared Convention Doc

**Files:**
- Create: `skills/_shared/phase-cache.md`

- [ ] **Step 1: Write the shared convention doc**

Create `skills/_shared/phase-cache.md`:

```markdown
# Phase Cache — Resumable Skill Execution

Multi-phase skills can cache intermediate results so that a failure mid-run
does not require restarting from scratch. The `scripts/cache.js` CLI handles
read/write/expiry/cleanup.

## When to Use

Use phase caching when a phase:
- Makes expensive external API calls (TheirStack, WebSearch)
- Performs slow batch operations (email body fetches)
- Produces results that are reusable if a later phase fails

## How to Cache a Phase

### After a phase completes successfully

```bash
bun scripts/cache.js write <skill-name> <phase-name> '<json-result>'
```

The JSON should contain the phase's output — whatever the next phase needs
as input. Cache files expire after 2 hours.

### At skill start — check for cached phases

```bash
bun scripts/cache.js read <skill-name> <phase-name>
```

- **Exit 0 + JSON output**: Cache hit. Present to user:
  "Phase N cached at {cached_at} — {summary}. Resume from Phase N+1?"
  - User confirms: skip the cached phase, use the returned data
  - User says "fresh" or "start over": ignore cache, run from scratch
- **Exit 1**: Cache miss or expired. Run the phase normally.

### Check phases in order

If a skill has multiple cacheable phases, check them in reverse order
(latest first). If Phase 2 is cached, skip both Phase 1 and Phase 2.
If only Phase 1 is cached, skip Phase 1 and run Phase 2.

### After skill completes successfully

Optionally clean up caches for the skill:

```bash
bun scripts/cache.js clean <skill-name>
```

This is not required — caches expire automatically after 2 hours.

## Example: daily-digest

```
# At skill start:
result2=$(bun scripts/cache.js read daily-digest phase2 2>/dev/null)
if [ $? -eq 0 ]; then
  # Phase 2 cached — resume from Phase 3 (compose)
fi

result1=$(bun scripts/cache.js read daily-digest phase1 2>/dev/null)
if [ $? -eq 0 ]; then
  # Phase 1 cached — resume from Phase 2 (verification)
fi

# After Phase 1:
bun scripts/cache.js write daily-digest phase1 '<discovery-results>'

# After Phase 2:
bun scripts/cache.js write daily-digest phase2 '<verification-results>'
```

## Cache File Location

Files are stored in `output/.cache/<skill>-<phase>.json`. The `output/`
directory is gitignored, so cache files are never committed.

## CLI Reference

| Command | Description |
|---------|-------------|
| `read <skill> <phase>` | Print cached data (exit 0) or signal miss (exit 1) |
| `write <skill> <phase> '<json>'` | Cache phase result (2h TTL) |
| `list [skill]` | Show active cache entries with age |
| `clean [skill]` | Remove cache files |
```

- [ ] **Step 2: Commit**

```
git add skills/_shared/phase-cache.md
git commit -m "docs: add phase-cache convention for resumable skills (#35)"
```

---

### Task 6: daily-digest SKILL.md — Add Cache Instructions

**Files:**
- Modify: `skills/daily-digest/SKILL.md`

- [ ] **Step 1: Read the current SKILL.md to find insertion points**

Read `skills/daily-digest/SKILL.md` and identify:
- Where Phase 1 (discovery) ends
- Where Phase 2 (verification) ends
- Where the skill orchestration starts (preflight)

- [ ] **Step 2: Add cache-read at skill start**

After the preflight/state-reading section (Phase 0/0a), before Phase 1 begins, add:

```markdown
### Phase Cache Check

Before starting discovery, check for cached results from a prior interrupted run:

1. Run `bun scripts/cache.js read daily-digest phase2`
   - If exit 0: Phase 2 results are cached. Display: "Verification cached at {cached_at} — {N} roles verified. Resume from compose?" If user confirms, skip to Phase 3 using the cached data. If user says "fresh", proceed normally.

2. If Phase 2 was not cached, run `bun scripts/cache.js read daily-digest phase1`
   - If exit 0: Phase 1 results are cached. Display: "Discovery cached at {cached_at} — {N} roles found. Resume from verification?" If user confirms, skip to Phase 2 using the cached data. If user says "fresh", proceed normally.

3. If neither cached, proceed with Phase 1 normally.

See `skills/_shared/phase-cache.md` for the full caching convention.
```

- [ ] **Step 3: Add cache-write after Phase 1**

After the Phase 1 discovery section completes (after all sources have been queried and candidates collected), add:

```markdown
#### Cache Phase 1 Results

After discovery completes, cache the results for resumption:

```bash
bun scripts/cache.js write daily-digest phase1 '<json>'
```

The JSON should contain the full candidate list and source metadata.
```

- [ ] **Step 4: Add cache-write after Phase 2**

After the Phase 2 verification section completes (URLs verified, closed postings marked), add:

```markdown
#### Cache Phase 2 Results

After verification completes, cache the results:

```bash
bun scripts/cache.js write daily-digest phase2 '<json>'
```

The JSON should contain verified roles, closed postings, and source stats.
```

- [ ] **Step 5: Commit**

```
git add skills/daily-digest/SKILL.md
git commit -m "feat(daily-digest): add phase cache instructions (#35)"
```

---

### Task 7: scan-email SKILL.md — Add Cache Instructions

**Files:**
- Modify: `skills/scan-email/SKILL.md`

- [ ] **Step 1: Read the current SKILL.md to find insertion points**

Read `skills/scan-email/SKILL.md` and identify:
- Where Phase 3 (body fetch) ends
- Where the skill orchestration starts

- [ ] **Step 2: Add cache-read at skill start**

After preflight/state-reading, before Phase 1 begins, add:

```markdown
### Phase Cache Check

Before starting email scan, check for cached results:

1. Run `bun scripts/cache.js read scan-email body-fetch`
   - If exit 0: Body fetch results are cached. Display: "Body fetch cached at {cached_at} — {N} roles extracted. Resume from dedup/verification?" If user confirms, skip to Phase 4 using the cached data. If user says "fresh", proceed normally.

2. If not cached, proceed with Phase 1 normally.

See `skills/_shared/phase-cache.md` for the full caching convention.
```

- [ ] **Step 3: Add cache-write after body fetch**

After Phases 2-3 complete (metadata scan + body fetch done, roles extracted), add:

```markdown
#### Cache Body Fetch Results

After body fetch completes, cache extracted roles for resumption:

```bash
bun scripts/cache.js write scan-email body-fetch '<json>'
```

The JSON should contain all extracted roles with URLs, company names, and source labels.
```

- [ ] **Step 4: Commit**

```
git add skills/scan-email/SKILL.md
git commit -m "feat(scan-email): add phase cache instructions (#35)"
```

---

### Task 8: resume-tailor SKILL.md — Add Cache Instructions

**Files:**
- Modify: `skills/resume-tailor/SKILL.md`

- [ ] **Step 1: Read the current SKILL.md to find insertion points**

Read `skills/resume-tailor/SKILL.md` and identify:
- Where Phase 2 (analyze & score) ends
- Where the skill orchestration starts

- [ ] **Step 2: Add cache-read at skill start**

After preflight, before Phase 1 begins, add:

```markdown
### Phase Cache Check

Before starting analysis, check for cached results:

1. Run `bun scripts/cache.js read resume-tailor analysis`
   - If exit 0: Posting analysis is cached. Display: "Posting analysis cached at {cached_at} for {company}. Resume from resume composition?" If user confirms, skip to Phase 3 using the cached data. If user says "fresh", proceed normally.

2. If not cached, proceed with Phase 1 normally.

See `skills/_shared/phase-cache.md` for the full caching convention.
```

- [ ] **Step 3: Add cache-write after analysis**

After Phase 2 completes (posting analyzed, requirements scored), add:

```markdown
#### Cache Analysis Results

After analysis completes, cache for resumption:

```bash
bun scripts/cache.js write resume-tailor analysis '<json>'
```

The JSON should contain requirement mapping, accomplishment scoring, and gap analysis.
```

- [ ] **Step 4: Commit**

```
git add skills/resume-tailor/SKILL.md
git commit -m "feat(resume-tailor): add phase cache instructions (#35)"
```

---

### Task 9: Full Test Suite Verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bun test 2>&1 | tail -30`
Expected: All tests PASS with zero failures. The new cache tests should appear alongside existing tests.

- [ ] **Step 2: If any failures, debug and fix**

Check that existing tests are not affected by the new files. The cache module is fully independent — no shared state with existing parsers.

- [ ] **Step 3: Final commit if any fixes were needed**

```
git add -A
git commit -m "fix: resolve test regressions from phase checkpointing (#35)"
```
