import type { ResumeAST } from './types';
import type { DropTarget } from './drop-target';

export function applyDrop(ast: ResumeAST, target: DropTarget): void {
  const role = ast.roles[target.roleIndex];
  if (role.subRoles?.length) {
    let cursor = 0;
    for (const sub of role.subRoles) {
      if (target.bulletIndex < cursor + sub.bullets.length) {
        sub.bullets.splice(target.bulletIndex - cursor, 1);
        return;
      }
      cursor += sub.bullets.length;
    }
    throw new Error(`drop target out of bounds: ${target.bulletText}`);
  }
  role.bullets.splice(target.bulletIndex, 1);
}
