import { describe, expect, test } from 'bun:test';
import { enforceTwoPages } from '../../src/resume-tailor/enforce-pages';
import { parseCanonicalResume } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const oversize = readFileSync(resolve(__dirname, 'fixtures/oversize-canonical.md'), 'utf8');

describe('enforceTwoPages', () => {
  test('drops bullets until ≤2 pages and logs decisions', async () => {
    const ast = parseCanonicalResume(oversize);
    const fakeRender = async (_ast: typeof ast) => {
      // simulate page count by AST size
      const totalBullets = ast.roles.flatMap((r) =>
        r.subRoles ? r.subRoles.flatMap((s) => s.bullets) : r.bullets,
      ).length;
      return totalBullets > 8 ? 3 : 2;
    };
    const result = await enforceTwoPages(ast, new Map(), { render: fakeRender, max: 5 });
    expect(result.pages).toBeLessThanOrEqual(2);
    expect(result.dropped.length).toBeGreaterThan(0);
  });

  test('throws when drop pool exhausted', async () => {
    const ast = parseCanonicalResume(oversize);
    ast.roles.slice(1).forEach((r) => {
      if (r.subRoles) r.subRoles.forEach((s) => (s.bullets = []));
      else r.bullets = [];
    });
    const fakeRender = async () => 3;
    expect(
      enforceTwoPages(ast, new Map(), { render: fakeRender, max: 5 }),
    ).rejects.toThrow(/drop pool exhausted/);
  });

  test('throws when iteration limit reached', async () => {
    const ast = parseCanonicalResume(oversize);
    const fakeRender = async () => 3;
    expect(
      enforceTwoPages(ast, new Map(), { render: fakeRender, max: 2 }),
    ).rejects.toThrow(/did not converge/);
  });
});
