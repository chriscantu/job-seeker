import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { pageCount, type PageCount } from '../../src/resume-tailor/page-count';
import { resolve } from 'node:path';
import { existsSync, writeFileSync, chmodSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Unit tests — stub fish scripts cover error branches without LibreOffice ──

const fishAvailable = !!Bun.which('fish');

describe.skipIf(!fishAvailable)('pageCount (unit)', () => {
  let stubDir: string;

  beforeAll(() => {
    stubDir = mkdtempSync(join(tmpdir(), 'page-count-stubs-'));
  });

  afterAll(() => {
    rmSync(stubDir, { recursive: true, force: true });
  });

  function makeStub(name: string, body: string): string {
    const path = join(stubDir, name);
    writeFileSync(path, `#!/usr/bin/env fish\n${body}\n`);
    chmodSync(path, 0o755);
    return path;
  }

  test('throws on non-zero exit, surfaces stderr', async () => {
    const stub = makeStub('exit-2.fish', 'echo "soffice produced no output" >&2; exit 2');
    await expect(pageCount('any.docx', stub)).rejects.toThrow(/exit 2.*soffice produced no output/);
  });

  test('throws on non-integer stdout (regex guard)', async () => {
    const stub = makeStub('garbage.fish', 'echo "Pages: 3"');
    await expect(pageCount('any.docx', stub)).rejects.toThrow(/non-integer: Pages: 3/);
  });

  test('throws on empty stdout', async () => {
    const stub = makeStub('empty.fish', 'echo ""');
    await expect(pageCount('any.docx', stub)).rejects.toThrow(/non-integer/);
  });

  test('parses clean integer output', async () => {
    const stub = makeStub('seven.fish', 'echo 7');
    expect(await pageCount('any.docx', stub)).toBe(7 as ReturnType<typeof Number> as PageCount);
  });
});

// ── Integration — needs fish + soffice + pdfinfo + pre-built fixtures ───────

const FIXTURE_DIR = resolve(__dirname, 'fixtures');
const fixturesReady =
  existsSync(resolve(FIXTURE_DIR, 'one-page.docx')) &&
  existsSync(resolve(FIXTURE_DIR, 'three-page.docx'));
const integrationReady =
  fixturesReady && fishAvailable && !!Bun.which('soffice') && !!Bun.which('pdfinfo');

describe.skipIf(!integrationReady)('pageCount (integration)', () => {
  test('reports 1 for a one-page docx', async () => {
    expect(await pageCount(resolve(FIXTURE_DIR, 'one-page.docx'))).toBe(1 as PageCount);
  });

  test('reports 3 for a three-page docx', async () => {
    expect(await pageCount(resolve(FIXTURE_DIR, 'three-page.docx'))).toBe(3 as PageCount);
  });

  test('throws on missing file', async () => {
    await expect(pageCount('/tmp/does-not-exist-xyz.docx')).rejects.toThrow();
  });
});
