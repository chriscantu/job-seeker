import { describe, expect, test } from 'bun:test';
import { selectDropTarget } from '../../src/resume-tailor/drop-target';
import type { ResumeAST } from '../../src/resume-tailor/types';

function makeAST(): ResumeAST {
  return {
    frontmatter: { template_version: 1, canonical_version: '2026-05-01' },
    header: { name: 'X', tagline: 'Y', contact: 'Z' },
    summary: 'sum',
    keyAccomplishments: [],
    skills: [],
    education: { degrees: 'd', school: 's' },
    roles: [
      {
        title: 'Director', company: 'CurrentCo', meta: '',
        bullets: [
          { text: 'recent top' },
          { text: 'recent bottom' },
        ],
      },
      {
        title: 'Director', company: 'MidCo', meta: '',
        bullets: [
          { text: 'mid top' },
          { text: 'mid bottom' },
        ],
      },
      {
        title: 'Manager', company: 'OldestCo', meta: '',
        bullets: [
          { text: 'old top relevant' },
          { text: 'old bottom irrelevant' },
        ],
      },
    ],
  };
}

describe('selectDropTarget', () => {
  test('drops oldest role bottom bullet first', () => {
    const ast = makeAST();
    const scores = new Map([
      ['old top relevant', 10],
      ['old bottom irrelevant', 1],
      ['mid top', 5], ['mid bottom', 4],
      ['recent top', 8], ['recent bottom', 7],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.bulletText).toBe('old bottom irrelevant');
    expect(target?.roleCompany).toBe('OldestCo');
  });

  test('relevance tiebreak within oldest role', () => {
    const ast = makeAST();
    const scores = new Map([
      ['old top relevant', 1],
      ['old bottom irrelevant', 10],
      ['mid top', 5], ['mid bottom', 4],
      ['recent top', 8], ['recent bottom', 7],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.bulletText).toBe('old top relevant');
  });

  test('advances to second-oldest when oldest exhausted', () => {
    const ast = makeAST();
    ast.roles[2].bullets = [];
    const scores = new Map([
      ['mid top', 5], ['mid bottom', 4],
      ['recent top', 8], ['recent bottom', 7],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.roleCompany).toBe('MidCo');
    expect(target?.bulletText).toBe('mid bottom');
  });

  test('never drops from current role', () => {
    const ast = makeAST();
    ast.roles[1].bullets = [];
    ast.roles[2].bullets = [];
    const scores = new Map();
    expect(selectDropTarget(ast, scores)).toBeNull();
  });

  test('returns null when all eligible roles exhausted', () => {
    const ast = makeAST();
    ast.roles[1].bullets = [];
    ast.roles[2].bullets = [];
    const scores = new Map([['recent top', 1]]);
    expect(selectDropTarget(ast, scores)).toBeNull();
  });

  test('flattens sub-role bullets with sequential indices, picks last sub-role bottom on tie', () => {
    const ast = makeAST();
    ast.roles[2] = {
      title: 'SSEM/Director', company: 'OldestCo', meta: '',
      bullets: [],
      subRoles: [
        {
          label: 'As Director',
          bullets: [
            { text: 'sub1 top' },
            { text: 'sub1 bottom' },
          ],
        },
        {
          label: 'As SSEM',
          bullets: [
            { text: 'sub2 top' },
            { text: 'sub2 bottom' },
          ],
        },
      ],
    };
    const scores = new Map([
      ['sub1 top', 0], ['sub1 bottom', 0],
      ['sub2 top', 0], ['sub2 bottom', 0],
    ]);
    const target = selectDropTarget(ast, scores);
    expect(target?.roleCompany).toBe('OldestCo');
    expect(target?.bulletText).toBe('sub2 bottom');
    expect(target?.bulletIndex).toBe(3);
  });
});
