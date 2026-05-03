import { describe, expect, test } from 'bun:test';
import { scoreBullet, extractKeywords } from '../../src/resume-tailor/score-bullets';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const jd = readFileSync(resolve(__dirname, 'fixtures/jd-platform-vp.txt'), 'utf8');

describe('extractKeywords', () => {
  test('extracts platform-relevant terms', () => {
    const kws = extractKeywords(jd);
    expect(kws).toContain('platform');
    expect(kws).toContain('ci/cd');
    expect(kws).toContain('design system');
    expect(kws).toContain('international');
  });
});

describe('scoreBullet', () => {
  const kws = extractKeywords(jd);

  test('scores a high-relevance bullet > a low-relevance bullet', () => {
    const high = 'Achieved 85% design system adoption across 185 repositories via AI-driven automation.';
    const low = 'Pioneered WCAG-compliant accessibility with sustainable automation.';
    expect(scoreBullet(high, kws)).toBeGreaterThan(scoreBullet(low, kws));
  });

  test('returns 0 for an empty bullet', () => {
    expect(scoreBullet('', kws)).toBe(0);
  });

  test('higher score for multiple keyword matches', () => {
    const bullet = 'Led platform migration for international engineering teams modernizing CI/CD.';
    const score = scoreBullet(bullet, kws);
    expect(score).toBeGreaterThanOrEqual(3);
  });
});
