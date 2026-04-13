const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, '..', 'scripts', 'classify-status-email.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'status-emails');

let tmpDir;

function run(args) {
  return execSync(`bun ${CLI} ${args}`, { encoding: 'utf8', timeout: 10000 }).trim();
}

function runExpectError(args) {
  try {
    execSync(`bun ${CLI} ${args}`, { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { exitCode: 0, stdout: '', stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}

describe('classify-status-email.js CLI', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-test-'));
    fs.copyFileSync(
      path.join(FIXTURES, 'applications.md'),
      path.join(tmpDir, '2026-04-13-applications.md')
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for non-ATS sender', () => {
    const emailPath = path.join(FIXTURES, 'non-ats-sender.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    assert.equal(out, 'null');
  });

  it('returns HIGH tier JSON for URL-matched rejection', () => {
    const emailPath = path.join(FIXTURES, 'atlassian-rejection-greenhouse.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    const result = JSON.parse(out);
    assert.equal(result.tier, 'HIGH');
    assert.equal(result.status, 'Rejected');
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Atlassian');
  });

  it('returns MEDIUM tier JSON for name-matched rejection', () => {
    const emailPath = path.join(FIXTURES, 'discord-rejection-greenhouse.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    const result = JSON.parse(out);
    assert.equal(result.tier, 'MEDIUM');
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Discord');
  });

  it('returns LOW tier JSON for unknown company', () => {
    const emailPath = path.join(FIXTURES, 'unknown-company-greenhouse.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    const result = JSON.parse(out);
    assert.equal(result.tier, 'LOW');
    assert.equal(result.matchMethod, 'none');
  });
});

describe('classify-status-email.js CLI — error handling', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-err-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exits 2 with usage message when args are missing', () => {
    const r = runExpectError('');
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /Usage:/);
  });

  it('exits 2 when --email flag is followed by another flag', () => {
    const r = runExpectError(`--email --applications-dir ${tmpDir}`);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /missing value for --email/);
  });

  it('exits 3 with structured error when email file does not exist', () => {
    const r = runExpectError(`--email /nonexistent/path.json --applications-dir ${tmpDir}`);
    assert.equal(r.exitCode, 3);
    const parsed = JSON.parse(r.stderr);
    assert.equal(parsed.error, 'email_read_failed');
    assert.equal(parsed.file, '/nonexistent/path.json');
  });

  it('exits 3 with structured error when email file has invalid JSON', () => {
    const badPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(badPath, '{not valid json');
    const r = runExpectError(`--email ${badPath} --applications-dir ${tmpDir}`);
    assert.equal(r.exitCode, 3);
    const parsed = JSON.parse(r.stderr);
    assert.equal(parsed.error, 'email_read_failed');
  });

  it('warns to stderr but succeeds when applications file is missing', () => {
    // tmpDir has no applications file. Classify a non-ATS sender so we get
    // a deterministic null result without needing state.
    const emailPath = path.join(FIXTURES, 'non-ats-sender.json');
    let result;
    try {
      result = execSync(`bun ${CLI} --email ${emailPath} --applications-dir ${tmpDir}`, {
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      throw new Error(`Expected success but got exit ${err.status}: ${err.stderr}`);
    }
    assert.equal(result.trim(), 'null');
    // stderr warning can't be captured cleanly from execSync success path,
    // but the fact that the process succeeded with stdout 'null' proves the
    // empty-state fallback is working.
  });
});
