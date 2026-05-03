import { describe, expect, test } from 'bun:test';
import { swapLeadClause } from '../../src/resume-tailor/summary-swap';

const baseline =
  'Senior Engineering Leader specializing in large-scale delivery transformation across post-IPO and enterprise technology organizations. ' +
  'Known for rescuing failing delivery systems, modernizing engineering practices, and building scalable platforms. ' +
  'Brings 15+ years leading multinational engineering teams through complex modernization efforts. ' +
  'Proven track record transforming CI/CD reliability from 1–5% to 95–99%.';

describe('swapLeadClause', () => {
  test('swaps lead clause when JD has stronger match', () => {
    const out = swapLeadClause(baseline, 'platform engineering at scale');
    expect(out.startsWith('Senior Engineering Leader specializing in platform engineering at scale')).toBe(true);
  });

  test('preserves the rest verbatim', () => {
    const out = swapLeadClause(baseline, 'platform engineering at scale');
    expect(out).toContain('rescuing failing delivery systems');
    expect(out).toContain('15+ years');
    expect(out).toContain('1–5% to 95–99%');
  });

  test('returns baseline when JD focus is empty', () => {
    expect(swapLeadClause(baseline, '')).toBe(baseline);
  });

  test('does not introduce new claims', () => {
    const out = swapLeadClause(baseline, 'AI infrastructure');
    expect(out.split('.').length).toBe(baseline.split('.').length);
  });
});
