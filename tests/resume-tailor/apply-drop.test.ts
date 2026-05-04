import { describe, expect, test } from 'bun:test';
import { removeBulletFromAst } from '../../src/resume-tailor/apply-drop';
import type { ResumeAST } from '../../src/resume-tailor/types';

const baseAST = (): ResumeAST => ({
  frontmatter: { template_version: 1, canonical_version: '2026-05-01' },
  header: { name: '', tagline: '', contact: '' }, summary: '',
  keyAccomplishments: [], skills: [], education: { degrees: '', school: '' },
  roles: [
    { title: '', company: 'A', meta: '', bullets: [
      { text: 'a1' }, { text: 'a2' },
    ] },
  ],
});

describe('removeBulletFromAst', () => {
  test('removes the targeted bullet by index', () => {
    const ast = baseAST();
    removeBulletFromAst(ast, { roleIndex: 0, roleCompany: 'A', bulletIndex: 1, bulletText: 'a2' });
    expect(ast.roles[0].bullets).toHaveLength(1);
    expect(ast.roles[0].bullets[0].text).toBe('a1');
  });

  test('removes from sub-role when present', () => {
    const ast = baseAST();
    ast.roles[0].bullets = [];
    ast.roles[0].subRoles = [
      { label: 'sub', bullets: [{ text: 's1' }, { text: 's2' }] },
    ];
    removeBulletFromAst(ast, { roleIndex: 0, roleCompany: 'A', bulletIndex: 0, bulletText: 's1' });
    expect(ast.roles[0].subRoles[0].bullets).toHaveLength(1);
    expect(ast.roles[0].subRoles[0].bullets[0].text).toBe('s2');
  });
});
