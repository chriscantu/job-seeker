import { describe, expect, test } from 'bun:test';
import { selectSkills } from '../../src/resume-tailor/select-skills';
import { parseSkillsMaster } from '../../src/resume-tailor/skills-master';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const masterMd = readFileSync(resolve(__dirname, '../../references/skills-master.md'), 'utf8');
const master = parseSkillsMaster(masterMd);

describe('selectSkills', () => {
  test('returns exactly 10', () => {
    const out = selectSkills(master, ['platform', 'ci/cd', 'design system']);
    expect(out).toHaveLength(10);
  });

  test('first 5 are always-tagged floor', () => {
    const out = selectSkills(master, []);
    const floorTags = out.slice(0, 5).map((name) => master.find((m) => m.name === name)?.tag);
    expect(floorTags.every((t) => t === 'always')).toBe(true);
  });

  test('last 5 are JD-relevant when keywords match', () => {
    const out = selectSkills(master, ['design system', 'micro-frontend']);
    expect(out).toContain('Design Systems');
    expect(out).toContain('Micro-Frontends');
  });

  test('falls back to situational order when no JD match', () => {
    const out = selectSkills(master, ['nonsense-keyword-xyz']);
    expect(out).toHaveLength(10);
  });

  test('throws if floor < 5', () => {
    const tiny = [{ name: 'OnlyOne', tag: 'always' as const }];
    expect(() => selectSkills(tiny, [])).toThrow('floor');
  });

  test('does not duplicate', () => {
    const out = selectSkills(master, ['delivery transformation']);
    expect(new Set(out).size).toBe(out.length);
  });
});
