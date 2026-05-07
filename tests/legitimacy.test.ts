import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  computeLegitimacyTier,
  ACTIVE_AGE_MAX_DAYS,
  VERIFY_AGE_MAX_DAYS,
  STALE_AGE_THRESHOLD_DAYS,
  VERIFY_REPOST_COUNT,
  SKIP_REPOST_COUNT,
} from '../scripts/lib/legitimacy';
import { countReposts } from '../scripts/lib/seen-postings';

const TODAY = '2026-05-07';

function dateNDaysAgo(days: number): string {
  const MS = 86_400_000;
  const t = new Date(Date.UTC(2026, 4, 7));
  return new Date(t.getTime() - days * MS).toISOString().slice(0, 10);
}

describe('computeLegitimacyTier', () => {
  describe('Active tier', () => {
    it('fresh posting, no reposts -> Active', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(10),
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Active');
      assert.deepEqual(r.reasons, []);
      assert.equal(r.signals.postingAgeDays, 10);
      assert.equal(r.signals.repostCount, 0);
    });

    it('day before active threshold -> Active', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(ACTIVE_AGE_MAX_DAYS - 1),
        today: TODAY,
        repostCount: 1,
      });
      assert.equal(r.tier, 'Active');
    });

    it('repostCount=1 alone is not enough to flag', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(5),
        today: TODAY,
        repostCount: 1,
      });
      assert.equal(r.tier, 'Active');
    });
  });

  describe('Verify tier', () => {
    it('exact active threshold -> Verify', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(ACTIVE_AGE_MAX_DAYS),
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Verify');
      assert.ok(r.reasons.some((s) => s.includes(`>=${ACTIVE_AGE_MAX_DAYS}`)));
    });

    it('aged posting just under skip threshold -> Verify', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(VERIFY_AGE_MAX_DAYS),
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Verify');
    });

    it('null posted date -> Verify with reason', () => {
      const r = computeLegitimacyTier({
        posted: null,
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Verify');
      assert.ok(r.reasons.includes('posting date unknown'));
      assert.equal(r.signals.postingAgeDays, null);
    });

    it('repostCount=2 alone -> Verify', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(10),
        today: TODAY,
        repostCount: VERIFY_REPOST_COUNT,
      });
      assert.equal(r.tier, 'Verify');
      assert.ok(r.reasons.some((s) => s.includes('reposted 2×')));
    });

    it('malformed posted date treated as unknown -> Verify', () => {
      const r = computeLegitimacyTier({
        posted: 'not-a-date',
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Verify');
      assert.equal(r.signals.postingAgeDays, null);
    });
  });

  describe('STALE_AGE_THRESHOLD boundary', () => {
    it('exactly STALE threshold + 2 reposts -> Verify (not Skip)', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(STALE_AGE_THRESHOLD_DAYS),
        today: TODAY,
        repostCount: VERIFY_REPOST_COUNT,
      });
      assert.equal(r.tier, 'Verify');
    });

    it('one day past STALE threshold + 2 reposts -> Skip', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(STALE_AGE_THRESHOLD_DAYS + 1),
        today: TODAY,
        repostCount: VERIFY_REPOST_COUNT,
      });
      assert.equal(r.tier, 'Skip');
    });

    it('past STALE threshold but only 1 repost -> Verify (age alone)', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(STALE_AGE_THRESHOLD_DAYS + 5),
        today: TODAY,
        repostCount: 1,
      });
      assert.equal(r.tier, 'Verify');
    });
  });

  describe('Skip tier', () => {
    it('age over verify threshold -> Skip', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(VERIFY_AGE_MAX_DAYS + 1),
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Skip');
      assert.ok(r.reasons.some((s) => s.includes(`>${VERIFY_AGE_MAX_DAYS}d`)));
    });

    it('repostCount >= skip threshold -> Skip', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(10),
        today: TODAY,
        repostCount: SKIP_REPOST_COUNT,
      });
      assert.equal(r.tier, 'Skip');
      assert.ok(r.reasons.some((s) => s.includes('reposted 3×')));
    });

    it('combined: stale age + 2+ reposts -> Skip', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(STALE_AGE_THRESHOLD_DAYS + 5),
        today: TODAY,
        repostCount: VERIFY_REPOST_COUNT,
      });
      assert.equal(r.tier, 'Skip');
      assert.ok(r.reasons.some((s) => s.includes('stale')));
    });

    it('multiple skip signals stack reasons', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(VERIFY_AGE_MAX_DAYS + 30),
        today: TODAY,
        repostCount: SKIP_REPOST_COUNT + 1,
      });
      assert.equal(r.tier, 'Skip');
      assert.ok(r.reasons.length >= 2);
    });
  });

  describe('integration with countReposts', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legitimacy-int-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeSection(date: string, lines: string[]): void {
      const fileName = `${date}-seen-postings.md`;
      const body = `# Seen\n\n## ${date}\n${lines.join('\n')}\n`;
      fs.writeFileSync(path.join(tmpDir, fileName), body);
    }

    it('fresh role with no history -> Active end-to-end', () => {
      const url = 'https://jobs.lever.co/acme/role-1';
      const repostCount = countReposts(tmpDir, { url, today: TODAY });
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(15),
        today: TODAY,
        repostCount,
      });
      assert.equal(r.tier, 'Active');
      assert.equal(r.signals.repostCount, 0);
    });

    it('role reposted 3× in lookback window -> Skip end-to-end', () => {
      const url = 'https://jobs.lever.co/acme/repost';
      writeSection('2026-03-01', [`- Acme | VP Eng | ${url}`]);
      writeSection('2026-04-01', [`- Acme | VP Eng | ${url}`]);
      writeSection('2026-05-01', [`- Acme | VP Eng | ${url}`]);

      const repostCount = countReposts(tmpDir, { url, today: TODAY });
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(20),
        today: TODAY,
        repostCount,
      });
      assert.equal(r.tier, 'Skip');
      assert.equal(r.signals.repostCount, 3);
    });

    it('stale aged role + 2 reposts -> Skip end-to-end', () => {
      const url = 'https://jobs.lever.co/acme/old-role';
      writeSection('2026-03-15', [`- Acme | VP Eng | ${url}`]);
      writeSection('2026-04-30', [`- Acme | VP Eng | ${url}`]);

      const repostCount = countReposts(tmpDir, { url, today: TODAY });
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(STALE_AGE_THRESHOLD_DAYS + 5),
        today: TODAY,
        repostCount,
      });
      assert.equal(r.tier, 'Skip');
      assert.ok(r.reasons.some((s) => s.includes('stale')));
    });

    it('role re-listed under different URLs is counted via company+title', () => {
      writeSection('2026-03-01', [
        '- Hooli | VP Engineering | https://jobs.lever.co/hooli/old',
      ]);
      writeSection('2026-04-01', [
        '- Hooli | VP Engineering | https://jobs.lever.co/hooli/mid',
      ]);
      const newUrl = 'https://jobs.lever.co/hooli/new';
      const repostCount = countReposts(tmpDir, {
        url: newUrl,
        company: 'Hooli',
        title: 'VP Engineering',
        today: TODAY,
      });
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(10),
        today: TODAY,
        repostCount,
      });
      assert.equal(r.signals.repostCount, 2);
      assert.equal(r.tier, 'Verify');
    });
  });

  describe('signal capture', () => {
    it('records postingAgeDays for valid date', () => {
      const r = computeLegitimacyTier({
        posted: dateNDaysAgo(45),
        today: TODAY,
        repostCount: 1,
      });
      assert.equal(r.signals.postingAgeDays, 45);
      assert.equal(r.signals.repostCount, 1);
    });

    it('future-dated posting (negative age) -> Active', () => {
      const r = computeLegitimacyTier({
        posted: '2026-06-01',
        today: TODAY,
        repostCount: 0,
      });
      assert.equal(r.tier, 'Active');
      assert.ok((r.signals.postingAgeDays ?? 0) < 0);
    });
  });
});
