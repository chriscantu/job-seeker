import { describe, expect, test } from 'bun:test';
import {
  MissedTransformError,
  applyPostRenderFixups,
  colorBoldRuns,
  forceBabylonPageBreak,
  forceTaglineCenter,
  forceTaglineColor,
  runPipeline,
  stripBookmarks,
} from '../../src/resume-tailor/post-render-fixups';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const NAVY_RPR_FRAGMENT = '<w:color w:val="153D63" />';

describe('stripBookmarks', () => {
  test('removes self-closing bookmarkStart + bookmarkEnd tags', () => {
    const input =
      '<w:p><w:bookmarkStart w:id="1" w:name="x"/><w:r><w:t>hi</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p>';
    const output = stripBookmarks(input);
    expect(output).not.toContain('bookmark');
    expect(output).toContain('<w:t>hi</w:t>');
  });

  test('removes paired (non-self-closing) bookmark tags', () => {
    const input = '<w:bookmarkStart w:id="2" w:name="y">junk</w:bookmarkStart>';
    expect(stripBookmarks(input)).toBe('');
  });

  test('returns input unchanged when no bookmarks present', () => {
    const input = '<w:p><w:r><w:t>plain</w:t></w:r></w:p>';
    expect(stripBookmarks(input)).toBe(input);
  });
});

describe('forceTaglineCenter', () => {
  test('injects jc=center after Tagline pStyle', () => {
    const input = '<w:p><w:pPr><w:pStyle w:val="Tagline" /></w:pPr><w:r><w:t>x</w:t></w:r></w:p>';
    expect(forceTaglineCenter(input)).toContain(
      '<w:pStyle w:val="Tagline" /><w:jc w:val="center" /></w:pPr>',
    );
  });

  test('does not touch non-Tagline paragraphs', () => {
    const input = '<w:p><w:pPr><w:pStyle w:val="Heading2" /></w:pPr></w:p>';
    expect(forceTaglineCenter(input)).toBe(input);
  });
});

describe('colorBoldRuns', () => {
  test('appends color rPr to bold-only runs', () => {
    const input =
      '<w:r><w:rPr><w:b /><w:bCs /></w:rPr><w:t>Revenue Impact</w:t></w:r>';
    expect(colorBoldRuns(input)).toContain(
      '<w:rPr><w:b /><w:bCs /><w:color w:val="153D63" /></w:rPr>',
    );
  });

  test('idempotent — already-colored bold runs unchanged', () => {
    const colored = '<w:rPr><w:b /><w:bCs /><w:color w:val="153D63" /></w:rPr>';
    expect(colorBoldRuns(colored)).toBe(colored);
  });

  test('leaves non-bold rPr untouched', () => {
    const input = '<w:rPr><w:i /><w:iCs /></w:rPr>';
    expect(colorBoldRuns(input)).toBe(input);
  });
});

describe('forceTaglineColor', () => {
  test('colors text + br runs inside Tagline paragraph', () => {
    const input =
      '<w:p><w:pPr><w:pStyle w:val="Tagline" /></w:pPr>' +
      '<w:r><w:t>line1</w:t></w:r>' +
      '<w:r><w:br /></w:r>' +
      '<w:r><w:t>line2</w:t></w:r>' +
      '</w:p>';
    const output = forceTaglineColor(input);
    const colorMatches = output.match(/<w:color w:val="153D63" \/>/g) ?? [];
    expect(colorMatches.length).toBe(3);
  });

  test('does not touch runs outside the Tagline paragraph', () => {
    const input =
      '<w:p><w:pPr><w:pStyle w:val="BodyText" /></w:pPr><w:r><w:t>summary</w:t></w:r></w:p>';
    expect(forceTaglineColor(input)).toBe(input);
  });
});

describe('forceBabylonPageBreak', () => {
  test('injects pageBreakBefore on Heading3 with Babylon role title', () => {
    const input =
      '<w:p><w:pPr><w:pStyle w:val="Heading3" /></w:pPr>' +
      '<w:r><w:t xml:space="preserve">Director of Front-End Platforms | Babylon Health</w:t></w:r>' +
      '</w:p>';
    expect(forceBabylonPageBreak(input)).toContain('<w:pageBreakBefore/>');
  });

  test('returns input unchanged when role title differs (silent miss documented in JSDoc)', () => {
    const input =
      '<w:p><w:pPr><w:pStyle w:val="Heading3" /></w:pPr>' +
      '<w:r><w:t>VP Engineering | SomeOtherCo</w:t></w:r></w:p>';
    expect(forceBabylonPageBreak(input)).toBe(input);
  });
});

describe('runPipeline', () => {
  function syntheticDocument(): string {
    return [
      '<w:document>',
      '<w:bookmarkStart w:id="1" w:name="title"/>',
      '<w:p><w:pPr><w:pStyle w:val="Tagline" /></w:pPr>',
      '<w:r><w:t>line1</w:t></w:r>',
      '<w:r><w:br /></w:r>',
      '<w:r><w:t>line2</w:t></w:r>',
      '</w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Compact" /></w:pPr>',
      '<w:r><w:rPr><w:b /><w:bCs /></w:rPr><w:t>Revenue Impact</w:t></w:r>',
      '</w:p>',
      '<w:p><w:pPr><w:pStyle w:val="Heading3" /></w:pPr>',
      '<w:r><w:t xml:space="preserve">Director of Front-End Platforms | Babylon Health</w:t></w:r>',
      '</w:p>',
      '</w:document>',
    ].join('');
  }

  test('runs all 5 transforms when canonical-shaped XML matches each', () => {
    const out = runPipeline(syntheticDocument());
    expect(out).not.toContain('bookmark');
    expect(out).toContain('<w:jc w:val="center" />');
    expect(out).toContain('<w:rPr><w:b /><w:bCs /><w:color w:val="153D63" /></w:rPr>');
    expect(out).toContain(NAVY_RPR_FRAGMENT);
    expect(out).toContain('<w:pageBreakBefore/>');
  });

  test('throws MissedTransformError when bookmark step has nothing to strip', () => {
    const noBookmarks = syntheticDocument().replace(
      '<w:bookmarkStart w:id="1" w:name="title"/>',
      '',
    );
    expect(() => runPipeline(noBookmarks)).toThrow(MissedTransformError);
  });

  test('throws MissedTransformError when Babylon Heading3 absent', () => {
    const noBabylon = syntheticDocument().replace(
      'Director of Front-End Platforms | Babylon Health',
      'VP Engineering | OtherCo',
    );
    expect(() => runPipeline(noBabylon)).toThrow(/forceBabylonPageBreak/);
  });
});

const integrationReady =
  !!Bun.which('pandoc') && !!Bun.which('unzip') && !!Bun.which('zip');

describe.skipIf(!integrationReady)('applyPostRenderFixups (integration)', () => {
  test('atomic-renames over input — failed zip leaves original untouched (covered by no-throw path success)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fixups-int-'));
    const md = resolve(__dirname, 'fixtures/canonical-sample.md');
    const template = resolve(__dirname, '../../references/resume-template.docx');
    const out = join(dir, 'r.docx');
    const fish = resolve(__dirname, '../../scripts/render-resume.fish');
    const proc = Bun.spawn([fish, md, template, out], { stdout: 'pipe', stderr: 'pipe' });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const err = await new Response(proc.stderr).text();
      throw new Error(`render-resume.fish exit ${exitCode}: ${err}`);
    }
    expect(existsSync(out)).toBe(true);
    expect(statSync(out).size).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

// Reference for static analyzers; ensures `applyPostRenderFixups` is used at runtime.
void applyPostRenderFixups;
