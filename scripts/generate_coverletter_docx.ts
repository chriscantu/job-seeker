#!/usr/bin/env bun
/**
 * Generate a formatted .docx cover letter from a markdown source.
 *
 * Usage:
 *   bun scripts/generate_coverletter_docx.ts <input.md> <output.docx>
 *
 * The markdown format is simple:
 *   - First line starting with "Dear" is the salutation
 *   - Body paragraphs separated by blank lines
 *   - Last non-empty line is the signature (candidate name)
 */

import * as fs from 'fs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { COLORS, FONT, PAGE } from './docx-styles';
import { parseFrontmatter } from './lib/frontmatter';
import { errorMessage } from './lib/util';

// ── CLI ──────────────────────────────────────────────────────────────────────
const [,, inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: bun scripts/generate_coverletter_docx.ts <input.md> <output.docx>");
  process.exit(1);
}
const raw = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;

// ── Parse ────────────────────────────────────────────────────────────────────
// Split into blocks on blank lines, trim each, discard empties.
const blocks = raw
  .split(/\n\s*\n/)
  .map(b => b.trim())
  .filter(Boolean);

if (blocks.length < 3) {
  console.error("Cover letter must have at least a salutation, one body paragraph, and a signature.");
  process.exit(1);
}

// First block = salutation ("Dear ...")
const salutation = blocks[0];

// Last block = signature (candidate name, possibly with closing like "Best,")
const signatureBlock = blocks[blocks.length - 1];
const signatureLines = signatureBlock.split("\n").map(l => l.trim()).filter(Boolean);

// Everything in between = body paragraphs
const bodyBlocks = blocks.slice(1, blocks.length - 1);

// ── Font helpers ─────────────────────────────────────────────────────────────
const bodyFont = { size: 22, font: FONT, color: COLORS.black };  // 11pt

function bodyParagraph(text: string, spacingAfter = 200): Paragraph {
  return new Paragraph({
    spacing: { after: spacingAfter, line: 276 },  // 1.15x line spacing
    children: [new TextRun({ text, ...bodyFont })],
  });
}

// ── Build document ───────────────────────────────────────────────────────────
const children: Paragraph[] = [];

// Salutation
children.push(new Paragraph({
  spacing: { after: 200 },
  children: [new TextRun({ text: salutation, ...bodyFont })],
}));

// Body paragraphs
for (const block of bodyBlocks) {
  // Join any line breaks within a block into a single paragraph
  const text = block.replace(/\n/g, " ");
  children.push(bodyParagraph(text));
}

// Signature block — closing line + name on separate lines
children.push(new Paragraph({
  spacing: { before: 200, after: 0 },
  children: signatureLines.map((line, i) => {
    const runs: TextRun[] = [new TextRun({ text: line, ...bodyFont })];
    if (i < signatureLines.length - 1) {
      runs.push(new TextRun({ break: 1 }));
    }
    return runs;
  }).flat(),
}));

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
