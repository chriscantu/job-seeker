export type SkillTag = 'always' | 'situational';
export type MasterSkill = { name: string; tag: SkillTag };

export function parseSkillsMaster(md: string): MasterSkill[] {
  const skills: MasterSkill[] = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^- (.+?) \[(always|situational)\]$/);
    if (m) skills.push({ name: m[1].trim(), tag: m[2] as SkillTag });
  }
  return skills;
}
