const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'tmp-cache');
const CACHE_DIR = path.join(OUTPUT_DIR, '.cache');

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

  describe('corrupt file handling', () => {
    it('readCache returns null for corrupt JSON', () => {
      const { readCache } = require('../scripts/lib/cache');
      const filePath = path.join(CACHE_DIR, 'daily-digest-phase1.json');
      fs.writeFileSync(filePath, 'not-json{{{');
      const result = readCache(OUTPUT_DIR, 'daily-digest', 'phase1');
      assert.equal(result, null);
    });

    it('readCache returns null when expires_at is missing', () => {
      const { readCache } = require('../scripts/lib/cache');
      const filePath = path.join(CACHE_DIR, 'daily-digest-phase1.json');
      fs.writeFileSync(filePath, JSON.stringify({
        skill: 'daily-digest',
        phase: 'phase1',
        cached_at: new Date().toISOString(),
        data: { roles: [] },
      }));
      const result = readCache(OUTPUT_DIR, 'daily-digest', 'phase1');
      assert.equal(result, null);
    });

    it('listCaches skips corrupt files and returns valid entries', () => {
      const { writeCache, listCaches } = require('../scripts/lib/cache');
      writeCache(OUTPUT_DIR, 'scan-email', 'body-fetch', { emails: [] });
      fs.writeFileSync(path.join(CACHE_DIR, 'corrupt-file.json'), '{bad');

      const entries = listCaches(OUTPUT_DIR);
      assert.equal(entries.length, 1);
      assert.equal(entries[0].skill, 'scan-email');
    });

    it('cleanCaches skips corrupt files when filtering by skill', () => {
      const { writeCache, cleanCaches } = require('../scripts/lib/cache');
      writeCache(OUTPUT_DIR, 'daily-digest', 'phase1', { roles: [] });
      fs.writeFileSync(path.join(CACHE_DIR, 'corrupt-file.json'), '{bad');

      const count = cleanCaches(OUTPUT_DIR, 'daily-digest');
      assert.equal(count, 1);

      // Corrupt file should still be there (skipped, not deleted)
      assert.ok(fs.existsSync(path.join(CACHE_DIR, 'corrupt-file.json')));
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
});
