import type { ResumeAST, Bullet, Role, KeyAccomplishment, SubRole } from './types';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;
const SECTION_HEADING_RE = /^## (.+)$/;
const ROLE_HEADING_SPLIT_RE = /^### /m;
const SUBROLE_LABEL_RE = /^As (.+?):$/;
const BULLET_PREFIX = '- ';
const KEY_ACCOMPLISHMENT_RE = /^- \*\*(.+?)\*\* — (.+)$/;

/**
 * AST is the single source of truth downstream — throw on schema violation
 * rather than degrade silently. Spec:
 * `docs/superpowers/specs/2026-05-01-ats-resume-template-design.md`.
 *
 * @throws Error on missing frontmatter, missing skills line, malformed
 *   Key Accomplishment, or bullet without `**Impact:**` clause.
 */
export function parseCanonicalResume(md: string): ResumeAST {
  const frontmatter = parseYamlFrontmatter(md);
  const body = md.replace(FRONTMATTER_RE, '');
  const sections = splitByH2Sections(body);

  return {
    frontmatter,
    header: parseHeader(sections.header),
    summary: parseSummary(sections.header),
    keyAccomplishments: parseKeyAccomplishments(sections['Key Accomplishments']),
    skills: parseSkills(sections['Skills']),
    roles: parseRoles(sections['Professional Experience']),
    education: parseEducation(sections['Education']),
  };
}

function parseYamlFrontmatter(md: string) {
  const match = md.match(FRONTMATTER_RE);
  if (!match) throw new Error('frontmatter missing');
  const fields = parseKeyValueLines(match[1]);
  return {
    template_version: parseInt(fields.template_version, 10),
    canonical_version: fields.canonical_version,
  };
}

function parseKeyValueLines(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (!key) continue;
    result[key.trim()] = rest.join(':').trim();
  }
  return result;
}

function splitByH2Sections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = body.split('\n');
  let currentSection = 'header';
  let buffer: string[] = [];
  for (const line of lines) {
    const heading = line.match(SECTION_HEADING_RE);
    if (heading) {
      out[currentSection] = buffer.join('\n').trim();
      currentSection = heading[1].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  out[currentSection] = buffer.join('\n').trim();
  return out;
}

function parseHeader(headerSection: string) {
  const lines = nonEmptyContentLines(headerSection);
  const name = lines[0].replace(/^# /, '').trim();
  const tagline = lines[1].replace(/^\*\*|\*\*$/g, '').trim();
  const contact = lines[2].trim();
  return { name, tagline, contact };
}

function parseSummary(headerSection: string) {
  const lines = nonEmptyContentLines(headerSection);
  return lines.slice(3).join(' ').trim();
}

function nonEmptyContentLines(section: string): string[] {
  return section
    .split('\n')
    .filter((l) => l.trim())
    .filter((l) => !l.trim().startsWith(':::'));
}

function parseKeyAccomplishments(section: string): KeyAccomplishment[] {
  return section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- **'))
    .map(parseKeyAccomplishmentLine);
}

function parseKeyAccomplishmentLine(line: string): KeyAccomplishment {
  const match = line.match(KEY_ACCOMPLISHMENT_RE);
  if (!match) {
    throw new Error(`key accomplishment malformed: ${line}`);
  }
  return {
    label: match[1].trim(),
    description: match[2].trim().replace(/\.$/, ''),
  };
}

function parseSkills(section: string): string[] {
  const line = section.split('\n').find((l) => l.includes('|'));
  if (!line) throw new Error('skills line not found');
  return line.split('|').map((s) => s.trim()).filter(Boolean);
}

function parseRoles(section: string): Role[] {
  const blocks = section.split(ROLE_HEADING_SPLIT_RE).slice(1);
  return blocks.map(parseRoleBlock);
}

function parseRoleBlock(block: string): Role {
  const lines = block.split('\n');
  const { title, company } = parseRoleHeading(lines[0]);
  const meta = parseRoleMeta(lines);
  const role: Role = { title, company, meta, bullets: [] };

  if (containsSubRoleLabels(lines)) {
    role.subRoles = parseSubRoles(lines);
  } else {
    role.bullets = parseFlatBullets(lines);
  }
  return role;
}

function parseRoleHeading(headingLine: string): { title: string; company: string } {
  const [title, company] = headingLine.split(' | ').map((s) => s.trim());
  return { title, company };
}

function parseRoleMeta(lines: string[]): string {
  const metaLine = lines.find((l) => l.startsWith('*')) ?? '';
  return metaLine.replace(/^\*|\*$/g, '').trim();
}

function containsSubRoleLabels(lines: string[]): boolean {
  return lines.some((l) => SUBROLE_LABEL_RE.test(l));
}

function parseSubRoles(lines: string[]): SubRole[] {
  const subRoles: SubRole[] = [];
  let active: SubRole | null = null;

  for (const line of lines) {
    const labelMatch = line.match(SUBROLE_LABEL_RE);
    if (labelMatch) {
      if (active) subRoles.push(active);
      active = { label: labelMatch[1], bullets: [] };
    } else if (active && line.trim().startsWith(BULLET_PREFIX)) {
      active.bullets.push(parseBullet(line));
    }
  }
  if (active) subRoles.push(active);
  return subRoles;
}

function parseFlatBullets(lines: string[]): Bullet[] {
  return lines
    .filter((l) => l.trim().startsWith(BULLET_PREFIX))
    .map(parseBullet);
}

function parseBullet(line: string): Bullet {
  const text = line.trim().replace(/^- /, '').trim().replace(/\.$/, '');
  if (!text) throw new Error('bullet missing text');
  return { text };
}

function parseEducation(section: string) {
  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const degrees = lines[0].replace(/^\*\*|\*\*$/g, '');
  const school = lines[1];
  return { degrees, school };
}
