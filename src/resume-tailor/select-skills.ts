import type { MasterSkill } from './skills-master';

export function selectSkills(master: MasterSkill[], keywords: string[]): string[] {
  const floor = master.filter((s) => s.tag === 'always').map((s) => s.name);
  if (floor.length < 5) {
    throw new Error('skills floor under-defined: need >=5 [always]-tagged entries');
  }
  const floorPicked = floor.slice(0, 5);

  const situational = master.filter((s) => s.tag === 'situational').map((s) => s.name);
  const lowered = keywords.map((k) => k.toLowerCase());
  const ranked = situational
    .map((name) => ({
      name,
      score: lowered.reduce((acc, kw) => acc + (name.toLowerCase().includes(kw) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  const overlay: string[] = [];
  for (const r of ranked) {
    if (overlay.length === 5) break;
    if (floorPicked.includes(r.name)) continue;
    overlay.push(r.name);
  }
  return [...floorPicked, ...overlay];
}
