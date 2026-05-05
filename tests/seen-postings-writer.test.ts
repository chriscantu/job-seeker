import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  appendSeenPosting,
  flagSeenPosting,
  formatEntry,
  makeEntry,
  parseSeenPostingsFile,
} from '../scripts/lib/seen-postings';
import { resolveStateFile } from '../scripts/lib/util';
import { parseFrontmatter } from '../scripts/lib/frontmatter';

const TMP_DIR = path.join(__dirname, 'tmp-writer');

function setupTmpDir() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function teardownTmpDir() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
}

describe('seen-postings writer', () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => teardownTmpDir());

  describe('formatEntry', () => {
    it('formats entry with posted date', () => {
      const line = formatEntry(makeEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        url: 'https://job-boards.greenhouse.io/natera/jobs/123',
        posted: '2026-04-06',
      }));
      assert.equal(line, '- Natera | VP of Engineering | https://job-boards.greenhouse.io/natera/jobs/123 | posted:2026-04-06');
    });

    it('formats entry with discovered date', () => {
      const line = formatEntry(makeEntry({
        company: 'Stealth',
        title: 'Head of Engineering',
        url: null,
        discovered: '2026-04-09',
      }));
      assert.equal(line, '- Stealth | Head of Engineering | discovered:2026-04-09');
    });

    it('formats entry with flags', () => {
      const line = formatEntry(makeEntry({
        company: 'Acme',
        title: 'VP Engineering',
        url: 'https://example.com/job/1',
        posted: '2026-04-06',
        flags: ['RESEARCHED'],
      }));
      assert.equal(line, '- Acme | VP Engineering | https://example.com/job/1 | posted:2026-04-06 | RESEARCHED');
    });

    it('formats entry with source tag', () => {
      const line = formatEntry(makeEntry({
        company: 'Acme',
        title: 'VP Engineering',
        url: 'https://example.com/job/1',
        posted: '2026-04-06',
        source: 'email-linkedin',
      }));
      assert.equal(line, '- Acme | VP Engineering | https://example.com/job/1 | posted:2026-04-06 | source:email-linkedin');
    });
  });

  describe('appendSeenPosting', () => {
    it('creates new file when none exists', () => {
      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'Natera',
        title: 'VP of Engineering',
        url: 'https://example.com/job/1',
        posted: '2026-04-09',
      }));

      const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('seen-postings'));
      assert.equal(files.length, 1);
      assert.ok(files[0].match(/^\d{4}-\d{2}-\d{2}-seen-postings\.md$/));

      const content = fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8');
      assert.ok(content.includes('Natera'));
      assert.ok(content.includes('posted:2026-04-09'));
    });

    it('appends to existing file under today header', () => {
      // Create initial file
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `${today}-seen-postings.md`;
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `# Job Search — Seen Postings\n\n## ${today}\n- Existing | VP Eng | https://example.com/old | posted:${today}\n`
      );

      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'NewCo',
        title: 'VP Engineering',
        url: 'https://example.com/new',
        posted: '2026-04-09',
      }));

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      assert.ok(content.includes('Existing'), 'should keep existing entry');
      assert.ok(content.includes('NewCo'), 'should add new entry');
    });

    it('adds new date header when appending on a different day', () => {
      const fileName = '2026-04-01-seen-postings.md';
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        '# Job Search — Seen Postings\n\n## 2026-04-01\n- Old | VP Eng | https://example.com | posted:2026-04-01\n'
      );

      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'NewCo',
        title: 'VP Engineering',
        url: 'https://example.com/new',
        posted: '2026-04-09',
      }));

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      const today = new Date().toISOString().slice(0, 10);
      assert.ok(content.includes(`## ${today}`), 'should add today header');
      assert.ok(content.includes('NewCo'));
    });

    it('throws on invalid entry', () => {
      assert.throws(() => {
        appendSeenPosting(TMP_DIR, makeEntry({
          company: '',
          title: 'VP Engineering',
          url: 'https://example.com',
        }));
      });
    });
  });

  describe('flagSeenPosting', () => {
    it('appends flag to matching URL entry', () => {
      const fileName = '2026-04-01-seen-postings.md';
      const targetUrl = 'https://job-boards.greenhouse.io/natera/jobs/123';
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `# Job Search — Seen Postings\n\n## 2026-04-01\n- Natera | VP of Engineering | ${targetUrl} | posted:2026-04-01\n`
      );

      const result = flagSeenPosting(TMP_DIR, targetUrl, 'RESEARCHED');
      assert.equal(result.success, true);

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      assert.ok(content.includes('| RESEARCHED'), 'should append flag');
    });

    it('is idempotent — does not duplicate flag', () => {
      const fileName = '2026-04-01-seen-postings.md';
      const targetUrl = 'https://example.com/job/1';
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `# Seen Postings\n\n## 2026-04-01\n- Acme | VP Eng | ${targetUrl} | posted:2026-04-01 | RESEARCHED\n`
      );

      const result = flagSeenPosting(TMP_DIR, targetUrl, 'RESEARCHED');
      assert.equal(result.success, true);
      assert.equal(result.alreadyFlagged, true);

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      const count = (content.match(/RESEARCHED/g) || []).length;
      assert.equal(count, 1, 'should not duplicate flag');
    });

    it('returns error when URL not found', () => {
      const fileName = '2026-04-01-seen-postings.md';
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        '# Seen Postings\n\n## 2026-04-01\n- Acme | VP Eng | https://other.com | posted:2026-04-01\n'
      );

      const result = flagSeenPosting(TMP_DIR, 'https://not-found.com/job', 'RESEARCHED');
      assert.equal(result.success, false);
      assert.ok(result.error!.includes('No entry found'));
    });
  });

  describe('resolveStateFile', () => {
    it('returns most recent file', () => {
      fs.writeFileSync(path.join(TMP_DIR, '2026-03-14-seen-postings.md'), 'old');
      fs.writeFileSync(path.join(TMP_DIR, '2026-04-01-seen-postings.md'), 'new');

      const result = resolveStateFile(TMP_DIR, 'seen-postings');
      assert.ok(result!.endsWith('2026-04-01-seen-postings.md'));
    });

    it('returns null when no files exist', () => {
      const result = resolveStateFile(TMP_DIR, 'seen-postings');
      assert.equal(result, null);
    });

    it('returns null when directory does not exist', () => {
      const result = resolveStateFile('/tmp/nonexistent-dir-99999', 'seen-postings');
      assert.equal(result, null);
    });
  });

  describe('round-trip (append then parse)', () => {
    it('produces entries the parser can read back correctly', () => {
      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'RoundTrip Co',
        title: 'VP of Engineering',
        url: 'https://example.com/roundtrip/1',
        posted: '2026-04-09',
        source: 'email-linkedin',
        flags: ['RESEARCHED'],
      }));

      const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('seen-postings'));
      const entries = parseSeenPostingsFile(path.join(TMP_DIR, files[0]));
      const entry = entries.find(e => e.company === 'RoundTrip Co')!;

      assert.ok(entry, 'should find appended entry');
      assert.equal(entry.title, 'VP of Engineering');
      assert.equal(entry.url, 'https://example.com/roundtrip/1');
      assert.equal(entry.posted, '2026-04-09');
      assert.equal(entry.source, 'email-linkedin');
      assert.ok(entry.flags.includes('RESEARCHED'));
    });
  });

  describe('frontmatter support', () => {
    it('appendSeenPosting preserves existing frontmatter and updates last_updated', () => {
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `${today}-seen-postings.md`;
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `---\nformat_version: 1\nlast_updated: 2026-01-01\n---\n# Job Search — Seen Postings\n\n## ${today}\n- Old | VP Eng | https://example.com/old | posted:${today}\n`
      );

      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'NewCo',
        title: 'VP Engineering',
        url: 'https://example.com/new',
        posted: '2026-04-09',
      }));

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      const { meta, body } = parseFrontmatter(content);

      assert.equal(meta.format_version, '1');
      assert.equal(meta.last_updated, today);
      assert.ok(body.includes('Old'));
      assert.ok(body.includes('NewCo'));
    });

    it('appendSeenPosting backfills frontmatter when none exists', () => {
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `${today}-seen-postings.md`;
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `# Job Search — Seen Postings\n\n## ${today}\n- Old | VP Eng | https://example.com/old | posted:${today}\n`
      );

      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'NewCo',
        title: 'VP Engineering',
        url: 'https://example.com/new',
        posted: '2026-04-09',
      }));

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      const { meta } = parseFrontmatter(content);

      assert.equal(meta.format_version, '1');
      assert.equal(meta.last_updated, today);
    });

    it('appendSeenPosting creates new file with frontmatter', () => {

      appendSeenPosting(TMP_DIR, makeEntry({
        company: 'FreshCo',
        title: 'VP Engineering',
        url: 'https://example.com/fresh',
        posted: '2026-04-09',
      }));

      const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('seen-postings'));
      const content = fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8');
      const { meta, body } = parseFrontmatter(content);

      assert.equal(meta.format_version, '1');
      assert.ok(meta.last_updated);
      assert.ok(body.includes('FreshCo'));
    });

    it('flagSeenPosting backfills frontmatter on legacy file (no existing frontmatter)', () => {
      const targetUrl = 'https://example.com/job/legacy-flag';
      const fileName = '2026-03-01-seen-postings.md';
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `# Job Search — Seen Postings\n\n## 2026-03-01\n- LegacyCo | VP Eng | ${targetUrl} | posted:2026-03-01\n`
      );

      const result = flagSeenPosting(TMP_DIR, targetUrl, 'RESEARCHED');
      assert.equal(result.success, true);

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      const { meta, body } = parseFrontmatter(content);

      assert.equal(meta.format_version, '1');
      assert.ok(meta.last_updated);
      assert.ok(body.includes('RESEARCHED'));
    });

    it('flagSeenPosting preserves frontmatter and updates last_updated', () => {
      const targetUrl = 'https://example.com/job/flag-test';
      const fileName = '2026-04-01-seen-postings.md';
      fs.writeFileSync(path.join(TMP_DIR, fileName),
        `---\nformat_version: 1\nlast_updated: 2026-04-01\n---\n# Seen Postings\n\n## 2026-04-01\n- FlagCo | VP Eng | ${targetUrl} | posted:2026-04-01\n`
      );

      const result = flagSeenPosting(TMP_DIR, targetUrl, 'RESEARCHED');
      assert.equal(result.success, true);

      const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
      const { meta, body } = parseFrontmatter(content);

      assert.equal(meta.format_version, '1');
      const today = new Date().toISOString().slice(0, 10);
      assert.equal(meta.last_updated, today);
      assert.ok(body.includes('RESEARCHED'));
    });
  });

  describe('flagSeenPosting across files', () => {
    it('finds and flags entry in older file', () => {
      const targetUrl = 'https://example.com/old-job/1';
      fs.writeFileSync(path.join(TMP_DIR, '2026-03-14-seen-postings.md'),
        `# Seen Postings\n\n## 2026-03-14\n- OldCo | VP Eng | ${targetUrl} | posted:2026-03-14\n`
      );
      fs.writeFileSync(path.join(TMP_DIR, '2026-04-01-seen-postings.md'),
        '# Seen Postings\n\n## 2026-04-01\n- NewCo | VP Eng | https://example.com/new | posted:2026-04-01\n'
      );

      const result = flagSeenPosting(TMP_DIR, targetUrl, 'RESEARCHED');
      assert.equal(result.success, true);

      const content = fs.readFileSync(path.join(TMP_DIR, '2026-03-14-seen-postings.md'), 'utf8');
      assert.ok(content.includes('| RESEARCHED'));
    });
  });
});
