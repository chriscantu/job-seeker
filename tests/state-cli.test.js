const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_JS = path.join(__dirname, '..', 'scripts', 'state.js');
const TMP_DIR = path.join(__dirname, 'tmp-cli');

// Override OUTPUT_DIR by running with a modified env — but state.js hardcodes ROOT.
// Instead, we'll test against the real output/ directory for read operations
// and use the unit-tested library functions for write operations.
// CLI integration tests focus on arg parsing, JSON output, and exit codes.

function run(args, expectError = false) {
  try {
    const result = execSync(`bun ${STATE_JS} ${args}`, {
      encoding: 'utf8',
      timeout: 10000,
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
      const { exitCode } = run('flag seen-postings --url "https://example.com/nonexistent-job-99999" --add RESEARCHED', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for missing --url', () => {
      const { exitCode } = run('flag seen-postings --add RESEARCHED', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for missing --add', () => {
      const { exitCode } = run('flag seen-postings --url "https://example.com"', true);
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

    // Clean up any test file after each test
    afterEach(() => {
      const outputDir = path.join(__dirname, '..', 'output');
      const files = fs.readdirSync(outputDir).filter(f => f.includes('-applications.md'));
      for (const f of files) {
        const content = fs.readFileSync(path.join(outputDir, f), 'utf8');
        if (content.includes('TestCorp') || content.includes('TestCorp2')) {
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

    it('exits non-zero for append applications (unsupported)', () => {
      const { exitCode } = run(`append applications '${APP_ENTRY}'`, true);
      assert.ok(exitCode !== 0);
    });

    it('read --stage filters entries', () => {
      run(`create applications '${APP_ENTRY}'`);
      const second = JSON.stringify({
        company: 'TestCorp2',
        title: 'Director',
        stage: 'Screen',
      });
      run(`create applications '${second}'`);

      const { stdout: appliedOnly } = run('read applications --stage Applied');
      const applied = JSON.parse(appliedOnly);
      assert.equal(applied.length, 1);
      assert.equal(applied[0].company, 'TestCorp');

      const { stdout: screenOnly } = run('read applications --stage Screen');
      const screen = JSON.parse(screenOnly);
      assert.equal(screen.length, 1);
      assert.equal(screen[0].company, 'TestCorp2');
    });
  });

  describe('error handling', () => {
    it('exits non-zero for unknown type', () => {
      const { exitCode } = run('read unknown-type', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for unknown command', () => {
      const { exitCode } = run('bogus seen-postings', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for append with invalid JSON', () => {
      const { exitCode } = run("append seen-postings 'not-json'", true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for append with missing fields', () => {
      const { exitCode } = run('append seen-postings \'{"company":""}\'', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for dedup-check with wrong type', () => {
      const { exitCode } = run('dedup-check preferences --url "https://example.com"', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for flag with wrong type', () => {
      const { exitCode } = run('flag preferences --url "https://example.com" --add X', true);
      assert.ok(exitCode !== 0);
    });

    it('exits non-zero for query with wrong type', () => {
      const { exitCode } = run('query preferences --company test', true);
      assert.ok(exitCode !== 0);
    });
  });
});
