const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { querySeenPostings, dedupCheck } = require('../scripts/lib/seen-postings');

const FIXTURES = path.join(__dirname, 'fixtures');

describe('seen-postings query', () => {
  it('filters by company (case-insensitive substring)', () => {
    const results = querySeenPostings(FIXTURES, { company: 'natera' });
    assert.ok(results.length > 0);
    assert.ok(results.every(e => e.company.toLowerCase().includes('natera')));
  });

  it('filters by not-flagged', () => {
    const results = querySeenPostings(FIXTURES, { notFlagged: 'RESEARCHED' });
    assert.ok(results.length > 0);
    assert.ok(results.every(e => !e.flags.includes('RESEARCHED')));
  });

  it('filters by flagged', () => {
    const results = querySeenPostings(FIXTURES, { flagged: 'RESEARCHED' });
    assert.ok(results.length > 0);
    assert.ok(results.every(e => e.flags.includes('RESEARCHED')));
  });

  it('returns empty array when no matches', () => {
    const results = querySeenPostings(FIXTURES, { company: 'zzz-nonexistent-zzz' });
    assert.deepEqual(results, []);
  });

  it('combines filters (AND logic)', () => {
    const results = querySeenPostings(FIXTURES, {
      flagged: 'APPLIED',
    });
    assert.ok(results.length > 0);
    results.forEach(e => {
      assert.ok(e.flags.some(f => f.startsWith('APPLIED')));
    });
  });
});

describe('seen-postings dedup-check', () => {
  it('detects exact URL match', () => {
    const result = dedupCheck(FIXTURES, {
      url: 'https://jobs.ashbyhq.com/percona/cf23fe7e-cd27-476c-a545-1d2f9f9443f9',
    });
    assert.equal(result.duplicate, true);
    assert.equal(result.match, 'exact-url');
  });

  it('detects URL match with trailing slash difference', () => {
    const result = dedupCheck(FIXTURES, {
      url: 'https://jobs.ashbyhq.com/percona/cf23fe7e-cd27-476c-a545-1d2f9f9443f9/',
    });
    assert.equal(result.duplicate, true);
    assert.equal(result.match, 'exact-url');
  });

  it('detects company+title fuzzy match', () => {
    const result = dedupCheck(FIXTURES, {
      company: 'Natera',
      title: 'VP of Engineering, UX/Commercial Applications',
    });
    assert.equal(result.duplicate, true);
    assert.equal(result.match, 'company-title');
  });

  it('detects company+title fuzzy match (case-insensitive)', () => {
    const result = dedupCheck(FIXTURES, {
      company: 'natera',
      title: 'vp of engineering, ux/commercial applications',
    });
    assert.equal(result.duplicate, true);
    assert.equal(result.match, 'company-title');
  });

  it('returns not-duplicate when no match', () => {
    const result = dedupCheck(FIXTURES, {
      url: 'https://example.com/totally-new',
      company: 'Brand New Company',
      title: 'Chief Architect',
    });
    assert.equal(result.duplicate, false);
  });

  it('prefers URL match over company-title match', () => {
    const result = dedupCheck(FIXTURES, {
      url: 'https://jobs.ashbyhq.com/percona/cf23fe7e-cd27-476c-a545-1d2f9f9443f9',
      company: 'Percona',
      title: 'VP of Engineering',
    });
    assert.equal(result.match, 'exact-url');
  });
});
