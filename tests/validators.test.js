const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateSeenPostingsEntry, validatePreferencesEntry, validateApplicationEntry } = require('../scripts/lib/validators');

describe('validators', () => {
  describe('validateSeenPostingsEntry', () => {
    it('accepts a valid entry with posted date', () => {
      const result = validateSeenPostingsEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        url: 'https://job-boards.greenhouse.io/natera/jobs/123',
        posted: '2026-04-06',
      });
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    });

    it('accepts a valid entry with discovered date', () => {
      const result = validateSeenPostingsEntry({
        company: 'Acme Corp',
        title: 'VP Engineering',
        url: 'https://jobs.lever.co/acme/abc',
        discovered: '2026-04-09',
      });
      assert.equal(result.valid, true);
    });

    it('accepts entry without URL if explicitly null', () => {
      const result = validateSeenPostingsEntry({
        company: 'Stealth Startup',
        title: 'Head of Engineering',
        url: null,
        discovered: '2026-04-09',
      });
      assert.equal(result.valid, true);
    });

    it('rejects entry missing company', () => {
      const result = validateSeenPostingsEntry({
        company: '',
        title: 'VP Engineering',
        url: 'https://example.com',
        posted: '2026-04-06',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('company')));
    });

    it('rejects entry missing title', () => {
      const result = validateSeenPostingsEntry({
        company: 'Acme',
        title: '',
        url: 'https://example.com',
        posted: '2026-04-06',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('title')));
    });

    it('rejects entry missing both posted and discovered', () => {
      const result = validateSeenPostingsEntry({
        company: 'Acme',
        title: 'VP Engineering',
        url: 'https://example.com',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('posted') || e.includes('discovered')));
    });

    it('rejects entry with invalid date format', () => {
      const result = validateSeenPostingsEntry({
        company: 'Acme',
        title: 'VP Engineering',
        url: 'https://example.com',
        posted: '04-06-2026',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('date')));
    });

    it('rejects entry with invalid URL', () => {
      const result = validateSeenPostingsEntry({
        company: 'Acme',
        title: 'VP Engineering',
        url: 'not-a-url',
        posted: '2026-04-06',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('url')));
    });

    it('collects multiple errors', () => {
      const result = validateSeenPostingsEntry({
        company: '',
        title: '',
        url: 'bad',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.length >= 3, `expected 3+ errors, got ${result.errors.length}`);
    });
  });

  describe('validateApplicationEntry', () => {
    it('accepts valid entry with required fields only (company, title, stage)', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        stage: 'Applied',
      });
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    });

    it('accepts valid entry with all fields', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        stage: 'Interview (1)',
        url: 'https://jobs.natera.com/123',
        applied: '2026-04-09',
        notes: 'Referral from Jane',
        contacts: ['Jane Doe'],
        nextAction: 'Follow up',
      });
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    });

    it('rejects empty company', () => {
      const result = validateApplicationEntry({
        company: '',
        title: 'VP of Engineering',
        stage: 'Applied',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('company')));
    });

    it('rejects empty title', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: '',
        stage: 'Applied',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('title')));
    });

    it('rejects missing stage', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: 'VP of Engineering',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('stage')));
    });

    it('rejects invalid stage', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        stage: 'Vibing',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('stage')));
    });

    it('rejects invalid URL (not http/https)', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        stage: 'Applied',
        url: 'ftp://jobs.natera.com/123',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('url')));
    });

    it('rejects invalid applied date format (not YYYY-MM-DD)', () => {
      const result = validateApplicationEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        stage: 'Applied',
        applied: '04-09-2026',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('applied')));
    });

    it('rejects pipe character in company name', () => {
      const result = validateApplicationEntry({
        company: 'Natera|Bad',
        title: 'VP of Engineering',
        stage: 'Applied',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('company')));
    });
  });

  describe('validatePreferencesEntry', () => {
    it('accepts a valid entry', () => {
      const result = validatePreferencesEntry({
        section: 'Source Effectiveness',
        entries: ['Indeed: 3 relevant roles'],
      });
      assert.equal(result.valid, true);
    });

    it('rejects entry missing section', () => {
      const result = validatePreferencesEntry({
        section: '',
        entries: ['data'],
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('section')));
    });

    it('rejects entry with empty entries array', () => {
      const result = validatePreferencesEntry({
        section: 'Source Effectiveness',
        entries: [],
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('entries')));
    });

    it('rejects entry with missing entries', () => {
      const result = validatePreferencesEntry({
        section: 'Source Effectiveness',
      });
      assert.equal(result.valid, false);
    });
  });
});
