import type { ResumeAST, Bullet, Role, KeyAccomplishment, SubRole } from './types';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

export function parseCanonical(md: string): ResumeAST {
  const fm = parseFrontmatter(md);
  const body = md.replace(FRONTMATTER_RE, '');
  const sections = splitSections(body);

  return {
    frontmatter: fm,
    header: parseHeader(sections.header),
    summary: parseSummary(sections.header),
    keyAccomplishments: parseKeyAccomplishments(sections['Key Accomplishments']),
    skills: parseSkills(sections['Skills']),
    roles: parseRoles(sections['Professional Experience']),
    education: parseEducation(sections['Education']),
  };
}

function parseFrontmatter(md: string) {
  const match = md.match(FRONTMATTER_RE);
  if (!match) throw new Error('frontmatter missing');
  const lines = match[1].split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const [k, ...rest] = line.split(':');
    if (!k) continue;
    result[k.trim()] = rest.join(':').trim();
  }
  return {
    template_version: parseInt(result.template_version, 10),
    canonical_version: result.canonical_version,
  };
}

function splitSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = body.split('\n');
  let current = 'header';
  let buf: string[] = [];
  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      out[current] = buf.join('\n').trim();
      current = h2[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  out[current] = buf.join('\n').trim();
  return out;
}

function parseHeader(headerSection: string) {
  const lines = headerSection.split('\n').filter((l) => l.trim());
  const name = lines[0].replace(/^# /, '').trim();
  const tagline = lines[1].replace(/^\*\*|\*\*$/g, '').trim();
  const contact = lines[2].trim();
  return { name, tagline, contact };
}

function parseSummary(headerSection: string) {
  const lines = headerSection.split('\n').filter((l) => l.trim());
  return lines.slice(3).join(' ').trim();
}

function parseKeyAccomplishments(section: string): KeyAccomplishment[] {
  return section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- **'))
    .map((line) => {
      const labelMatch = line.match(/^- \*\*(.+?)\*\* — (.+?)\s*\|\s*\*\*Impact:\*\*\s*(.+)$/);
      if (!labelMatch) {
        throw new Error(`key accomplishment malformed: ${line}`);
      }
      return {
        label: labelMatch[1].trim(),
        description: labelMatch[2].trim(),
        impact: labelMatch[3].trim(),
      };
    });
}

function parseSkills(section: string): string[] {
  const line = section.split('\n').find((l) => l.includes('|'));
  if (!line) throw new Error('skills line not found');
  return line.split('|').map((s) => s.trim()).filter(Boolean);
}

function parseRoles(section: string): Role[] {
  const roles: Role[] = [];
  const blocks = section.split(/^### /m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const heading = lines[0];
    const [title, company] = heading.split(' | ').map((s) => s.trim());
    const meta = (lines.find((l) => l.startsWith('*')) ?? '').replace(/^\*|\*$/g, '').trim();
    const role: Role = { title, company, meta, bullets: [] };

    const subRolePattern = /^As (.+?):$/;
    const hasSubRoles = lines.some((l) => subRolePattern.test(l));
    if (hasSubRoles) {
      role.subRoles = [];
      let currentSub: SubRole | null = null;
      for (const line of lines) {
        const subMatch = line.match(subRolePattern);
        if (subMatch) {
          if (currentSub) role.subRoles.push(currentSub);
          currentSub = { label: subMatch[1], bullets: [] };
        } else if (currentSub && line.trim().startsWith('- ')) {
          currentSub.bullets.push(parseBullet(line));
        }
      }
      if (currentSub) role.subRoles.push(currentSub);
    } else {
      for (const line of lines) {
        if (line.trim().startsWith('- ')) {
          role.bullets.push(parseBullet(line));
        }
      }
    }
    roles.push(role);
  }
  return roles;
}

function parseBullet(line: string): Bullet {
  const trimmed = line.trim().replace(/^- /, '');
  const impactMatch = trimmed.match(/^(.+?)\s+\*\*Impact:\*\*\s+(.+)$/);
  if (!impactMatch) {
    throw new Error(`bullet missing **Impact:** clause: ${trimmed}`);
  }
  return {
    text: impactMatch[1].trim().replace(/\.$/, ''),
    impact: impactMatch[2].trim(),
  };
}

function parseEducation(section: string) {
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const degrees = lines[0].replace(/^\*\*|\*\*$/g, '');
  const school = lines[1];
  return { degrees, school };
}
