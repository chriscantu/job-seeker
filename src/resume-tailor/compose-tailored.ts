import type { ResumeAST, Role, Bullet, KeyAccomplishment, SubRole } from './types';

export type TailoredFrontmatter = {
  company: string;
  role: string;
  posting_url: string;
  generated: string;
};

const REQUIRED_FRONTMATTER_KEYS: (keyof TailoredFrontmatter)[] = [
  'company',
  'role',
  'generated',
];

/**
 * Render a tailored `ResumeAST` to schema-conforming markdown — the inverse
 * of `parseCanonicalResume`. Output round-trips through the parser.
 *
 * Validates that the AST has the required structural sections and that the
 * frontmatter has the required keys. Throws on missing fields rather than
 * emitting `undefined` literals into the output.
 *
 * @throws Error when the AST or frontmatter is missing a required field.
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
    `**${ast.header.tagline}**\n`,
    `${ast.header.contact}\n`,
  ].join('\n');
}

function renderSummaryBlock(ast: ResumeAST): string {
  return `${ast.summary}\n`;
}

function renderKeyAccomplishmentsBlock(ast: ResumeAST): string {
  const body = ast.keyAccomplishments.map(renderAccomplishment).join('\n') + '\n';
  return `## Key Accomplishments\n\n${body}`;
}

function renderSkillsBlock(ast: ResumeAST): string {
  return `## Skills\n\n${ast.skills.join(' | ')}\n`;
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
  return `- **${a.label}** — ${a.description} | **Impact:** ${a.impact}`;
}

function renderRole(role: Role): string {
  const heading = `### ${role.title} | ${role.company}\n\n*${role.meta}*\n`;
  const body = role.subRoles?.length
    ? role.subRoles.map(renderSubRole).join('\n')
    : role.bullets.map(renderBullet).join('\n') + '\n';
  return `${heading}\n${body}`;
}

function renderSubRole(sub: SubRole): string {
  return `As ${sub.label}:\n\n${sub.bullets.map(renderBullet).join('\n')}\n`;
}

function renderBullet(b: Bullet): string {
  return `- ${b.text}. **Impact:** ${b.impact}`;
}
