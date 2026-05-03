import type { ResumeAST, Bullet, Role } from './types';

export type DropTarget = {
  roleIndex: number;
  roleCompany: string;
  bulletIndex: number;
  bulletText: string;
};

type IndexedBullet = { bullet: Bullet; index: number };

const CURRENT_ROLE_INDEX = 0;

/**
 * Pick the next bullet to drop when a tailored resume exceeds 2 pages. The
 * current role (index 0) is always protected; selection walks roles from
 * oldest to newest, and within each role chooses the lowest-relevance bullet
 * with a bottom-first tiebreak.
 *
 * Returns `null` when every eligible role's bullets are already gone — the
 * caller should treat this as a hard failure (drop pool exhausted).
 */
export function selectDropTarget(
  ast: ResumeAST,
  scores: Map<string, number>,
): DropTarget | null {
  for (const roleIndex of eligibleRoleIndicesOldestFirst(ast)) {
    const role = ast.roles[roleIndex];
    const candidate = pickLowestScoringBullet(role, scores);
    if (candidate === null) continue;
    return {
      roleIndex,
      roleCompany: role.company,
      bulletIndex: candidate.index,
      bulletText: candidate.bullet.text,
    };
  }
  return null;
}

function eligibleRoleIndicesOldestFirst(ast: ResumeAST): number[] {
  const indices: number[] = [];
  for (let i = ast.roles.length - 1; i > CURRENT_ROLE_INDEX; i--) {
    indices.push(i);
  }
  return indices;
}

function pickLowestScoringBullet(
  role: Role,
  scores: Map<string, number>,
): IndexedBullet | null {
  const bullets = collectBulletsWithIndex(role);
  if (bullets.length === 0) return null;
  return bullets.sort(byScoreAscThenBottomFirst(scores))[0];
}

function byScoreAscThenBottomFirst(
  scores: Map<string, number>,
): (a: IndexedBullet, b: IndexedBullet) => number {
  return (a, b) => {
    const scoreA = scores.get(a.bullet.text) ?? 0;
    const scoreB = scores.get(b.bullet.text) ?? 0;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return b.index - a.index;
  };
}

function collectBulletsWithIndex(role: Role): IndexedBullet[] {
  if (role.subRoles?.length) {
    return flattenSubRoleBullets(role.subRoles);
  }
  return role.bullets.map((bullet, index) => ({ bullet, index }));
}

function flattenSubRoleBullets(
  subRoles: NonNullable<Role['subRoles']>,
): IndexedBullet[] {
  const out: IndexedBullet[] = [];
  let index = 0;
  for (const sub of subRoles) {
    for (const bullet of sub.bullets) {
      out.push({ bullet, index: index++ });
    }
  }
  return out;
}
