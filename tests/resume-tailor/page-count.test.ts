// tests/resume-tailor/page-count.test.ts
import { describe, expect, test } from 'bun:test';
import { pageCount } from '../../src/resume-tailor/page-count';
import { resolve } from 'node:path';

// Page-count integration depends on fish + soffice + pdfinfo. Skip in
// environments missing the toolchain (e.g. CI runners without LibreOffice).
const integrationReady = !!Bun.which('fish') && !!Bun.which('soffice') && !!Bun.which('pdfinfo');

describe.skipIf(!integrationReady)('pageCount (integration)', () => {
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
