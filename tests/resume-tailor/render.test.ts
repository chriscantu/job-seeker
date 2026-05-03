import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { renderResume } from '../../src/resume-tailor/render';
import { resolve, join } from 'node:path';
import { existsSync, writeFileSync, chmodSync, rmSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';

const fishAvailable = !!Bun.which('fish');
const pandocAvailable = !!Bun.which('pandoc');

describe.skipIf(!fishAvailable)('renderResume (unit, stub fish)', () => {
  let stubDir: string;

  beforeAll(() => { stubDir = mkdtempSync(join(tmpdir(), 'render-stubs-')); });
  afterAll(() => { rmSync(stubDir, { recursive: true, force: true }); });

  function makeStub(name: string, body: string): string {
    const path = join(stubDir, name);
    writeFileSync(path, `#!/usr/bin/env fish\n${body}\n`);
    chmodSync(path, 0o755);
    return path;
  }

  test('throws on pandoc non-zero exit, surfaces stderr', async () => {
    const stub = makeStub('exit-2.fish', 'echo "pandoc: parse error" >&2; exit 2');
    await expect(
      renderResume({ markdownPath: 'm', templatePath: 't', outputPath: 'o' }, stub),
    ).rejects.toThrow(/exit 2.*parse error/);
  });

  test('throws on missing pandoc binary (exit 4)', async () => {
    const stub = makeStub('exit-4.fish', 'echo "pandoc not found" >&2; exit 4');
    await expect(
      renderResume({ markdownPath: 'm', templatePath: 't', outputPath: 'o' }, stub),
    ).rejects.toThrow(/exit 4.*pandoc not found/);
  });

  test('throws when output file not produced (exit 3)', async () => {
    const stub = makeStub('exit-3.fish', 'echo "pandoc produced no output" >&2; exit 3');
    await expect(
      renderResume({ markdownPath: 'm', templatePath: 't', outputPath: 'o' }, stub),
    ).rejects.toThrow(/exit 3/);
  });

  test('resolves on exit 0', async () => {
    const stub = makeStub('ok.fish', 'exit 0');
    await expect(
      renderResume({ markdownPath: 'm', templatePath: 't', outputPath: 'o' }, stub),
    ).resolves.toBeUndefined();
  });
});

const FIXTURE_TEMPLATE = resolve(__dirname, '../../references/resume-template.docx');
const FIXTURE_MD = resolve(__dirname, 'fixtures/canonical-sample.md');
const integrationReady = fishAvailable && pandocAvailable && existsSync(FIXTURE_TEMPLATE) && existsSync(FIXTURE_MD);

describe.skipIf(!integrationReady)('renderResume (integration, real pandoc)', () => {
  test('renders canonical fixture into a non-empty docx', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'render-int-'));
    const out = join(dir, 'out.docx');
    await renderResume({
      markdownPath: FIXTURE_MD,
      templatePath: FIXTURE_TEMPLATE,
      outputPath: out,
    });
    const stat = statSync(out);
    expect(stat.size).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
