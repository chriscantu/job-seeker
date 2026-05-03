import { describe, expect, test } from 'bun:test';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = readFileSync(resolve(__dirname, 'fixtures/canonical-sample.md'), 'utf8');

describe('parseCanonical', () => {
  test('parses frontmatter', () => {
    const ast = parseCanonical(fixture);
    expect(ast.frontmatter.template_version).toBe(1);
    expect(ast.frontmatter.canonical_version).toBe('2026-05-01');
  });

  test('parses header', () => {
    const ast = parseCanonical(fixture);
    expect(ast.header.name).toBe('Christopher Cantu');
    expect(ast.header.tagline).toContain('Senior Engineering Leader');
    expect(ast.header.contact).toContain('christopher.cantu@gmail.com');
  });

  test('parses summary', () => {
    const ast = parseCanonical(fixture);
    expect(ast.summary).toContain('Senior Engineering Leader specializing');
  });

  test('parses 6 key accomplishments with label/description/impact', () => {
    const ast = parseCanonical(fixture);
    expect(ast.keyAccomplishments).toHaveLength(6);
    expect(ast.keyAccomplishments[0].label).toBe('Revenue Impact');
    expect(ast.keyAccomplishments[0].impact).toContain('European/Asian');
  });

  test('parses skills as array', () => {
    const ast = parseCanonical(fixture);
    expect(Array.isArray(ast.skills)).toBe(true);
    expect(ast.skills.length).toBeGreaterThan(10);
    expect(ast.skills).toContain('Delivery Transformation');
  });

  test('parses roles in order, newest first', () => {
    const ast = parseCanonical(fixture);
    expect(ast.roles[0].company).toBe('Procore Technologies');
    expect(ast.roles[1].company).toBe('Babylon Health');
    expect(ast.roles[2].company).toContain('Vrbo');
  });

  test('parses sub-roles for Vrbo', () => {
    const ast = parseCanonical(fixture);
    const vrbo = ast.roles[2];
    expect(vrbo.subRoles).toHaveLength(2);
    expect(vrbo.subRoles![0].label).toContain('Director of Engineering');
  });

  test('every bullet has impact text', () => {
    const ast = parseCanonical(fixture);
    for (const role of ast.roles) {
      const allBullets = role.subRoles
        ? role.subRoles.flatMap((s) => s.bullets)
        : role.bullets;
      for (const b of allBullets) {
        expect(b.impact.length).toBeGreaterThan(0);
      }
    }
  });

  test('parses education', () => {
    const ast = parseCanonical(fixture);
    expect(ast.education.degrees).toContain('Master of Science');
    expect(ast.education.school).toBe('Baylor University');
  });
});
