/**
 * Generates minimal .docx fixtures for page-count integration tests.
 * One- and three-page counts verified against soffice conversion.
 *
 * Run: bun tests/resume-tailor/fixtures/build-fixtures.js
 *
 * Imports: `node:path` is a Node built-in served by Bun's compat layer (matches
 * the project pattern in scripts/*.js). `docx` is the npm package already in
 * dependencies. File writes use Bun.write (Bun-native) instead of fs.writeFileSync.
 */

const path = require('node:path');
const { Document, Packer, Paragraph, PageBreak } = require('docx');

const HERE = __dirname;

async function build() {
  const onePage = new Document({
    sections: [{ children: [new Paragraph('one page fixture')] }],
  });
  await Bun.write(path.join(HERE, 'one-page.docx'), await Packer.toBuffer(onePage));
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
  await Bun.write(path.join(HERE, 'three-page.docx'), await Packer.toBuffer(threePage));
  console.log('wrote three-page.docx');
}

build().catch(err => {
  console.error(`build-fixtures failed: ${err.message}`);
  process.exit(1);
});
