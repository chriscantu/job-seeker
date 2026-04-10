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
