/**
 * tests/resume-tailor/fixtures/build-fixtures.js
 *
 * Generates minimal .docx test fixtures for page-count integration tests.
 * Idempotent — safe to re-run; overwrites existing files.
 *
 * Outputs:
 *   one-page.docx   — single paragraph; soffice reports 1 page
 *   three-page.docx — three paragraphs separated by page breaks; soffice reports 3 pages
 *
 * Usage:
 *   node tests/resume-tailor/fixtures/build-fixtures.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { Document, Packer, Paragraph, TextRun, PageBreak } = require('docx');

const HERE = __dirname;

async function build() {
  const onePage = new Document({
    sections: [{ children: [new Paragraph('one page fixture')] }],
  });
  fs.writeFileSync(path.join(HERE, 'one-page.docx'), await Packer.toBuffer(onePage));
  console.log('wrote one-page.docx');

  const threePage = new Document({
    sections: [
      {
        children: [
          new Paragraph('page one'),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph('page two'),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph('page three'),
        ],
      },
    ],
  });
  fs.writeFileSync(path.join(HERE, 'three-page.docx'), await Packer.toBuffer(threePage));
  console.log('wrote three-page.docx');
}

build();
