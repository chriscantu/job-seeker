import type { ResumeAST, Role, SubRole } from './types';
import type { DropTarget } from './drop-target';

/**
 * Remove a bullet from the AST in place, identified by `target`. The
 * `bulletIndex` on `target` is interpreted against the role at
 * `target.roleIndex`: if the role has sub-roles, the index is into the
 * flattened sub-role bullet sequence (sub-role 0 bullets first, then
 * sub-role 1, etc.) — symmetric with `selectDropTarget`'s collection order.
 *
 * @throws Error when the bulletIndex does not land on a sub-role bullet.
 */
export function removeBulletFromAst(ast: ResumeAST, target: DropTarget): void {
  const role = ast.roles[target.roleIndex];
  if (hasSubRoles(role)) {
    removeFromSubRoles(role.subRoles, target);
    return;
  }
  role.bullets.splice(target.bulletIndex, 1);
}

function hasSubRoles(role: Role): role is Role & { subRoles: SubRole[] } {
  return !!role.subRoles?.length;
}

function removeFromSubRoles(subRoles: SubRole[], target: DropTarget): void {
  let cursor = 0;
  for (const sub of subRoles) {
    const localIndex = target.bulletIndex - cursor;
    if (localIndex < sub.bullets.length) {
      sub.bullets.splice(localIndex, 1);
      return;
    }
    cursor += sub.bullets.length;
  }
  throw new Error(`drop target out of bounds: ${target.bulletText}`);
}
