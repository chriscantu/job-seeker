import type { ResumeAST, Role, Bullet, KeyAccomplishment } from './types';

export type TailoredFrontmatter = {
  company: string;
  role: string;
  posting_url: string;
  generated: string;
};

export function composeTailored(ast: ResumeAST, fm: TailoredFrontmatter): string {
  const parts: string[] = [];
  parts.push(renderFrontmatter(ast, fm));
  parts.push(`# ${ast.header.name}\n`);
  parts.push(`**${ast.header.tagline}**\n`);
  parts.push(`${ast.header.contact}\n`);
  parts.push(`${ast.summary}\n`);
  parts.push(`## Key Accomplishments\n`);
  parts.push(ast.keyAccomplishments.map(renderAccomplishment).join('\n') + '\n');
  parts.push(`## Skills\n`);
  parts.push(`${ast.skills.join(' | ')}\n`);
  parts.push(`## Professional Experience\n`);
  parts.push(ast.roles.map(renderRole).join('\n'));
  parts.push(`## Education\n`);
  parts.push(`**${ast.education.degrees}**\n`);
  parts.push(`${ast.education.school}\n`);
  return parts.join('\n');
}

function renderFrontmatter(ast: ResumeAST, fm: TailoredFrontmatter): string {
  return [
    '---',
    `generated: ${fm.generated}`,
    `company: ${fm.company}`,
    `role: ${fm.role}`,
    `posting_url: ${fm.posting_url}`,
    `template_version: ${ast.frontmatter.template_version}`,
    `canonical_version: ${ast.frontmatter.canonical_version}`,
    '---',
  ].join('\n') + '\n';
}

function renderAccomplishment(a: KeyAccomplishment): string {
  return `- **${a.label}** — ${a.description} | **Impact:** ${a.impact}`;
}

function renderRole(role: Role): string {
  const out: string[] = [];
  out.push(`### ${role.title} | ${role.company}\n`);
  out.push(`*${role.meta}*\n`);
  if (role.subRoles?.length) {
    for (const sub of role.subRoles) {
      out.push(`As ${sub.label}:\n`);
      out.push(sub.bullets.map(renderBullet).join('\n') + '\n');
    }
  } else {
    out.push(role.bullets.map(renderBullet).join('\n') + '\n');
  }
  return out.join('\n');
}

function renderBullet(b: Bullet): string {
  return `- ${b.text}. **Impact:** ${b.impact}`;
}
