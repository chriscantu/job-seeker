import { describe, expect, test } from 'bun:test';
import { composeTailoredResumeMarkdown } from '../../src/resume-tailor/compose-tailored';
import { parseCanonicalResume } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const md = readFileSync(resolve(__dirname, 'fixtures/canonical-sample.md'), 'utf8');

describe('composeTailoredResumeMarkdown', () => {
  test('round-trips through parse without losing structure', () => {
    const ast = parseCanonicalResume(md);
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'Acme', role: 'VP', posting_url: 'https://x', generated: '2026-05-01',
    });
    const reparsed = parseCanonicalResume(out);
    expect(reparsed.header.name).toBe(ast.header.name);
    expect(reparsed.roles).toHaveLength(ast.roles.length);
  });

  test('writes frontmatter with company/role/posting_url', () => {
    const ast = parseCanonicalResume(md);
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'Acme Corp', role: 'VP Engineering', posting_url: 'https://x', generated: '2026-05-01',
    });
    expect(out).toContain('company: Acme Corp');
    expect(out).toContain('role: VP Engineering');
  });

  test('skills line is single line, pipe-delimited', () => {
    const ast = parseCanonicalResume(md);
    ast.skills = ['A', 'B', 'C'];
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).toMatch(/## Skills\n\n::: \{custom-style="SkillsLine"\}\nA \| B \| C\n:::/);
  });

  test('emits no **Impact:** literal anywhere (CAR is implicit, single-sentence)', () => {
    const ast = parseCanonicalResume(md);
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).not.toContain('**Impact:**');
  });

  test('every experience bullet ends with a period', () => {
    const ast = parseCanonicalResume(md);
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    const experienceSection = out.split('## Professional Experience')[1].split('## Education')[0];
    const bulletLines = experienceSection.split('\n').filter((l) => l.startsWith('- '));
    expect(bulletLines.length).toBeGreaterThan(0);
    for (const line of bulletLines) {
      expect(line).toMatch(/\.$/);
    }
  });

  test('no Challenge:/Action:/Results: literals', () => {
    const ast = parseCanonicalResume(md);
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).not.toContain('**Challenge:**');
    expect(out).not.toContain('**Action:**');
    expect(out).not.toContain('**Results:**');
  });

  test('omits posting_url value when undefined (legitimately blank)', () => {
    const ast = parseCanonicalResume(md);
    const out = composeTailoredResumeMarkdown(ast, {
      company: 'X', role: 'Y', generated: '2026-05-01',
    });
    expect(out).toContain('posting_url: \n');
  });
});

describe('composeTailoredResumeMarkdown — input validation', () => {
  const validFm = () => ({
    company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
  });

  test('throws when ast.header.name is missing', () => {
    const ast = parseCanonicalResume(md);
    ast.header = { ...ast.header, name: '' };
    expect(() => composeTailoredResumeMarkdown(ast, validFm())).toThrow(/header\.name/);
  });

  test('throws when ast.summary is missing', () => {
    const ast = parseCanonicalResume(md);
    (ast as { summary: unknown }).summary = undefined;
    expect(() => composeTailoredResumeMarkdown(ast, validFm())).toThrow(/summary/);
  });

  test('throws when ast.skills is missing', () => {
    const ast = parseCanonicalResume(md);
    (ast as { skills: unknown }).skills = undefined;
    expect(() => composeTailoredResumeMarkdown(ast, validFm())).toThrow(/skills/);
  });

  test('throws when ast.roles is missing', () => {
    const ast = parseCanonicalResume(md);
    (ast as { roles: unknown }).roles = undefined;
    expect(() => composeTailoredResumeMarkdown(ast, validFm())).toThrow(/roles/);
  });

  test('throws when ast.education.degrees is missing', () => {
    const ast = parseCanonicalResume(md);
    ast.education = { ...ast.education, degrees: '' };
    expect(() => composeTailoredResumeMarkdown(ast, validFm())).toThrow(/education\.degrees/);
  });

  test('throws when frontmatter.company is missing', () => {
    const ast = parseCanonicalResume(md);
    expect(() => composeTailoredResumeMarkdown(ast, { ...validFm(), company: '' })).toThrow(/company/);
  });

  test('throws when frontmatter.role is missing', () => {
    const ast = parseCanonicalResume(md);
    expect(() => composeTailoredResumeMarkdown(ast, { ...validFm(), role: '' })).toThrow(/role/);
  });

  test('throws when frontmatter.generated is missing', () => {
    const ast = parseCanonicalResume(md);
    expect(() => composeTailoredResumeMarkdown(ast, { ...validFm(), generated: '' })).toThrow(/generated/);
  });
});
