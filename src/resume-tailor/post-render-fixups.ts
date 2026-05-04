import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NAVY = '153D63';

const TAGLINE_PSTYLE = '<w:pStyle w:val="Tagline" />';
const CONTACT_PSTYLE = '<w:pStyle w:val="Contact" />';
const HEADING3_PSTYLE = '<w:pStyle w:val="Heading3" />';
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

/**
 * Strip pandoc-generated heading bookmarks. Pandoc emits a `<w:bookmarkStart>`
 * + `<w:bookmarkEnd>` pair for every heading to support TOC/cross-ref. The
 * resume has neither, so the bookmarks are pure noise (and visible in some
 * Word readers as gray brackets).
 */
function stripBookmarks(xml: string): string {
  return xml.replace(BOOKMARK_TAG_RE, '');
}

/**
 * Force `<w:jc w:val="center"/>` on Tagline + Contact paragraphs. Pandoc
 * emits these paragraphs with only `<w:pStyle .../>` in pPr, expecting the
 * style to provide alignment. Word's renderer doesn't apply that inherited
 * alignment reliably on paragraphs that contain `<w:br/>` line breaks
 * (specifically the merged tagline+contact). Setting jc directly works
 * around that across Word/Pages/LibreOffice.
 */
function forceCenterOnHeader(xml: string): string {
  return xml
    .replaceAll(`${TAGLINE_PSTYLE}</w:pPr>`, `${TAGLINE_PSTYLE}${JC_CENTER}</w:pPr>`)
    .replaceAll(`${CONTACT_PSTYLE}</w:pPr>`, `${CONTACT_PSTYLE}${JC_CENTER}</w:pPr>`);
}

/**
 * Color every Key Accomplishment label run navy. Pandoc emits the bold
 * `**Label**` runs with rPr `<w:b/><w:bCs/>` only — no color. The Tagline
 * paragraph style would normally cascade color, but Word doesn't reliably
 * cascade color from a paragraph style onto runs that already have their
 * own (bold-only) rPr. Adding the color directly to the rPr is the
 * cross-reader-stable fix.
 *
 * Side effect: every bold-only run in the doc gets navy color. KA labels
 * are the dominant case; other bold runs (Heading3 title) carry their
 * color via pStyle and have no run-level rPr, so they're unaffected.
 */
function colorBoldRuns(xml: string): string {
  return xml.replaceAll(BOLD_RPR, COLORED_BOLD_RPR);
}

/**
 * Inject `<w:rPr><w:color w:val="153D63"/></w:rPr>` into every text/break
 * run inside the Tagline paragraph (tagline + contact, joined by
 * `<w:br/>`). Pandoc emits the runs without rPr, expecting Word to inherit
 * color from the Tagline paragraph style. Word's renderer doesn't apply
 * that inherited color consistently across clients.
 */
function forceTaglineColor(xml: string): string {
  return xml.replaceAll(TAGLINE_PARAGRAPH_RE, (paragraph) =>
    paragraph.replaceAll(TAGLINE_RUN_PREFIX_RE, `<w:r>${COLOR_RPR_BLOCK}$1`),
  );
}

/**
 * Force `<w:pageBreakBefore/>` on the Babylon Heading3.
 *
 * Word's keep-with-next on Heading3 + RoleMeta isn't reliably honored when
 * the available space is tight enough for the heading + meta line to
 * barely fit while the first bullet wraps. Hard-pinning the break keeps
 * the section visually intact.
 *
 * Hardcoded to the role-title text "Director of Front-End Platforms". If
 * the role is ever retitled in canonical, this no-ops silently and the
 * Babylon section may end up squeezed onto page 1 again — the failure
 * mode is visually obvious.
 */
function forceBabylonPageBreak(xml: string): string {
  return xml.replace(
    BABYLON_HEADING3_RE,
    (_, pPrOpen, pStyle, after) => `${pPrOpen}${pStyle}<w:pageBreakBefore/>${after}`,
  );
}

const PIPELINE: Array<(xml: string) => string> = [
  stripBookmarks,
  forceCenterOnHeader,
  colorBoldRuns,
  forceTaglineColor,
  forceBabylonPageBreak,
];

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
  try {
    await spawnOrThrow(['unzip', '-q', docxPath, '-d', workdir]);
    const docPath = join(workdir, 'word', 'document.xml');
    const original = readFileSync(docPath, 'utf8');
    const fixed = PIPELINE.reduce((xml, step) => step(xml), original);
    writeFileSync(docPath, fixed);
    await spawnOrThrow(['zip', '-qr', '-X', docxPath, '.', '-x', '.*'], workdir);
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
