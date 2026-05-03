// tests/resume-tailor/page-count.test.ts
import { describe, expect, test } from 'bun:test';
import { pageCount } from '../../src/resume-tailor/page-count';
import { resolve } from 'node:path';

describe('pageCount', () => {
  test('reports 1 for a one-page docx', async () => {
    const fixture = resolve(__dirname, 'fixtures/one-page.docx');
    expect(await pageCount(fixture)).toBe(1);
  });

  test('reports 3 for a three-page docx', async () => {
    const fixture = resolve(__dirname, 'fixtures/three-page.docx');
    expect(await pageCount(fixture)).toBe(3);
  });

  test('throws on missing file', async () => {
    expect(pageCount('/tmp/does-not-exist-xyz.docx')).rejects.toThrow();
  });
});
