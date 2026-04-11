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
});
