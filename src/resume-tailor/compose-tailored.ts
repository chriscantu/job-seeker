import type { ResumeAST, Role, Bullet, KeyAccomplishment, SubRole } from './types';

type TailoredFrontmatterRequired = {
  company: string;
  role: string;
  generated: string;
};

export type TailoredFrontmatter = TailoredFrontmatterRequired & {
  posting_url?: string;
};

const REQUIRED_FRONTMATTER_KEYS = [
  'company',
  'role',
  'generated',
] as const satisfies readonly (keyof TailoredFrontmatterRequired)[];

/**
 * Inverse of `parseCanonicalResume`. Output round-trips through the parser.
 *
 * Validates required AST sections and required frontmatter keys before
 * emitting any template literals. `posting_url` is optional (legitimately
 * blank for postings without a URL) and falls through as an empty value;
 * other missing required fields throw with a `compose: <field> missing`
 * message rather than silently emitting "undefined" into the output.
 *
 * Empty arrays in `skills`, `roles`, `keyAccomplishments` are NOT rejected
 * — upstream selection layers may legitimately produce a slimmed AST. The
 * guard here is "no `undefined` leakage", not "every section non-empty".
 *
 * @throws Error when AST or frontmatter is missing a required field.
 */
export function composeTailoredResumeMarkdown(
  ast: ResumeAST,
  fm: TailoredFrontmatter,
): string {
  assertAstShape(ast);
  assertFrontmatterShape(fm);

  const sections = [
    renderTailoredFrontmatter(ast, fm),
    renderHeaderBlock(ast),
    renderSummaryBlock(ast),
    renderKeyAccomplishmentsBlock(ast),
    renderSkillsBlock(ast),
    renderExperienceBlock(ast),
    renderEducationBlock(ast),
  ];
  return sections.join('\n');
}

function assertAstShape(ast: ResumeAST): void {
  if (!ast.header?.name) throw new Error('compose: ast.header.name missing');
  if (!ast.header.tagline) throw new Error('compose: ast.header.tagline missing');
  if (!ast.header.contact) throw new Error('compose: ast.header.contact missing');
  if (typeof ast.summary !== 'string') throw new Error('compose: ast.summary missing');
  if (!ast.keyAccomplishments) throw new Error('compose: ast.keyAccomplishments missing');
  if (!ast.skills) throw new Error('compose: ast.skills missing');
  if (!ast.roles) throw new Error('compose: ast.roles missing');
  if (!ast.education?.degrees) throw new Error('compose: ast.education.degrees missing');
  if (!ast.education.school) throw new Error('compose: ast.education.school missing');
  if (!ast.frontmatter) throw new Error('compose: ast.frontmatter missing');
}

function assertFrontmatterShape(fm: TailoredFrontmatter): void {
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    if (!fm[key]) throw new Error(`compose: frontmatter.${key} missing`);
  }
}

function renderTailoredFrontmatter(
  ast: ResumeAST,
  fm: TailoredFrontmatter,
): string {
  return [
    '---',
    `generated: ${fm.generated}`,
    `company: ${fm.company}`,
    `role: ${fm.role}`,
    `posting_url: ${fm.posting_url ?? ''}`,
    `template_version: ${ast.frontmatter.template_version}`,
    `canonical_version: ${ast.frontmatter.canonical_version}`,
    '---',
  ].join('\n') + '\n';
}

function renderHeaderBlock(ast: ResumeAST): string {
  return [
    `# ${ast.header.name}\n`,
    `::: {custom-style="Tagline"}`,
    `${ast.header.tagline}\\`,
    ast.header.contact,
    `:::\n`,
  ].join('\n');
}

function renderSummaryBlock(ast: ResumeAST): string {
  return [
    `::: {custom-style="BodyTextSummary"}`,
    ast.summary,
    `:::\n`,
  ].join('\n');
}

function renderKeyAccomplishmentsBlock(ast: ResumeAST): string {
  const body = ast.keyAccomplishments.map(renderAccomplishment).join('\n') + '\n';
  return `## Key Accomplishments\n\n${body}`;
}

function renderSkillsBlock(ast: ResumeAST): string {
  return [
    `## Skills`,
    ``,
    `::: {custom-style="SkillsLine"}`,
    ast.skills.join(' | '),
    `:::\n`,
  ].join('\n');
}

function renderExperienceBlock(ast: ResumeAST): string {
  return `## Professional Experience\n\n${ast.roles.map(renderRole).join('\n')}`;
}

function renderEducationBlock(ast: ResumeAST): string {
  return [
    `## Education\n`,
    `**${ast.education.degrees}**\n`,
    `${ast.education.school}\n`,
  ].join('\n');
}

function renderAccomplishment(a: KeyAccomplishment): string {
  return `- **${a.label}** — ${a.description}.`;
}

function renderRole(role: Role): string {
  const metaBlock = role.mandate
    ? `*${role.meta}*\\\n${role.mandate}\n`
    : `*${role.meta}*\n`;
  const heading = `### ${role.title} | ${role.company}\n\n${metaBlock}`;
  const body = role.subRoles?.length
    ? role.subRoles.map(renderSubRole).join('\n')
    : role.bullets.map(renderBullet).join('\n') + '\n';
  return `${heading}\n${body}`;
}

function renderSubRole(sub: SubRole): string {
  return `As ${sub.label}:\n\n${sub.bullets.map(renderBullet).join('\n')}\n`;
}

function renderBullet(b: Bullet): string {
  return `- ${b.text}.`;
}
