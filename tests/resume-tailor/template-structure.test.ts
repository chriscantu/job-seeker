import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TEMPLATE = resolve(__dirname, '../../references/resume-template.docx');

const REQUIRED_STYLE_NAMES = [
  'Heading 1',
  'Heading 2',
  'Heading 3',
  'Tagline',
  'Contact',
  'Role Meta',
  'List Bullet',
  'Skills Line',
  'Accomplishment',
  'Body Text (Summary)',
];

const unzipAvailable = !!Bun.which('unzip');

describe.skipIf(!existsSync(TEMPLATE) || !unzipAvailable)('resume-template.docx structure', () => {
  function readPart(part: string): string {
    return execSync(`unzip -p "${TEMPLATE}" ${part}`, { encoding: 'utf8' });
  }

  test('contains every required named style by display name', () => {
    const styles = readPart('word/styles.xml');
    for (const name of REQUIRED_STYLE_NAMES) {
      expect(styles).toContain(`<w:name w:val="${name}"/>`);
    }
  });

  test('uses 0.75in (1080 DXA) margins on all four sides', () => {
    const pgMar = readPart('word/document.xml').match(/<w:pgMar\b[^/]*\/>/)?.[0] ?? '';
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(pgMar).toContain(`w:${side}="1080"`);
    }
  });

  test('body has no content paragraphs (empty template)', () => {
    const doc = readPart('word/document.xml');
    const bodyMatch = doc.match(/<w:body>([\s\S]*)<\/w:body>/);
    expect(bodyMatch).not.toBeNull();
    const body = bodyMatch![1];
    // Acceptable: zero or one empty <w:p/> elements alongside the section properties.
    // Any <w:p> with text content would mean smoke-test artefacts leaked in.
    expect(body).not.toMatch(/<w:t[^>]*>[^<]/);
  });

  test('Heading 2 has the navy bottom border per spec', () => {
    const styles = readPart('word/styles.xml');
    const heading2 = styles.match(/<w:style[^>]*w:styleId="Heading2">[\s\S]*?<\/w:style>/);
    expect(heading2).not.toBeNull();
    expect(heading2![0]).toMatch(/<w:bottom\b[^>]*\bw:color="1F3A5F"/);
  });

  test('List Bullet uses the • glyph in numbering definition', () => {
    const numbering = readPart('word/numbering.xml');
    expect(numbering).toContain('w:val="•"');
  });

  test('committed binary is non-zero and reasonably sized', () => {
    const buf = readFileSync(TEMPLATE);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.length).toBeLessThan(50000);
  });
});
