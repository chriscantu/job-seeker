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
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
} = require("docx");

// ── Constants (DXA: 1440 = 1 inch) ──────────────────────────────────────────
const PAGE_W    = 12240;
const MARGIN_H  = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN_H;  // 10,080
const COL_HALF  = Math.floor(CONTENT_W / 2);

// Colors (hex without #)
const DARK_BLUE = "1F3864";
const MID_BLUE  = "2E5FA3";
const LIGHT_BG  = "EBF2FB";
const WHITE     = "FFFFFF";
const BLACK     = "111111";
const GRAY      = "666666";

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
    children: [new TextRun({ text, bold: true, color: DARK_BLUE, size: 20, font: "Arial" })],
    spacing: { before: 160, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: DARK_BLUE, space: 2 } },
  });
}

const NO_BORDER = {
  top:    { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left:   { style: BorderStyle.NONE, size: 0 },
  right:  { style: BorderStyle.NONE, size: 0 },
};

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
      const dM = stripped.match(/^\*\*(.+?)\*\*/);
      if (dM) {
        result.education.degree = dM[1];
      } else if (stripped.includes("Core Expertise")) {
        result.education.expertise = clean(stripped.replace(/\*\*Core Expertise:\*\*\s*/, ""));
      } else if (!result.education.school) {
        result.education.school = clean(stripped);
      }
    }

    i++;
  }
  if (job) result.experience.push(job);
  return result;
}

// ── Document builder ──────────────────────────────────────────────────────────
function buildDoc(parsed) {
  const children = [];
  const bodyFont = { size: 19, font: "Arial", color: BLACK };

  // Header
  children.push(new Paragraph({
    children: [new TextRun({ text: parsed.name, bold: true, color: DARK_BLUE, size: 44, font: "Arial" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
  }));
  if (parsed.tagline) {
    children.push(new Paragraph({
      children: [new TextRun({ text: parsed.tagline, bold: true, color: MID_BLUE, size: 20, font: "Arial" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }));
  }
  if (parsed.contact) {
    children.push(new Paragraph({
      children: [new TextRun({ text: parsed.contact, ...bodyFont })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }));
  }
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: DARK_BLUE, space: 1 } },
    spacing: { after: 80 },
  }));

  // Summary
  if (parsed.summary) {
    children.push(new Paragraph({
      children: richRuns(parsed.summary, bodyFont),
      spacing: { after: 80, line: 276 },
    }));
    children.push(hrPara(MID_BLUE, 4));
  }

  // Key Accomplishments
  children.push(sectionHeading("KEY ACCOMPLISHMENTS"));

  const accomRows = parsed.accomplishments
    .filter(r => r.left || r.right)
    .map(r => {
      const makeCell = (text) => {
        const m = text.match(/^\*\*(.+?)\*\*\s*[—–-]\s*(.*)/);
        const runs = m
          ? [
              new TextRun({ text: m[1], bold: true, size: 18, font: "Arial" }),
              new TextRun({ text: " \u2014 " + m[2], size: 18, font: "Arial" }),
            ]
          : [new TextRun({ text: clean(text), size: 18, font: "Arial" })];
        return new TableCell({
          children: [new Paragraph({ children: runs, spacing: { after: 40, line: 264 } })],
          width: { size: COL_HALF, type: WidthType.DXA },
          shading: { fill: LIGHT_BG, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: NO_BORDER,
        });
      };
      return new TableRow({ children: [makeCell(r.left), makeCell(r.right)] });
    });

  if (accomRows.length) {
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [COL_HALF, COL_HALF],
      rows: accomRows,
      borders: {
        top:     { style: BorderStyle.NONE },
        bottom:  { style: BorderStyle.NONE },
        left:    { style: BorderStyle.NONE },
        right:   { style: BorderStyle.NONE },
        insideH: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
        insideV: { style: BorderStyle.SINGLE, size: 4, color: WHITE },
      },
    }));
  }

  children.push(hrPara(MID_BLUE, 4));

  // Professional Experience
  children.push(sectionHeading("PROFESSIONAL EXPERIENCE"));

  for (const job of parsed.experience) {
    const titleText = job.company ? `${job.title} | ${job.company}` : job.title;
    children.push(new Paragraph({
      children: [new TextRun({ text: titleText, bold: true, color: DARK_BLUE, size: 21, font: "Arial" })],
      spacing: { before: 120, after: 20 },
    }));
    if (job.meta) {
      children.push(new Paragraph({
        children: [new TextRun({ text: job.meta, italics: true, size: 18, font: "Arial", color: GRAY })],
        spacing: { after: 60 },
      }));
    }
    for (const item of job.items) {
      if (item.type === "bullet") {
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 40, line: 264 },
        }));
      } else {
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          spacing: { after: 40, line: 264 },
        }));
      }
    }
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 1 } },
      spacing: { before: 60, after: 40 },
    }));
  }

  // Education
  children.push(sectionHeading("EDUCATION & EXPERTISE"));
  const edu = parsed.education;
  if (edu.degree) {
    children.push(new Paragraph({
      children: [new TextRun({ text: edu.degree, bold: true, ...bodyFont })],
      spacing: { after: 40 },
    }));
  }
  if (edu.school) {
    children.push(new Paragraph({
      children: [new TextRun({ text: edu.school, ...bodyFont })],
      spacing: { after: 40 },
    }));
  }
  if (edu.expertise) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "Core Expertise: ", bold: true, ...bodyFont }),
        new TextRun({ text: edu.expertise, ...bodyFont }),
      ],
      spacing: { after: 60 },
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
          style: { paragraph: { indent: { left: 360, hanging: 180 } } },
        }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: "Arial", size: 19, color: BLACK } },
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
