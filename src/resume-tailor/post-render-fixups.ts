/**
 * Post-render fixups for the rendered docx — applied after pandoc.
 *
 * Pandoc's reference-doc rendering is tolerant of custom paragraph styles
 * but inconsistently applies inherited run-level properties (color, jc)
 * when the run has no explicit rPr. Different Word readers (Word, Pages,
 * LibreOffice) cascade those properties differently. To get a stable
 * cross-reader result, this module rewrites the rendered word/document.xml
 * directly: it strips pandoc-emitted heading bookmarks, forces explicit
 * jc/color on header paragraphs, colors KA-label bold runs, and pins a
 * page break before the Babylon role.
 *
 * Each transform asserts it changed the XML so a pandoc-output-shape drift
 * (different whitespace, attribute order, namespace prefix) surfaces as a
 * loud `MissedTransformError` rather than a silent no-op.
 *
 * The orchestrator extracts the docx, rewrites document.xml, and repacks
 * to a temp path before atomically renaming over the input — a failed
 * `zip` cannot leave the caller with a corrupt docx.
 */
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NAVY = '153D63';

const TAGLINE_PSTYLE = '<w:pStyle w:val="Tagline" />';
const BOLD_RPR = '<w:rPr><w:b /><w:bCs /></w:rPr>';
const COLORED_BOLD_RPR = `<w:rPr><w:b /><w:bCs /><w:color w:val="${NAVY}" /></w:rPr>`;
const JC_CENTER = '<w:jc w:val="center" />';
const COLOR_RPR_BLOCK = `<w:rPr><w:color w:val="${NAVY}" /></w:rPr>`;

const BABYLON_HEADING3_RE =
  /(<w:pPr>)(<w:pStyle w:val="Heading3" \/>)(<\/w:pPr><w:r[^>]*><w:t[^>]*>Director of Front-End Platforms)/;

const TAGLINE_PARAGRAPH_RE =
  /<w:p\b[^>]*><w:pPr><w:pStyle w:val="Tagline" \/>(?:[^<]|<(?!w:p\b))*?<\/w:p>/gs;

const TAGLINE_RUN_PREFIX_RE = /<w:r>(<w:(?:t|br)\b)/g;

const BOOKMARK_TAG_RE =
  /<w:bookmark(?:Start|End)\b[^/]*\/>|<w:bookmark(?:Start|End)\b[^>]*>[^<]*<\/w:bookmark(?:Start|End)>/g;

export class MissedTransformError extends Error {
  constructor(name: string) {
    super(
      `post-render-fixup '${name}' matched zero — pandoc output may have drifted (whitespace, attribute order, namespace)`,
    );
    this.name = 'MissedTransformError';
  }
}

/**
 * Pandoc auto-emits `<w:bookmarkStart>` + `<w:bookmarkEnd>` per heading;
 * some Word readers render them as gray brackets. The resume has no TOC
 * or cross-refs so the bookmarks are pure visual noise.
 */
export function stripBookmarks(xml: string): string {
  return xml.replace(BOOKMARK_TAG_RE, '');
}

/**
 * Pandoc emits the merged tagline+contact paragraph with only `<w:pStyle/>`
 * in pPr, expecting the style to provide center alignment. Word's renderer
 * doesn't apply that inherited alignment reliably when the paragraph
 * contains `<w:br/>` line breaks — the result is left-justified across
 * Pages and some Word builds. Setting jc directly works around it.
 */
export function forceTaglineCenter(xml: string): string {
  return xml.replaceAll(`${TAGLINE_PSTYLE}</w:pPr>`, `${TAGLINE_PSTYLE}${JC_CENTER}</w:pPr>`);
}

/**
 * Word doesn't cascade paragraph-style color onto runs that already carry
 * their own (bold-only) rPr — KA labels then ship as default-black across
 * Word/Pages despite the Tagline parent style being navy. Adding the color
 * directly to the run rPr gets a stable result.
 *
 * Side effect: every bold-only run in the doc gets navy. KA labels are
 * the dominant case today — Heading3 (role title) is bold but inherits
 * color via pStyle without run-level rPr, so it's unaffected. If a future
 * bullet introduces inline `**bold phrase**` mid-sentence, that run will
 * also turn navy; re-scope to KA-paragraph-bounded runs if that becomes
 * a problem.
 */
export function colorBoldRuns(xml: string): string {
  return xml.replaceAll(BOLD_RPR, COLORED_BOLD_RPR);
}

/**
 * Inject color rPr on every text/break run inside the Tagline paragraph.
 * Same cross-reader inheritance bug as forceTaglineCenter — runs without
 * their own rPr ship as default-black instead of inheriting Tagline navy.
 */
export function forceTaglineColor(xml: string): string {
  return xml.replaceAll(TAGLINE_PARAGRAPH_RE, (paragraph) =>
    paragraph.replaceAll(TAGLINE_RUN_PREFIX_RE, `<w:r>${COLOR_RPR_BLOCK}$1`),
  );
}

/**
 * Pin a page break before the Babylon Heading3.
 *
 * Keep-with-next on Heading3 + RoleMeta isn't reliably honored when the
 * available space barely fits the heading + meta but wraps the first
 * bullet — the section reads as broken. Hardcoded to the role-title text
 * "Director of Front-End Platforms"; renaming the role in canonical
 * surfaces as a `MissedTransformError` rather than a silent layout
 * regression.
 */
export function forceBabylonPageBreak(xml: string): string {
  return xml.replace(
    BABYLON_HEADING3_RE,
    (_, pPrOpen, pStyle, after) => `${pPrOpen}${pStyle}<w:pageBreakBefore/>${after}`,
  );
}

type Transform = {
  readonly name: string;
  readonly apply: (xml: string) => string;
};

const PIPELINE: readonly Transform[] = [
  { name: 'stripBookmarks', apply: stripBookmarks },
  { name: 'forceTaglineCenter', apply: forceTaglineCenter },
  { name: 'colorBoldRuns', apply: colorBoldRuns },
  { name: 'forceTaglineColor', apply: forceTaglineColor },
  { name: 'forceBabylonPageBreak', apply: forceBabylonPageBreak },
];

export function runPipeline(xml: string): string {
  let current = xml;
  for (const step of PIPELINE) {
    const next = step.apply(current);
    if (next === current) {
      throw new MissedTransformError(step.name);
    }
    current = next;
  }
  return current;
}

async function spawnOrThrow(cmd: string[], cwd?: string): Promise<void> {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`${cmd[0]} failed (exit ${exitCode}): ${err.trim()}`);
  }
}

export async function applyPostRenderFixups(docxPath: string): Promise<void> {
  const workdir = mkdtempSync(join(tmpdir(), 'resume-fixups-'));
  const stagedDocx = join(workdir, 'fixed.docx');
  try {
    await spawnOrThrow(['unzip', '-q', docxPath, '-d', workdir]);
    const docPath = join(workdir, 'word', 'document.xml');
    if (!existsSync(docPath)) {
      throw new Error(`docx missing word/document.xml: ${docxPath}`);
    }
    writeFileSync(docPath, runPipeline(readFileSync(docPath, 'utf8')));
    await spawnOrThrow(
      ['zip', '-qr', '-X', stagedDocx, 'word', 'docProps', '_rels', '[Content_Types].xml'],
      workdir,
    );
    renameSync(stagedDocx, docxPath);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

if (import.meta.path === Bun.main) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: post-render-fixups.ts <docx-path>');
    process.exit(1);
  }
  await applyPostRenderFixups(target);
}
