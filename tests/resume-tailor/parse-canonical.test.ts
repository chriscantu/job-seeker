import { describe, expect, test } from 'bun:test';
import { parseCanonicalResume } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = readFileSync(resolve(__dirname, 'fixtures/canonical-sample.md'), 'utf8');

describe('parseCanonicalResume', () => {
  test('parses frontmatter', () => {
    const ast = parseCanonicalResume(fixture);
    expect(ast.frontmatter.template_version).toBe(1);
    expect(ast.frontmatter.canonical_version).toBe('2026-05-03');
  });

  test('parses header', () => {
    const ast = parseCanonicalResume(fixture);
    expect(ast.header.name).toBe('Christopher Cantu');
    expect(ast.header.tagline).toContain('Senior Engineering Leader');
    expect(ast.header.contact).toContain('christopher.cantu@gmail.com');
  });

  test('parses summary', () => {
    const ast = parseCanonicalResume(fixture);
    expect(ast.summary).toContain('Senior Engineering Leader specializing');
  });

  test('parses 6 key accomplishments with label and single-sentence description', () => {
    const ast = parseCanonicalResume(fixture);
    expect(ast.keyAccomplishments).toHaveLength(6);
    expect(ast.keyAccomplishments[0].label).toBe('Revenue Impact');
    expect(ast.keyAccomplishments[0].description).toContain('Delivered $18M+');
    expect(ast.keyAccomplishments[0].description).toContain('ahead of schedule');
  });

  test('parses skills as array', () => {
    const ast = parseCanonicalResume(fixture);
    expect(Array.isArray(ast.skills)).toBe(true);
    expect(ast.skills.length).toBe(10);
    expect(ast.skills).toContain('Delivery Transformation');
  });

  test('parses roles in order, newest first', () => {
    const ast = parseCanonicalResume(fixture);
    expect(ast.roles[0].company).toBe('Procore Technologies');
    expect(ast.roles[1].company).toBe('Babylon Health');
    expect(ast.roles[2].company).toContain('Vrbo');
  });

  test('parses sub-roles for Vrbo', () => {
    const ast = parseCanonicalResume(fixture);
    const vrbo = ast.roles[2];
    expect(vrbo.subRoles).toHaveLength(2);
    expect(vrbo.subRoles![0].label).toContain('Director of Engineering');
  });

  test('every bullet has non-empty text (single-sentence CAR)', () => {
    const ast = parseCanonicalResume(fixture);
    for (const role of ast.roles) {
      const allBullets = role.subRoles
        ? role.subRoles.flatMap((s) => s.bullets)
        : role.bullets;
      for (const b of allBullets) {
        expect(b.text.length).toBeGreaterThan(0);
      }
    }
  });

  test('parses education', () => {
    const ast = parseCanonicalResume(fixture);
    expect(ast.education.degrees).toContain('Master of Science');
    expect(ast.education.school).toBe('Baylor University');
  });
});
