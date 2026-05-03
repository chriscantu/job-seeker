import type { ResumeAST, Bullet, Role } from './types';

export type DropTarget = {
  roleIndex: number;
  roleCompany: string;
  bulletIndex: number;
  bulletText: string;
};

export function selectDropTarget(
  ast: ResumeAST,
  scores: Map<string, number>,
): DropTarget | null {
  // Drop pool: every role except index 0 (current role).
  for (let i = ast.roles.length - 1; i >= 1; i--) {
    const role = ast.roles[i];
    const bullets = collectBullets(role);
    if (bullets.length === 0) continue;
    // Sort by ascending score; tiebreak by descending position (bottom first).
    bullets.sort((a, b) => {
      const scoreA = scores.get(a.bullet.text) ?? 0;
      const scoreB = scores.get(b.bullet.text) ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.index - a.index;
    });
    const pick = bullets[0];
    return {
      roleIndex: i,
      roleCompany: role.company,
      bulletIndex: pick.index,
      bulletText: pick.bullet.text,
    };
  }
  return null;
}

function collectBullets(role: Role) {
  const out: { bullet: Bullet; index: number }[] = [];
  if (role.subRoles?.length) {
    let idx = 0;
    for (const sub of role.subRoles) {
      for (const b of sub.bullets) {
        out.push({ bullet: b, index: idx++ });
      }
    }
  } else {
    role.bullets.forEach((b, i) => out.push({ bullet: b, index: i }));
  }
  return out;
}
