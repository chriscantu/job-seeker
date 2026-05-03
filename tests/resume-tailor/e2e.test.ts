import { describe, expect, test } from 'bun:test';
import { parseCanonical } from '../../src/resume-tailor/parse-canonical';
import { extractKeywords, scoreBullet } from '../../src/resume-tailor/score-bullets';
import { selectSkills } from '../../src/resume-tailor/select-skills';
import { swapLeadClause } from '../../src/resume-tailor/summary-swap';
import { composeTailored } from '../../src/resume-tailor/compose-tailored';
import { renderResume } from '../../src/resume-tailor/render';
import { enforceTwoPages } from '../../src/resume-tailor/enforce-pages';
import { pageCount } from '../../src/resume-tailor/page-count';
import { parseSkillsMaster } from '../../src/resume-tailor/skills-master';
import { readFileSync, mkdtempSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const integrationReady =
  !!Bun.which('pandoc') && !!Bun.which('soffice') && !!Bun.which('pdfinfo');

const fixtures = ['jd-platform-vp.txt', 'jd-scaling-director.txt', 'jd-ai-infra.txt'];

describe.skipIf(!integrationReady)('e2e tailor', () => {
  for (const f of fixtures) {
    test(`tailor produces ≤2-page docx for ${f}`, async () => {
      const canonicalPath = resolve(process.cwd(), 'references/resume.md');
      const masterPath = resolve(process.cwd(), 'references/skills-master.md');
      const templatePath = resolve(process.cwd(), 'references/resume-template.docx');
      const fixturePath = resolve(__dirname, 'fixtures', f);

      if (!existsSync(canonicalPath)) throw new Error(`missing ${canonicalPath}`);
      if (!existsSync(masterPath)) throw new Error(`missing ${masterPath}`);
      if (!existsSync(templatePath)) throw new Error(`missing ${templatePath}`);
      if (!existsSync(fixturePath)) throw new Error(`missing ${fixturePath}`);

      const canonical = readFileSync(canonicalPath, 'utf8');
      const masterMd = readFileSync(masterPath, 'utf8');
      const jd = readFileSync(fixturePath, 'utf8');

      const ast = parseCanonical(canonical);
      const keywords = extractKeywords(jd);
      const master = parseSkillsMaster(masterMd);
      ast.skills = selectSkills(master, keywords);
      ast.summary = swapLeadClause(ast.summary, keywords[0] ?? '');

      const scores = new Map<string, number>();
      for (const role of ast.roles) {
        const bullets = role.subRoles
          ? role.subRoles.flatMap((s) => s.bullets)
          : role.bullets;
        for (const b of bullets) scores.set(b.text, scoreBullet(b.text, keywords));
      }

      const dir = mkdtempSync(join(tmpdir(), `e2e-${f}-`));
      const mdPath = join(dir, 'r.md');
      const docxPath = join(dir, 'r.docx');

      const renderAndCount = async (currentAST: typeof ast) => {
        writeFileSync(
          mdPath,
          composeTailored(currentAST, {
            generated: '2026-05-01',
            company: 'TestCo',
            role: f.replace(/\.txt$/, ''),
            posting_url: '',
          }),
        );
        await renderResume({
          markdownPath: mdPath,
          templatePath,
          outputPath: docxPath,
        });
        return pageCount(docxPath);
      };

      const result = await enforceTwoPages(ast, scores, { render: renderAndCount, max: 5 });
      expect(result.pages).toBeLessThanOrEqual(2);
      expect(statSync(docxPath).size).toBeGreaterThan(0);
    }, 60_000);
  }
});
