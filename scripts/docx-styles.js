/**
 * Shared DOCX styling constants and helper factories for resume and cover letter generation.
 *
 * Usage:
 *   const styles = require('./docx-styles');
 *
 * All dimension values are in DXA (1440 DXA = 1 inch).
 *
 * BULLET ALIGNMENT — IMPORTANT:
 *   Always use left: 720, hanging: 360 for top-level bullets.
 *   This puts the bullet glyph at 360 DXA (¼") and starts the text at
 *   720 DXA (½"). Wrapped lines align at 720 DXA, matching the first line.
 *   Do NOT use smaller values (e.g. left: 480, hanging: 240) — they cause
 *   wrapped text to visually misalign with the line above.
 */

const {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
} = require('docx');

// ── Palette (matched to canonical resume.pdf) ───────────────────────────────
const COLORS = {
  darkBlue:  "1F4E79",   // name, section headings, card accent borders
  midBlue:   "2E75B6",   // job titles, Core Expertise label, tagline
  lightBg:   "D6E4F0",   // accomplishment card background
  cellBorder:"C5D8EC",   // thin card borders (unused — cards use accent-only)
  black:     "333333",   // body text
  gray:      "555555",   // metadata, contact line
  footerGray:"666666",
  // Legacy aliases (match old names for backward compat)
  blue:      "1F4E79",
  lightBlue: "D6E4F0",
  darkGray:  "333333",
  midGray:   "555555",
};

// Font — Calibri matches the canonical resume.pdf
const FONT = "Calibri";

// ── Page geometry ─────────────────────────────────────────────────────────────
const PAGE = {
  width:  12240, // US Letter width in DXA
  height: 15840, // US Letter height in DXA
  margin: {
    resume:      1080, // 0.75" — resumes use tighter margins
    coverLetter: 1440, // 1.00" — cover letters use standard margins
  },
};

// Content widths (page width minus both margins)
const CONTENT_WIDTH = {
  resume:      PAGE.width - PAGE.margin.resume * 2,      // 10080
  coverLetter: PAGE.width - PAGE.margin.coverLetter * 2, // 9360
};

// ── Numbering config ──────────────────────────────────────────────────────────
/**
 * Returns a numbering config array for use in new Document({ numbering: { config } }).
 * Includes two levels:
 *   level 0 — standard bullet   (•)  left: 720, hanging: 360
 *   level 1 — sub-bullet        (◦)  left: 1080, hanging: 360
 */
const NUMBERING_CONFIG = [
  {
    reference: "bullets",
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            // CRITICAL: left: 720, hanging: 360 ensures wrapped lines
            // align with the start of the text on line 1, not the bullet.
            indent: { left: 720, hanging: 360 },
          },
        },
      },
      {
        level: 1,
        format: LevelFormat.BULLET,
        text: "\u25E6",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: { left: 1080, hanging: 360 },
          },
        },
      },
    ],
  },
];

// ── Paragraph helpers ─────────────────────────────────────────────────────────

function rule(color = COLORS.blue) {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 1 } },
    spacing: { before: 60, after: 60 },
    children: [],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 180, after: 60 },
    children: [new TextRun({
      text,
      bold: true,
      size: 24,
      color: COLORS.blue,
      font: FONT,
      allCaps: true,
    })],
  });
}

function jobTitle(title, company) {
  return new Paragraph({
    spacing: { before: 160, after: 0 },
    children: [
      new TextRun({ text: title + " | ", bold: true, size: 22, color: COLORS.blue,     font: FONT }),
      new TextRun({ text: company,        bold: true, size: 22, color: COLORS.darkGray, font: FONT }),
    ],
  });
}

function jobMeta(text) {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, italics: true, size: 19, color: COLORS.midGray, font: FONT })],
  });
}

function labelParagraph(label, body) {
  return new Paragraph({
    spacing: { before: 60, after: 30 },
    children: [
      new TextRun({ text: label + " ", bold: true, size: 20, font: FONT, color: COLORS.darkGray }),
      new TextRun({ text: body,                     size: 20, font: FONT, color: COLORS.darkGray }),
    ],
  });
}

/**
 * Creates a bulleted paragraph.
 * @param {Array<{text: string, bold?: boolean}>} parts
 * @param {number} level - 0 for top-level, 1 for sub-bullet
 */
function bullet(parts, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 30, after: 30 },
    children: parts.map(p => new TextRun({
      text: p.text,
      bold: !!p.bold,
      size: 20,
      font: FONT,
      color: COLORS.darkGray,
    })),
  });
}

function subLabel(text) {
  return new Paragraph({
    spacing: { before: 80, after: 30 },
    children: [new TextRun({
      text, bold: true, italics: true, size: 20, font: FONT, color: COLORS.midGray,
    })],
  });
}

function resultsLabel() {
  return new Paragraph({
    spacing: { before: 60, after: 20 },
    children: [new TextRun({ text: "Results:", bold: true, size: 20, font: FONT, color: COLORS.darkGray })],
  });
}

// ── Accomplishments table helpers ─────────────────────────────────────────────

function accomplishmentCell(label, body, cellWidth) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.cellBorder };
  const borders = { top: border, bottom: border, left: border, right: border };
  return new TableCell({
    borders,
    width: { size: cellWidth, type: WidthType.DXA },
    shading: { fill: COLORS.lightBlue, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 20 },
        children: [new TextRun({ text: label, bold: true, size: 19, font: FONT, color: COLORS.blue })],
      }),
      new Paragraph({
        children: [new TextRun({ text: body, size: 18, font: FONT, color: COLORS.darkGray })],
      }),
    ],
  });
}

/**
 * Builds the 2-column accomplishments table.
 * @param {Array<[string, string, string, string]>} rows — each entry: [leftLabel, leftBody, rightLabel, rightBody]
 * @param {number} contentWidth — total content width in DXA
 */
function accomplishmentsTable(rows, contentWidth) {
  const half = Math.floor(contentWidth / 2);
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [half, half],
    rows: rows.map(([ll, lb, rl, rb]) =>
      new TableRow({
        children: [
          accomplishmentCell(ll, lb, half),
          accomplishmentCell(rl, rb, half),
        ],
      })
    ),
  });
}

module.exports = {
  COLORS,
  FONT,
  PAGE,
  CONTENT_WIDTH,
  NUMBERING_CONFIG,
  rule,
  sectionHeading,
  jobTitle,
  jobMeta,
  labelParagraph,
  bullet,
  subLabel,
  resultsLabel,
  accomplishmentsTable,
};
