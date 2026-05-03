import { describe, expect, test } from 'bun:test';
import { composeTailored } from '../../src/resume-tailor/compose-tailored';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const md = readFileSync(resolve(__dirname, 'fixtures/canonical-sample.md'), 'utf8');

describe('composeTailored', () => {
  test('round-trips through parse without losing structure', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'Acme', role: 'VP', posting_url: 'https://x', generated: '2026-05-01',
    });
    const reparsed = parseCanonical(out);
    expect(reparsed.header.name).toBe(ast.header.name);
    expect(reparsed.roles).toHaveLength(ast.roles.length);
  });

  test('writes frontmatter with company/role/posting_url', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'Acme Corp', role: 'VP Engineering', posting_url: 'https://x', generated: '2026-05-01',
    });
    expect(out).toContain('company: Acme Corp');
    expect(out).toContain('role: VP Engineering');
  });

  test('skills line is single line, pipe-delimited', () => {
    const ast = parseCanonical(md);
    ast.skills = ['A', 'B', 'C'];
    const out = composeTailored(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).toMatch(/## Skills\n\nA \| B \| C\n/);
  });

  test('every bullet preserves Impact clause', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    const bulletLines = out.split('\n').filter((l) => l.trim().startsWith('- ') && !l.includes('**Revenue Impact**'));
    for (const line of bulletLines) {
      if (line.includes('## Key Accomplishments')) continue;
      if (line.match(/^- \*\*[A-Z]/)) continue; // Key Accomplishments lines start with bold label
      expect(line).toContain('**Impact:**');
    }
  });

  test('no Challenge:/Action:/Results: literals', () => {
    const ast = parseCanonical(md);
    const out = composeTailored(ast, {
      company: 'X', role: 'Y', posting_url: '', generated: '2026-05-01',
    });
    expect(out).not.toContain('**Challenge:**');
    expect(out).not.toContain('**Action:**');
    expect(out).not.toContain('**Results:**');
  });
});
