#!/usr/bin/env node
/**
 * Generate a formatted .docx resume from the canonical markdown source.
 *
 * Usage:
 *   node scripts/generate_resume_docx.js <input.md> <output.docx>
 */

"use strict";

const fs   = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ExternalHyperlink,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
} = require("docx");

// ── Constants (DXA: 1440 = 1 inch) ──────────────────────────────────────────
const PAGE_W    = 12240;
const MARGIN_H  = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN_H;  // 10,080
const COL_HALF  = Math.floor(CONTENT_W / 2);

// Colors (hex without #) — matched to canonical resume.pdf
const DARK_BLUE = "1F4E79";
const MID_BLUE  = "2E75B6";
const LIGHT_BG  = "D6E4F0";
const CELL_BORDER = "C5D8EC";
const WHITE     = "FFFFFF";
const BLACK     = "333333";
const GRAY      = "555555";

// Font — Calibri matches the canonical resume.pdf
const FONT = "Calibri";

// ── Helpers ──────────────────────────────────────────────────────────────────

function clean(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g,     "$1")
    .replace(/_(.+?)_/g,       "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}

/** Convert **bold** and *italic* spans into TextRun arrays. */
function richRuns(text, base) {
  const runs = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    }
    if (m[0].startsWith("**")) {
      runs.push(new TextRun({ text: m[2], bold: true,    ...base }));
    } else {
      runs.push(new TextRun({ text: m[3], italics: true, ...base }));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), ...base }));
  }
  return runs.length ? runs : [new TextRun({ text, ...base })];
}

function hrPara(color, size) {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } },
    spacing: { after: 60 },
  });
}

function sectionHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK_BLUE, size: 24, font: FONT })],
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: MID_BLUE, space: 4 } },
  });
}

// CELL_BORDER_STYLE removed — accomplishment cards use LEFT-only accent
// border so table insideH/V white gaps render correctly.

// ── Markdown parser ───────────────────────────────────────────────────────────
function parseResume(md) {
  const lines = md.split("\n");

  while (lines.length && lines[lines.length - 1].trim().startsWith("*Tailored for")) {
    lines.pop();
  }

  const result = {
    name: "", tagline: "", contact: "",
    summary: "",
    accomplishments: [],
    experience: [],
    education: { degree: "", school: "", expertise: "" },
  };

  let i = 0;

  if (lines[i] && lines[i].startsWith("# ")) {
    result.name = lines[i].slice(2).trim();
    i++;
  }
  const tM = lines[i] && lines[i].trim().match(/^\*\*(.+)\*\*$/);
  if (tM) { result.tagline = tM[1]; i++; }
  if (lines[i] && (lines[i].includes("@") || lines[i].includes("|"))) {
    result.contact = lines[i].trim();
    i++;
  }

  const skipWS = () => {
    while (i < lines.length && (!lines[i].trim() || lines[i].trim() === "---")) i++;
  };
  skipWS();

  const summaryParts = [];
  while (i < lines.length && !lines[i].startsWith("#") && lines[i].trim() !== "---") {
    if (lines[i].trim()) summaryParts.push(lines[i].trim());
    i++;
  }
  result.summary = summaryParts.join(" ");
  skipWS();

  let section = null;
  let job = null;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.trim();

    if (stripped === "---") { i++; continue; }

    if (stripped.startsWith("## ")) {
      const nm = stripped.slice(3).toUpperCase();
      if (nm.includes("ACCOMPLISHMENT")) section = "accomplishments";
      else if (nm.includes("EXPERIENCE")) {
        if (job) result.experience.push(job);
        job = null;
        section = "experience";
      } else if (nm.includes("EDUCATION")) {
        if (job) { result.experience.push(job); job = null; }
        section = "education";
      }
      i++; continue;
    }

    if (stripped.startsWith("### ") && section === "experience") {
      if (job) result.experience.push(job);
      const parts = stripped.slice(4).split(" | ");
      job = { title: parts[0].trim(), company: parts[1] ? parts[1].trim() : "", meta: "", items: [] };
      i++;
      while (i < lines.length && !lines[i].trim()) i++;
      if (i < lines.length && lines[i].trim().startsWith("*")) {
        job.meta = clean(lines[i].trim().replace(/^\*/, "").replace(/\*$/, ""));
        i++;
      }
      continue;
    }

    if (section === "accomplishments" && stripped.startsWith("|")) {
      if (/^\|[-\s|]+\|$/.test(stripped)) { i++; continue; }
      const cells = stripped.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      if (cells.length >= 2 && (cells[0] || cells[1])) {
        result.accomplishments.push({ left: cells[0], right: cells[1] });
      }
      i++; continue;
    }

    if (section === "experience" && job) {
      if (!stripped) { i++; continue; }
      if (stripped.startsWith("- ")) {
        job.items.push({ type: "bullet", text: stripped.slice(2) });
      } else if (stripped.startsWith("**") || stripped.startsWith("*As")) {
        job.items.push({ type: "label", text: stripped });
      } else {
        job.items.push({ type: "para", text: stripped });
      }
      i++; continue;
    }

    if (section === "education") {
      if (!stripped || stripped === "---") { i++; continue; }
      // Check Core Expertise FIRST — its **bold** prefix would otherwise
      // match the degree regex and overwrite the real degree.
      if (stripped.includes("Core Expertise")) {
        result.education.expertise = clean(stripped.replace(/\*\*Core Expertise:\*\*\s*/, ""));
      } else {
        const dM = stripped.match(/^\*\*(.+?)\*\*/);
        if (dM) {
          result.education.degree = dM[1];
        } else if (!result.education.school) {
          result.education.school = clean(stripped);
        }
      }
    }

    i++;
  }
  if (job) result.experience.push(job);
  return result;
}

