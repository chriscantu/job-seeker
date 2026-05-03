/**
 * scripts/build-resume-template.js
 *
 * Generates references/resume-template.docx — empty-bodied Word template with
 * 10 named paragraph styles consumed by the resume-tailor render layer
 * (Task 5.1). Run idempotently: `node scripts/build-resume-template.js`.
 *
 * Output styles (names exact, case-sensitive — must match render contract in
 * docs/superpowers/specs/2026-05-01-ats-resume-template-design.md lines 257-269):
 *   Heading 1, Heading 2, Heading 3, Tagline, Contact, Role Meta,
 *   List Bullet, Skills Line, Accomplishment, Body Text (Summary)
 *
 * Page geometry: US Letter, 0.75in margins all sides (1080 DXA).
 *
 * Tooling: docx npm package (already in package.json deps). No Python — see
 * spec line 42: "no Python in repo".
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  Document,
  Packer,
  AlignmentType,
  BorderStyle,
  LevelFormat,
} = require('docx');

const NAVY = '1F3A5F';
const DARK_GRAY = '3A3A3A';
const MID_GRAY = '5A5A5A';
const BLACK = '000000';
const FONT = 'Calibri';

const OUTPUT_PATH = path.resolve(__dirname, '..', 'references', 'resume-template.docx');

// Built-in heading styles overridden via styles.default; custom styles below
// added via styles.paragraphStyles. Avoids duplicate-styleId XML bloat.
const defaultStyles = {
  heading1: {
    run: { font: FONT, size: 44, bold: true, color: NAVY },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 120 } },
  },
  heading2: {
    run: { font: FONT, size: 28, bold: true, color: NAVY, allCaps: true },
    paragraph: {
      spacing: { before: 160, after: 80 },
      border: {
        bottom: { color: NAVY, space: 1, style: BorderStyle.SINGLE, size: 4 },
      },
    },
  },
  heading3: {
    run: { font: FONT, size: 24, bold: true, color: NAVY },
    paragraph: { spacing: { before: 120, after: 40 } },
  },
  listParagraph: {
    run: { font: FONT, size: 22, color: BLACK },
    paragraph: {
      spacing: { before: 40, after: 40, line: 240 },
      indent: { left: 216, hanging: 216 },
    },
  },
};

const paragraphStyles = [
  {
    id: 'Tagline',
    name: 'Tagline',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: 24, italics: true, color: NAVY },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 } },
  },
  {
    id: 'Contact',
    name: 'Contact',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: 20, color: DARK_GRAY },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 } },
  },
  {
    id: 'RoleMeta',
    name: 'Role Meta',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: 20, italics: true, color: MID_GRAY },
    paragraph: { spacing: { before: 0, after: 80 } },
  },
  {
    id: 'ListBullet',
    name: 'List Bullet',
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    run: { font: FONT, size: 22, color: BLACK },
    paragraph: {
      spacing: { before: 40, after: 40, line: 240 },
      indent: { left: 216, hanging: 216 },
      numbering: { reference: 'resume-bullets', level: 0 },
    },
  },
  {
    id: 'SkillsLine',
    name: 'Skills Line',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: 22, color: BLACK },
    paragraph: { spacing: { before: 0, after: 160 } },
  },
  {
    id: 'Accomplishment',
    name: 'Accomplishment',
    basedOn: 'ListBullet',
    next: 'Normal',
    run: { font: FONT, size: 22, color: BLACK },
    paragraph: {
      spacing: { before: 40, after: 40 },
      indent: { left: 216, hanging: 216 },
      numbering: { reference: 'resume-bullets', level: 0 },
    },
  },
  {
    id: 'BodyTextSummary',
    name: 'Body Text (Summary)',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: 22, color: BLACK },
    paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { before: 0, after: 160 } },
  },
];

const numberingConfig = [
  {
    reference: 'resume-bullets',
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 216, hanging: 216 } } },
      },
    ],
  },
];

const doc = new Document({
  styles: { default: defaultStyles, paragraphStyles },
  numbering: { config: numberingConfig },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      children: [],
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT_PATH, buf);
  console.log(`wrote ${OUTPUT_PATH} (${buf.length} bytes)`);
});
