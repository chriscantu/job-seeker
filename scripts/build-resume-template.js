/**
 * scripts/build-resume-template.js
 *
 * Generates references/resume-template.docx — empty-bodied Word template with
 * 10 named paragraph styles consumed by the resume-tailor render layer.
 * Run idempotently: `bun scripts/build-resume-template.js`.
 *
 * Output styles (names exact, case-sensitive — must match the render contract
 * in docs/superpowers/specs/2026-05-01-ats-resume-template-design.md, "Render
 * Pipeline > docx skill invocation" section):
 *   Heading 1, Heading 2, Heading 3, Tagline, Contact, Role Meta,
 *   List Bullet, Skills Line, Accomplishment, Body Text (Summary)
 *
 * Page geometry: US Letter, 0.75in margins all sides.
 *
 * Tooling: docx npm package (already in package.json deps). Per the Renderer
 * decision in the spec's Approach Decisions table: no Python source in this
 * repo (Python deps live in installed plugin packages like anthropic-skills:docx).
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  Document,
  Packer,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  convertInchesToTwip,
} = require('docx');

// ── docx unit converters ─────────────────────────────────────────────────────
// docx OOXML uses three different unit systems for different fields:
//   run.size              → half-points  (22pt body → 44)
//   paragraph.spacing/ind → twips        (1pt = 20 twips)
//   border.size           → eighth-points (0.5pt = 4)
const halfPt = pts => pts * 2;
const twips = pts => pts * 20;
const eighthPt = pts => pts * 8;

// ── Palette + font (per spec's Render Pipeline style table) ──────────────────
const NAVY = '1F3A5F';
const DARK_GRAY = '3A3A3A';
const MID_GRAY = '5A5A5A';
const BLACK = '000000';
const FONT = 'Calibri';

// ── Geometry constants (declarative — derived from spec) ─────────────────────
const MARGIN = convertInchesToTwip(0.75);
const BULLET_INDENT = convertInchesToTwip(0.15);
const LINE_SPACING_SINGLE = twips(12); // 12pt line height for 11pt body = 1.0

const RULE = {
  spec: BorderStyle.SINGLE,
  thicknessHalfPt: eighthPt(0.5), // 0.5pt navy bottom border on Heading 2
};

// ── Per-style typography (size in pt, spacing in pt) ─────────────────────────
const SIZE_PT = {
  nameH1: 22,
  sectionH2: 14,
  roleH3: 12,
  tagline: 12,
  contact: 10,
  roleMeta: 10,
  body: 11,
};

const SPACE_PT = {
  none: 0,
  xsTight: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
};

const OUTPUT_PATH = path.resolve(__dirname, '..', 'references', 'resume-template.docx');

// Built-in heading styles overridden via styles.default; custom styles below
// added via styles.paragraphStyles. Avoids duplicate-styleId XML bloat.
const defaultStyles = {
  heading1: {
    run: { font: FONT, size: halfPt(SIZE_PT.nameH1), bold: true, color: NAVY },
    paragraph: { alignment: AlignmentType.CENTER, spacing: { after: twips(SPACE_PT.sm) } },
  },
  heading2: {
    run: { font: FONT, size: halfPt(SIZE_PT.sectionH2), bold: true, color: NAVY, allCaps: true },
    paragraph: {
      spacing: { before: twips(SPACE_PT.md), after: twips(SPACE_PT.xs) },
      border: {
        bottom: { color: NAVY, space: 1, style: RULE.spec, size: RULE.thicknessHalfPt },
      },
    },
  },
  heading3: {
    run: { font: FONT, size: halfPt(SIZE_PT.roleH3), bold: true, color: NAVY },
    paragraph: { spacing: { before: twips(SPACE_PT.sm), after: twips(SPACE_PT.xsTight) } },
  },
  listParagraph: {
    run: { font: FONT, size: halfPt(SIZE_PT.body), color: BLACK },
    paragraph: {
      spacing: { before: twips(SPACE_PT.xsTight), after: twips(SPACE_PT.xsTight), line: LINE_SPACING_SINGLE },
      indent: { left: BULLET_INDENT, hanging: BULLET_INDENT },
    },
  },
};

const paragraphStyles = [
  {
    id: 'Tagline',
    name: 'Tagline',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: halfPt(SIZE_PT.tagline), italics: true, color: NAVY },
    paragraph: {
      alignment: AlignmentType.CENTER,
      spacing: { before: twips(SPACE_PT.none), after: twips(SPACE_PT.xs) },
    },
  },
  {
    id: 'Contact',
    name: 'Contact',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: halfPt(SIZE_PT.contact), color: DARK_GRAY },
    paragraph: {
      alignment: AlignmentType.CENTER,
      spacing: { before: twips(SPACE_PT.none), after: twips(SPACE_PT.lg) },
    },
  },
  {
    id: 'RoleMeta',
    name: 'Role Meta',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: halfPt(SIZE_PT.roleMeta), italics: true, color: MID_GRAY },
    paragraph: { spacing: { before: twips(SPACE_PT.none), after: twips(SPACE_PT.xs) } },
  },
  {
    id: 'ListBullet',
    name: 'List Bullet',
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    run: { font: FONT, size: halfPt(SIZE_PT.body), color: BLACK },
    paragraph: {
      spacing: {
        before: twips(SPACE_PT.xsTight),
        after: twips(SPACE_PT.xsTight),
        line: LINE_SPACING_SINGLE,
      },
      indent: { left: BULLET_INDENT, hanging: BULLET_INDENT },
      numbering: { reference: 'resume-bullets', level: 0 },
    },
  },
  {
    id: 'SkillsLine',
    name: 'Skills Line',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: halfPt(SIZE_PT.body), color: BLACK },
    paragraph: { spacing: { before: twips(SPACE_PT.none), after: twips(SPACE_PT.md) } },
  },
  {
    id: 'Accomplishment',
    name: 'Accomplishment',
    basedOn: 'ListBullet',
    next: 'Normal',
    run: { font: FONT, size: halfPt(SIZE_PT.body), color: BLACK },
    paragraph: {
      spacing: { before: twips(SPACE_PT.xsTight), after: twips(SPACE_PT.xsTight) },
      indent: { left: BULLET_INDENT, hanging: BULLET_INDENT },
      numbering: { reference: 'resume-bullets', level: 0 },
    },
  },
  {
    id: 'BodyTextSummary',
    name: 'Body Text (Summary)',
    basedOn: 'Normal',
    next: 'Normal',
    run: { font: FONT, size: halfPt(SIZE_PT.body), color: BLACK },
    paragraph: {
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: twips(SPACE_PT.none), after: twips(SPACE_PT.md) },
    },
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
        style: { paragraph: { indent: { left: BULLET_INDENT, hanging: BULLET_INDENT } } },
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
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children: [],
    },
  ],
});

Packer.toBuffer(doc)
  .then(buf => {
    fs.writeFileSync(OUTPUT_PATH, buf);
    console.log(`wrote ${OUTPUT_PATH} (${buf.length} bytes)`);
  })
  .catch(err => {
    console.error(`build-resume-template failed: ${err.message}`);
    process.exit(1);
  });