// ── Document builder ──────────────────────────────────────────────────────────
// Matched element-by-element to canonical resume.pdf.
function buildDoc(parsed) {
  const children = [];
  const bodyFont = { size: 20, font: FONT, color: BLACK };

  // ── Header block ──
  // PDF: Name centered, large, bold, dark blue
  children.push(new Paragraph({
    children: [new TextRun({ text: parsed.name, bold: true, color: DARK_BLUE, size: 44, font: FONT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
  }));
  // PDF: Tagline centered, italic, smaller, dark blue
  if (parsed.tagline) {
    children.push(new Paragraph({
      children: [new TextRun({ text: parsed.tagline, italics: true, color: DARK_BLUE, size: 22, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
    }));
  }
  // PDF: Contact centered, normal weight, body color. LinkedIn URL is clickable.
  if (parsed.contact) {
    const contactParts = parsed.contact.split(/\s*\|\s*/);
    const contactChildren = [];
    contactParts.forEach((part, idx) => {
      if (idx > 0) contactChildren.push(new TextRun({ text: " | ", ...bodyFont }));
      const trimmed = part.trim();
      if (trimmed.includes("linkedin.com")) {
        const url = trimmed.startsWith("http") ? trimmed : "https://" + trimmed;
        contactChildren.push(new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: trimmed, color: MID_BLUE, underline: {}, ...bodyFont })],
        }));
      } else {
        contactChildren.push(new TextRun({ text: trimmed, ...bodyFont }));
      }
    });
    children.push(new Paragraph({
      children: contactChildren,
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }));
  }

  // PDF: Thick blue horizontal rule separating header from summary
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: DARK_BLUE, space: 1 } },
    spacing: { after: 120 },
  }));

  // ── Summary ──
  // PDF: Body text paragraph, left-aligned, comfortable line spacing
  if (parsed.summary) {
    children.push(new Paragraph({
      children: richRuns(parsed.summary, bodyFont),
      spacing: { after: 60, line: 276 },
    }));
    // PDF: Thin blue rule between summary and accomplishments
    children.push(hrPara(MID_BLUE, 4));
  }

  // ── Key Accomplishments ──
  // PDF: Section heading — uppercase, bold, dark blue, blue underline
  children.push(sectionHeading("KEY ACCOMPLISHMENTS"));

  // Accomplishment cards — each ROW is its own table so paragraph spacing
  // between tables creates guaranteed visible whitespace. A narrow empty
  // middle column creates the column gap. Each content cell has a thick
  // left navy accent border and light blue background.
  const NONE_BORDER = { style: BorderStyle.NONE, size: 0 };
  const NO_BORDERS = { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER };
  const GAP_W = 160; // white gap between columns (DXA)
  const CARD_W = Math.floor((CONTENT_W - GAP_W) / 2);

  const makeAccomCell = (text) => {
    const m = text.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.*)/);
    const cellChildren = [];
    if (m) {
      cellChildren.push(new Paragraph({
        children: [new TextRun({ text: m[1], bold: true, size: 20, font: FONT, color: DARK_BLUE })],
        spacing: { after: 30 },
      }));
      cellChildren.push(new Paragraph({
        children: [new TextRun({ text: m[2], size: 19, font: FONT, color: BLACK })],
        spacing: { after: 0, line: 260 },
      }));
    } else {
      cellChildren.push(new Paragraph({
        children: [new TextRun({ text: clean(text), size: 19, font: FONT, color: BLACK })],
      }));
    }
    return new TableCell({
      children: cellChildren,
      width: { size: CARD_W, type: WidthType.DXA },
      shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 160, right: 120 },
      borders: {
        left:   { style: BorderStyle.SINGLE, size: 12, color: DARK_BLUE },
        top:    NONE_BORDER,
        bottom: NONE_BORDER,
        right:  NONE_BORDER,
      },
    });
  };

  // Empty spacer cell between the two cards in each row
  const spacerCell = () => new TableCell({
    children: [new Paragraph({ children: [] })],
    width: { size: GAP_W, type: WidthType.DXA },
    borders: NO_BORDERS,
  });

  const accomData = parsed.accomplishments.filter(r => r.left || r.right);
  accomData.forEach((r, idx) => {
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CARD_W, GAP_W, CARD_W],
      rows: [new TableRow({
        children: [makeAccomCell(r.left), spacerCell(), makeAccomCell(r.right)],
      })],
      borders: NO_BORDERS,
    }));
    // White gap between rows (skip after last row)
    if (idx < accomData.length - 1) {
      children.push(new Paragraph({ spacing: { before: 0, after: 80 } }));
    }
  });

  // PDF: Thin blue rule between accomplishments and experience
  children.push(hrPara(MID_BLUE, 4));

  // ── Professional Experience ──
  children.push(sectionHeading("PROFESSIONAL EXPERIENCE"));

  for (const job of parsed.experience) {
    // PDF: "Director of Engineering | Procore Technologies"
    //   Title part in blue bold, pipe in blue, company in dark gray bold
    const titleRuns = job.company
      ? [
          new TextRun({ text: job.title + " | ", bold: true, color: MID_BLUE, size: 22, font: FONT }),
          new TextRun({ text: job.company,        bold: true, color: BLACK,    size: 22, font: FONT }),
        ]
      : [new TextRun({ text: job.title, bold: true, color: MID_BLUE, size: 22, font: FONT })];
    children.push(new Paragraph({
      children: titleRuns,
      spacing: { before: 160, after: 20 },
      keepNext: true,
      keepLines: true,
    }));

    // PDF: Italic metadata line in gray
    if (job.meta) {
      children.push(new Paragraph({
        children: [new TextRun({ text: job.meta, italics: true, size: 19, font: FONT, color: GRAY })],
        spacing: { after: 60 },
        keepNext: true,
      }));
    }

    // PDF: Challenge/Action/Results paragraphs then bullets
    for (const item of job.items) {
      if (item.type === "bullet") {
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 50, line: 276 },
        }));
      } else if (item.type === "label") {
        // Sub-labels: "As Director of Engineering (July 2020 – February 2021):"
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          spacing: { before: 80, after: 40, line: 276 },
        }));
      } else {
        // Challenge:/Action:/Results: paragraphs
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          spacing: { after: 50, line: 276 },
        }));
      }
    }
  }

  // ── Education & Expertise ──
  children.push(sectionHeading("EDUCATION & EXPERTISE"));
  const edu = parsed.education;
  if (edu.degree) {
    children.push(new Paragraph({
      children: [new TextRun({ text: edu.degree, bold: true, ...bodyFont })],
      spacing: { after: 30 },
    }));
  }
  if (edu.school) {
    children.push(new Paragraph({
      children: [new TextRun({ text: edu.school, ...bodyFont })],
      spacing: { after: 60 },
    }));
  }
  if (edu.expertise) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Core Expertise: ", bold: true, color: MID_BLUE, size: 20, font: FONT }),
        new TextRun({ text: edu.expertise, ...bodyFont }),
      ],
      spacing: { after: 60, line: 276 },
    }));
  }

  return new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: FONT, size: 20, color: BLACK } },
      },
    },
    sections: [{
      properties: {
        page: {
          size:   { width: PAGE_W, height: 15840 },
          margin: { top: 936, right: MARGIN_H, bottom: 936, left: MARGIN_H },
        },
      },
      children,
    }],
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    process.stderr.write("Usage: node generate_resume_docx.js <input.md> <output.docx>\n");
    process.exit(1);
  }
  const md = fs.readFileSync(inputPath, "utf8");
  const parsed = parseResume(md);
  const doc = buildDoc(parsed);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  process.stdout.write(`DOCX written to: ${outputPath}\n`);
}

main().catch(err => { process.stderr.write(err.message + "\n"); process.exit(1); });
