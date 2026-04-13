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
