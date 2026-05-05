import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { querySeenPostings, dedupCheck, normalizeUrl, parseSeenPostingsContent } from '../scripts/lib/seen-postings';

const FIXTURES = path.join(__dirname, 'fixtures', 'multi');

describe('seen-postings query', () => {
  it('filters by company (case-insensitive substring)', () => {
    const results = querySeenPostings(FIXTURES, { company: 'natera' });
    assert.ok(results.length > 0);
    assert.ok(results.every(e => e.company!.toLowerCase().includes('natera')));
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

  it('combines company + notFlagged filters', () => {
    const all = querySeenPostings(FIXTURES, { company: 'natera' });
    const filtered = querySeenPostings(FIXTURES, { company: 'natera', notFlagged: 'RESEARCHED' });
    assert.ok(all.length > 0);
    assert.ok(filtered.length < all.length, 'notFlagged should reduce results');
    filtered.forEach(e => {
      assert.ok(!e.flags.includes('RESEARCHED'));
      assert.ok(e.company!.toLowerCase().includes('natera'));
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

  it('returns not-duplicate for same company but different title', () => {
    const result = dedupCheck(FIXTURES, {
      company: 'Natera',
      title: 'Director of QA',
    });
    assert.equal(result.duplicate, false);
  });
});

describe('normalizeUrl', () => {
  it('strips www prefix', () => {
    assert.equal(
      normalizeUrl('https://www.example.com/jobs/123'),
      normalizeUrl('https://example.com/jobs/123')
    );
  });

  it('strips query parameters', () => {
    assert.equal(
      normalizeUrl('https://example.com/jobs/123?ref=linkedin'),
      normalizeUrl('https://example.com/jobs/123')
    );
  });

  it('strips trailing slash', () => {
    assert.equal(
      normalizeUrl('https://example.com/jobs/123/'),
      normalizeUrl('https://example.com/jobs/123')
    );
  });

  it('strips fragment', () => {
    assert.equal(
      normalizeUrl('https://example.com/jobs/123#apply'),
      normalizeUrl('https://example.com/jobs/123')
    );
  });

  it('is case-insensitive', () => {
    assert.equal(
      normalizeUrl('https://Jobs.Greenhouse.IO/company/123'),
      normalizeUrl('https://jobs.greenhouse.io/company/123')
    );
  });

  it('returns empty string for null/undefined', () => {
    assert.equal(normalizeUrl(null), '');
    assert.equal(normalizeUrl(undefined), '');
  });

  it('handles invalid URLs gracefully', () => {
    const result = normalizeUrl('not-a-url');
    assert.equal(typeof result, 'string');
  });
});

describe('empty file handling', () => {
  it('parseSeenPostingsContent returns empty array for empty string', () => {
    const entries = parseSeenPostingsContent('');
    assert.deepEqual(entries, []);
  });

  it('parseSeenPostingsContent returns empty array for header-only file', () => {
    const entries = parseSeenPostingsContent('# Seen Postings\n\n_Last updated: 2026-04-09_\n');
    assert.deepEqual(entries, []);
  });
});
