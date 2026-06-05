#!/usr/bin/env bun
/**
 * Generate a formatted .docx cover letter from a markdown source.
 *
 * Usage:
 *   bun scripts/generate_coverletter_docx.ts <input.md> <output.docx>
 *
 * Supported markdown in the body (after frontmatter):
 *   - `# Name`                     → letterhead (large, bold, dark blue)
 *   - contact line with `|` + `@`  → gray contact line under the name
 *   - `---`                        → horizontal rule
 *   - `RE: ...` line               → bolded (rendered with line breaks in its block)
 *   - `**bold**` inline            → bold run (use sparingly to emphasize a metric)
 *   - blank-line-separated blocks  → body paragraphs
 *   - last block                   → signature (rendered with line breaks)
 */

import * as fs from 'fs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { COLORS, FONT, PAGE, rule } from './docx-styles';
import { parseFrontmatter } from './lib/frontmatter';
import { errorMessage } from './lib/util';

// ── CLI ──────────────────────────────────────────────────────────────────────
const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: bun scripts/generate_coverletter_docx.ts <input.md> <output.docx>");
  process.exit(1);
}
const raw = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;

// ── Sizes (docx half-points: 22 = 11pt) ───────────────────────────────────────
const BODY_SIZE = 22;     // 11pt body
const NAME_SIZE = 36;     // 18pt letterhead name
const CONTACT_SIZE = 19;  // ~9.5pt contact line

// ── Inline `**bold**` → TextRun[] ──────────────────────────────────────────────
interface RunBase { size: number; color: string; bold?: boolean }
function inlineRuns(text: string, base: RunBase): TextRun[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(s => s.length > 0);
  if (segments.length === 0) return [new TextRun({ text: "", size: base.size, font: FONT, color: base.color })];
  return segments.map(seg => {
    const m = seg.match(/^\*\*([^*]+)\*\*$/);
    return new TextRun({
      text: m ? m[1] : seg,
      bold: m ? true : !!base.bold,
      size: base.size,
      font: FONT,
      color: base.color,
    });
  });
}

// ── Parse into blank-line-separated blocks ─────────────────────────────────────
const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);

if (blocks.length < 3) {
  console.error("Cover letter must have at least a header, one body paragraph, and a signature.");
  process.exit(1);
}

// ── Build document ─────────────────────────────────────────────────────────────
const children: Paragraph[] = [];
let nameRendered = false;
let contactRendered = false;

blocks.forEach((block, idx) => {
  const isLast = idx === blocks.length - 1;

  // Horizontal rule
  if (/^-{3,}$/.test(block)) {
    children.push(rule(COLORS.midBlue));
    return;
  }

  // Letterhead name (`# Name`)
  if (block.startsWith('# ')) {
    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({
        text: block.replace(/^#\s+/, ''),
        bold: true, size: NAME_SIZE, color: COLORS.darkBlue, font: FONT,
      })],
    }));
    nameRendered = true;
    return;
  }

  // Contact line (first `|`-delimited line with an email/linkedin)
  if (nameRendered && !contactRendered && block.includes('|') && /@|linkedin/i.test(block)) {
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: inlineRuns(block.replace(/\n/g, '   '), { size: CONTACT_SIZE, color: COLORS.gray }),
    }));
    contactRendered = true;
    return;
  }

  // Recipient/signature blocks keep their internal line breaks; body paragraphs
  // join wrapped lines into one flowing paragraph.
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const keepBreaks = isLast || lines.some(l => /^RE:/i.test(l));

  if (keepBreaks) {
    const runs: TextRun[] = [];
    lines.forEach((line, i) => {
      const isRE = /^RE:/i.test(line);
      runs.push(...inlineRuns(line, { size: BODY_SIZE, color: COLORS.black, bold: isRE }));
      if (i < lines.length - 1) runs.push(new TextRun({ break: 1 }));
    });
    children.push(new Paragraph({ spacing: { before: isLast ? 200 : 0, after: 200 }, children: runs }));
  } else {
    children.push(new Paragraph({
      spacing: { after: 200, line: 276 },  // 1.15x line spacing
      children: inlineRuns(lines.join(' '), { size: BODY_SIZE, color: COLORS.black }),
    }));
  }
});

const margin = PAGE.margin.coverLetter;

const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: PAGE.width, height: PAGE.height },
        margin: { top: margin, bottom: margin, left: margin, right: margin },
      },
    },
    children,
  }],
});

// ── Write ────────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log("DOCX written to:", outputPath);
}).catch(err => {
  const msg = errorMessage(err);
  console.error("Failed to generate DOCX:", msg);
  process.exit(1);
});
