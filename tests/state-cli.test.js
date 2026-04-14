const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_JS = path.join(__dirname, '..', 'scripts', 'state.js');
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'multi');
const TMP_DIR = path.join(__dirname, 'tmp-cli');

function run(args, { expectError = false, outputDir = FIXTURES_DIR } = {}) {
  try {
    const result = execSync(`bun ${STATE_JS} ${args}`, {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, OUTPUT_DIR: outputDir },
    });
    return { stdout: result, exitCode: 0 };
  } catch (err) {
    if (expectError) {
      return { stderr: err.stderr, exitCode: err.status };
    }
    throw err;
  }
}

describe('state.js CLI', () => {
  beforeEach(() => {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe('read', () => {
    it('returns valid JSON for seen-postings', () => {
      const { stdout } = run('read seen-postings');
      const data = JSON.parse(stdout);
      assert.ok(Array.isArray(data));
      assert.ok(data.length > 0);
      assert.ok(data[0].company);
    });

    it('returns valid JSON for preferences', () => {
      const { stdout } = run('read preferences');
      const data = JSON.parse(stdout);
      assert.ok(data.last_run_date);
      assert.ok(data.sections);
    });
  });

  describe('query', () => {
    it('filters by company', () => {
      const { stdout } = run('query seen-postings --company natera');
      const data = JSON.parse(stdout);
      assert.ok(data.length > 0);
      data.forEach(e => {
        assert.ok(e.company.toLowerCase().includes('natera'));
      });
    });

    it('filters by flagged', () => {
      const { stdout } = run('query seen-postings --flagged APPLIED');
      const data = JSON.parse(stdout);
      assert.ok(data.length > 0);
      data.forEach(e => {
        assert.ok(e.flags.some(f => f.startsWith('APPLIED')));
      });
    });

    it('returns empty array for no matches', () => {
      const { stdout } = run('query seen-postings --company zzz-nonexistent-zzz');
      const data = JSON.parse(stdout);
      assert.deepEqual(data, []);
    });
  });

  describe('dedup-check', () => {
    it('detects duplicate by URL', () => {
      const { stdout } = run('dedup-check seen-postings --url "https://job-boards.greenhouse.io/natera/jobs/5814300004"');
      const data = JSON.parse(stdout);
      assert.equal(data.duplicate, true);
      assert.equal(data.match, 'exact-url');
    });

    it('detects duplicate by company+title', () => {
      const { stdout } = run('dedup-check seen-postings --company "Natera" --title "VP of Engineering, UX/Commercial Applications"');
      const data = JSON.parse(stdout);
      assert.equal(data.duplicate, true);
      assert.equal(data.match, 'company-title');
    });

    it('returns not-duplicate for unknown', () => {
      const { stdout } = run('dedup-check seen-postings --url "https://example.com/new-job-123"');
      const data = JSON.parse(stdout);
      assert.equal(data.duplicate, false);
    });
  });

  describe('flag', () => {
    it('exits non-zero for URL not found', () => {
      const { exitCode } = run('flag seen-postings --url "https://example.com/nonexistent-job-99999" --add RESEARCHED', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for missing --url', () => {
      const { exitCode } = run('flag seen-postings --add RESEARCHED', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for missing --add', () => {
      const { exitCode } = run('flag seen-postings --url "https://example.com"', { expectError: true });
      assert.ok(exitCode !== 0);
    });
  });

  describe('applications', () => {
    const APP_ENTRY = JSON.stringify({
      company: 'TestCorp',
      title: 'VP Engineering',
      stage: 'Applied',
      url: 'https://example.com/job/123',
    });

    let appTmpDir;

    beforeEach(() => {
      appTmpDir = fs.mkdtempSync(path.join(TMP_DIR, 'apps-'));
    });

    afterEach(() => {
      fs.rmSync(appTmpDir, { recursive: true, force: true });
    });

    it('read returns valid JSON (empty when no file)', () => {
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      assert.ok(Array.isArray(data));
    });

    it('create + read round-trips', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      const entry = data.find(e => e.company === 'TestCorp');
      assert.ok(entry);
      assert.equal(entry.stage, 'Applied');
    });

    it('update transitions stage', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      run('update applications --company TestCorp --stage Screen --detail "Recruiter call"', { outputDir: appTmpDir });
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      const entry = data.find(e => e.company === 'TestCorp');
      assert.equal(entry.stage, 'Screen');
    });

    it('add-note appends note', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      run('add-note applications --company TestCorp --note "Cover letter generated"', { outputDir: appTmpDir });
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      const entry = data.find(e => e.company === 'TestCorp');
      assert.ok(entry.notes.includes('Cover letter generated'));
    });

    it('add-note round-trips evaluation note format (em dash, slash, special chars)', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      const note = 'Evaluation complete — score: 3.8/5, archetype: DX/Platform, recommendation: apply';
      run(`add-note applications --company TestCorp --note "${note}"`, { outputDir: appTmpDir });
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      const entry = data.find(e => e.company === 'TestCorp');
      assert.ok(entry.notes.includes('score: 3.8/5'), 'score with slash should survive round-trip');
      assert.ok(entry.notes.includes('recommendation: apply'), 'recommendation should survive round-trip');
      assert.ok(entry.notes.includes('DX/Platform'), 'archetype with slash should survive round-trip');
    });

    it('exits non-zero for update with unknown stage', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      const { exitCode } = run('update applications --company TestCorp --stage Vibing', { expectError: true, outputDir: appTmpDir });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for update with missing --company', () => {
      const { exitCode } = run('update applications --stage Screen', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for add-note with no matching company', () => {
      const { exitCode } = run('add-note applications --company Nonexistent --note "test"', { expectError: true, outputDir: appTmpDir });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for update on wrong type', () => {
      const { exitCode } = run('update seen-postings --company Test --stage Screen', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for add-note on wrong type', () => {
      const { exitCode } = run('add-note preferences --company Test --note "test"', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for append applications (unsupported)', () => {
      const { exitCode } = run(`append applications '${APP_ENTRY}'`, { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('close moves entry to closed', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      run('close applications --company TestCorp --reason rejected --summary "No response"', { outputDir: appTmpDir });
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      const closed = data.filter(e => e.stage && e.stage.startsWith('Closed'));
      assert.equal(closed.length, 1);
      assert.equal(closed[0].company, 'TestCorp');
    });

    it('reopen moves closed entry back to active', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      run('close applications --company TestCorp --reason rejected --summary "No response"', { outputDir: appTmpDir });
      run('reopen applications --company TestCorp --stage Screen --detail "Recruiter called back"', { outputDir: appTmpDir });
      const { stdout } = run('read applications', { outputDir: appTmpDir });
      const data = JSON.parse(stdout);
      const entry = data.find(e => e.company === 'TestCorp');
      assert.equal(entry.stage, 'Screen');
      assert.equal(entry.closed, null);
    });

    it('update rejects Closed stage via CLI', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      const { exitCode } = run('update applications --company TestCorp --stage Closed', { expectError: true, outputDir: appTmpDir });
      assert.ok(exitCode !== 0);
    });

    it('close exits non-zero for missing --reason', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      const { exitCode } = run('close applications --company TestCorp', { expectError: true, outputDir: appTmpDir });
      assert.ok(exitCode !== 0);
    });

    it('reopen exits non-zero for missing --stage', () => {
      const { exitCode } = run('reopen applications --company TestCorp', { expectError: true, outputDir: appTmpDir });
      assert.ok(exitCode !== 0);
    });

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

    it('read --stage filters entries', () => {
      run(`create applications '${APP_ENTRY}'`, { outputDir: appTmpDir });
      const second = JSON.stringify({
        company: 'TestCorp2',
        title: 'Director',
        stage: 'Screen',
      });
      run(`create applications '${second}'`, { outputDir: appTmpDir });

      const { stdout: appliedOnly } = run('read applications --stage Applied', { outputDir: appTmpDir });
      const applied = JSON.parse(appliedOnly);
      assert.equal(applied.length, 1);
      assert.equal(applied[0].company, 'TestCorp');

      const { stdout: screenOnly } = run('read applications --stage Screen', { outputDir: appTmpDir });
      const screen = JSON.parse(screenOnly);
      assert.equal(screen.length, 1);
      assert.equal(screen[0].company, 'TestCorp2');
    });
  });

  describe('error handling', () => {
    it('exits non-zero for unknown type', () => {
      const { exitCode } = run('read unknown-type', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for unknown command', () => {
      const { exitCode } = run('bogus seen-postings', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for append with invalid JSON', () => {
      const { exitCode } = run("append seen-postings 'not-json'", { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for append with missing fields', () => {
      const { exitCode } = run('append seen-postings \'{"company":""}\'', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for dedup-check with wrong type', () => {
      const { exitCode } = run('dedup-check preferences --url "https://example.com"', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for flag with wrong type', () => {
      const { exitCode } = run('flag preferences --url "https://example.com" --add X', { expectError: true });
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for query with wrong type', () => {
      const { exitCode } = run('query preferences --company test', { expectError: true });
      assert.ok(exitCode !== 0);
    });
  });
});
