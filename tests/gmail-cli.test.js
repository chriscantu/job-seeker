const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'scripts', 'gmail.js');

describe('gmail CLI', () => {
  describe('usage', () => {
    it('prints usage and exits 1 with no arguments', () => {
      try {
        execSync(`bun ${CLI}`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('Usage:'), `expected usage in stderr, got: ${err.stderr}`);
        assert.equal(err.status, 1);
      }
    });

    it('prints usage for unknown command', () => {
      try {
        execSync(`bun ${CLI} unknown`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('Usage:'));
        assert.equal(err.status, 1);
      }
    });
  });

  describe('trash command', () => {
    it('exits 1 with error when no message IDs provided', () => {
      try {
        execSync(`bun ${CLI} trash`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('at least one message ID'));
        assert.equal(err.status, 1);
      }
    });
  });

  describe('search command', () => {
    it('exits 1 with error when no query provided', () => {
      try {
        execSync(`bun ${CLI} search`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('query is required'));
        assert.equal(err.status, 1);
      }
    });
  });

  describe('create-draft command', () => {
    it('exits 1 with error when --to is missing', () => {
      try {
        execSync(
          `bun ${CLI} create-draft --subject "Test" --body-file /tmp/x.txt`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('--to is required'));
        assert.equal(err.status, 1);
      }
    });

    it('exits 1 with error when --subject is missing', () => {
      try {
        execSync(
          `bun ${CLI} create-draft --to a@b.com --body-file /tmp/x.txt`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('--subject is required'));
        assert.equal(err.status, 1);
      }
    });

    it('exits 1 with error when --body-file is missing', () => {
      try {
        execSync(
          `bun ${CLI} create-draft --to a@b.com --subject "Test"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('--body-file is required'));
        assert.equal(err.status, 1);
      }
    });

    it('exits 1 when trash-by-sender is called with no --sender flag', () => {
      try {
        execSync(`bun ${CLI} trash-by-sender`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(
          err.stderr.includes('at least one --sender'),
          `expected helpful error, got: ${err.stderr}`
        );
        assert.equal(err.status, 1);
      }
    });

    it('exits 1 when --sender is missing its value', () => {
      try {
        execSync(`bun ${CLI} trash-by-sender --sender --dry-run`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('--sender requires a value'));
        assert.equal(err.status, 1);
      }
    });

    it('exits 1 on unknown flag to trash-by-sender', () => {
      try {
        execSync(
          `bun ${CLI} trash-by-sender --sender lensa.com --bogus-flag`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('unknown flag'));
        assert.equal(err.status, 1);
      }
    });

    it('exits 1 with error when --body-file does not exist', () => {
      try {
        execSync(
          `bun ${CLI} create-draft --to a@b.com --subject "Test" --body-file /tmp/does-not-exist-12345.txt`,
          { encoding: 'utf8', stdio: 'pipe' }
        );
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('body file not found'));
        assert.equal(err.status, 1);
      }
    });
  });
});
