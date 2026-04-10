#!/usr/bin/env node
/**
 * Generate an ATS-friendly .docx resume from markdown source.
 * No tables, no cards, no complex layouts — single-column, clean text.
 *
 * Usage:
 *   bun scripts/generate_ats_resume_docx.js <input.md> <output.docx>
 */

"use strict";

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink,
  AlignmentType, BorderStyle, LevelFormat,
} = require("docx");

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_W   = 12240;
const MARGIN_H = 1080;  // 0.75"
const MARGIN_V = 720;   // 0.5" top/bottom for 2-page fit

const DARK_BLUE = "1F4E79";
const MID_BLUE  = "2E75B6";
const BLACK     = "333333";
const GRAY      = "555555";
const FONT      = "Calibri";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert **bold** spans into TextRun arrays. */
function richRuns(text, base) {
  const runs = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    }
    runs.push(new TextRun({ text: m[1], bold: true, ...base }));
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), ...base }));
  }
  return runs.length ? runs : [new TextRun({ text, ...base })];
}

function clean(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}

// ── Markdown parser ──────────────────────────────────────────────────────────
function parseResume(md) {
  const lines = md.split("\n");
  const result = {
    name: "", tagline: "", contact: "",
    summary: "",
    accomplishments: [],
    skills: [],
    experience: [],
    education: { degree: "", school: "" },
  };

  let i = 0;

  // Name
  if (lines[i] && lines[i].startsWith("# ")) {
    result.name = lines[i].slice(2).trim();
    i++;
  }
  // Tagline
  const tM = lines[i] && lines[i].trim().match(/^\*\*(.+)\*\*$/);
  if (tM) { result.tagline = tM[1]; i++; }
  // Blank line
  while (i < lines.length && !lines[i].trim()) i++;
  // Contact
  if (lines[i] && (lines[i].includes("@") || lines[i].includes("|"))) {
    result.contact = lines[i].trim();
    i++;
  }

  const skipWS = () => {
    while (i < lines.length && (!lines[i].trim() || lines[i].trim() === "---")) i++;
  };
  skipWS();

  // Summary
  const summaryParts = [];
  while (i < lines.length && !lines[i].startsWith("#") && lines[i].trim() !== "---") {
    if (lines[i].trim()) summaryParts.push(lines[i].trim());
    i++;
  }
  result.summary = summaryParts.join(" ");
  skipWS();

  // Sections
  let section = null;
  let job = null;

  while (i < lines.length) {
    const line = lines[i];
    const stripped = line.trim();

    if (stripped === "---") { i++; continue; }

    if (stripped.startsWith("## ")) {
      const nm = stripped.slice(3).toUpperCase();
      if (nm.includes("ACCOMPLISHMENT")) {
        if (job) { result.experience.push(job); job = null; }
        section = "accomplishments";
      } else if (nm.includes("SKILL")) {
        if (job) { result.experience.push(job); job = null; }
        section = "skills";
      } else if (nm.includes("EXPERIENCE")) {
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

    if (section === "accomplishments") {
      if (stripped.startsWith("- ")) result.accomplishments.push(stripped.slice(2));
      i++; continue;
    }

    if (section === "skills") {
      if (stripped) result.skills.push(stripped);
      i++; continue;
    }

    if (section === "experience" && job) {
      if (!stripped) { i++; continue; }
      if (stripped.startsWith("- ")) {
        job.items.push({ type: "bullet", text: stripped.slice(2) });
      } else if (stripped.startsWith("As ")) {
        job.items.push({ type: "sublabel", text: stripped });
      } else {
        job.items.push({ type: "para", text: stripped });
      }
      i++; continue;
    }

    if (section === "education") {
      if (!stripped) { i++; continue; }
      const dM = stripped.match(/^\*\*(.+?)\*\*/);
      if (dM) {
        result.education.degree = dM[1];
      } else if (!result.education.school) {
        result.education.school = clean(stripped);
      }
    }

    i++;
  }
  if (job) result.experience.push(job);
  return result;
}

// ── Document builder ─────────────────────────────────────────────────────────
function buildDoc(parsed) {
  const children = [];
  const bodyFont = { size: 20, font: FONT, color: BLACK };

  // ── Header ──
  children.push(new Paragraph({
    children: [new TextRun({ text: parsed.name, bold: true, color: DARK_BLUE, size: 40, font: FONT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 30 },
  }));

  if (parsed.tagline) {
    children.push(new Paragraph({
      children: [new TextRun({ text: parsed.tagline, italics: true, color: DARK_BLUE, size: 21, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
    }));
  }

  // Contact with clickable LinkedIn
  if (parsed.contact) {
    const contactParts = parsed.contact.split(/\s*\|\s*/);
    const contactChildren = [];
    contactParts.forEach((part, idx) => {
      if (idx > 0) contactChildren.push(new TextRun({ text: " | ", size: 19, font: FONT, color: GRAY }));
      const trimmed = part.trim();
      if (trimmed.includes("linkedin.com")) {
        const url = trimmed.startsWith("http") ? trimmed : "https://" + trimmed;
        contactChildren.push(new ExternalHyperlink({
          link: url,
          children: [new TextRun({ text: trimmed, color: MID_BLUE, underline: {}, size: 19, font: FONT })],
        }));
      } else {
        contactChildren.push(new TextRun({ text: trimmed, size: 19, font: FONT, color: GRAY }));
      }
    });
    children.push(new Paragraph({
      children: contactChildren,
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }));
  }

  // Divider
  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: DARK_BLUE, space: 1 } },
    spacing: { after: 80 },
  }));

  // ── Summary ──
  if (parsed.summary) {
    children.push(new Paragraph({
      children: richRuns(parsed.summary, bodyFont),
      spacing: { after: 40, line: 264 },
    }));
  }

  // ── Key Accomplishments ──
  if (parsed.accomplishments.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "KEY ACCOMPLISHMENTS", bold: true, color: DARK_BLUE, size: 22, font: FONT })],
      spacing: { before: 200, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MID_BLUE, space: 2 } },
    }));

    for (const item of parsed.accomplishments) {
      // Parse "**Label** — Description" format
      const m = item.match(/^\*\*(.+?)\*\*\s*[—–-]+\s*(.*)/);
      if (m) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: m[1] + " — ", bold: true, size: 19, font: FONT, color: DARK_BLUE }),
            new TextRun({ text: m[2], size: 19, font: FONT, color: BLACK }),
          ],
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 20, line: 260 },
        }));
      } else {
        children.push(new Paragraph({
          children: richRuns(item, { size: 19, font: FONT, color: BLACK }),
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 20, line: 260 },
        }));
      }
    }
  }

  // ── Professional Experience ──
  children.push(new Paragraph({
    children: [new TextRun({ text: "PROFESSIONAL EXPERIENCE", bold: true, color: DARK_BLUE, size: 22, font: FONT })],
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MID_BLUE, space: 2 } },
  }));

  for (const job of parsed.experience) {
    const titleRuns = job.company
      ? [
          new TextRun({ text: job.title + " | ", bold: true, color: MID_BLUE, size: 21, font: FONT }),
          new TextRun({ text: job.company, bold: true, color: BLACK, size: 21, font: FONT }),
        ]
      : [new TextRun({ text: job.title, bold: true, color: MID_BLUE, size: 21, font: FONT })];
    children.push(new Paragraph({
      children: titleRuns,
      spacing: { before: 200, after: 10 },
      keepNext: true,
    }));

    if (job.meta) {
      children.push(new Paragraph({
        children: [new TextRun({ text: job.meta, italics: true, size: 19, font: FONT, color: GRAY })],
        spacing: { after: 40 },
        keepNext: true,
      }));
    }

    for (const item of job.items) {
      if (item.type === "bullet") {
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 30, line: 264 },
        }));
      } else if (item.type === "sublabel") {
        children.push(new Paragraph({
          children: [new TextRun({ text: item.text, bold: true, italics: true, size: 19, font: FONT, color: GRAY })],
          spacing: { before: 60, after: 20 },
        }));
      } else {
        children.push(new Paragraph({
          children: richRuns(item.text, bodyFont),
          spacing: { after: 30, line: 264 },
        }));
      }
    }
  }

  // ── Education ──
  children.push(new Paragraph({
    children: [new TextRun({ text: "EDUCATION", bold: true, color: DARK_BLUE, size: 22, font: FONT })],
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MID_BLUE, space: 2 } },
  }));

  const edu = parsed.education;
  if (edu.degree) {
    children.push(new Paragraph({
      children: [new TextRun({ text: edu.degree, bold: true, ...bodyFont })],
      spacing: { after: 20 },
    }));
  }
  if (edu.school) {
    children.push(new Paragraph({
      children: [new TextRun({ text: edu.school, ...bodyFont })],
      spacing: { after: 40 },
    }));
  }

  // ── Skills ──
  if (parsed.skills.length) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "SKILLS", bold: true, color: DARK_BLUE, size: 22, font: FONT })],
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: MID_BLUE, space: 2 } },
    }));

    for (const skill of parsed.skills) {
      const colonIdx = skill.indexOf(":");
      if (colonIdx > -1) {
        const label = skill.slice(0, colonIdx);
        const value = skill.slice(colonIdx + 1).trim();
        children.push(new Paragraph({
          children: [
            new TextRun({ text: label + ": ", bold: true, size: 19, font: FONT, color: BLACK }),
            new TextRun({ text: value, size: 19, font: FONT, color: BLACK }),
          ],
          spacing: { after: 20, line: 260 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: skill, size: 19, font: FONT, color: BLACK })],
          spacing: { after: 20 },
        }));
      }
    }
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
          margin: { top: MARGIN_V, right: MARGIN_H, bottom: MARGIN_V, left: MARGIN_H },
        },
      },
      children,
    }],
  });
}

// ── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    process.stderr.write("Usage: bun scripts/generate_ats_resume_docx.js <input.md> <output.docx>\n");
    process.exit(1);
  }
  const { parseFrontmatter } = require("./lib/frontmatter");
  const md = parseFrontmatter(fs.readFileSync(inputPath, "utf8")).body;
  const parsed = parseResume(md);
  const doc = buildDoc(parsed);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  process.stdout.write("ATS resume written to: " + outputPath + "\n");
}

main().catch(err => { process.stderr.write(err.message + "\n"); process.exit(1); });
