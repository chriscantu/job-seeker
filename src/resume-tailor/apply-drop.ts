import type { ResumeAST, Role, SubRole } from './types';
import type { DropTarget } from './drop-target';

type RoleWithSubRoles = Role & { subRoles: [SubRole, ...SubRole[]] };

/**
 * Remove a bullet from the AST in place. `bulletIndex` is interpreted
 * against the role at `target.roleIndex`: if the role has sub-roles, the
 * index addresses the FLATTENED sub-role bullet sequence (sub-role 0
 * bullets first, then sub-role 1, …) — symmetric with `selectDropTarget`'s
 * `flattenSubRoleBullets` collection order.
 *
 * Throws when the index falls outside any sub-role's bullet range. For
 * roles WITHOUT sub-roles, `Array.prototype.splice` no-ops on out-of-bounds
 * — the caller is trusted because `selectDropTarget` only emits valid
 * indices, but a malicious caller can pass an out-of-bounds index and get
 * silent no-op behavior on the flat-bullet path. If you ever construct
 * `DropTarget` outside `selectDropTarget`, validate the index yourself.
 *
 * @throws Error when sub-role flattened index is out of bounds.
 */
export function removeBulletFromAst(ast: ResumeAST, target: DropTarget): void {
  const role = ast.roles[target.roleIndex];
  if (hasSubRoles(role)) {
    removeFromSubRoles(role.subRoles, target);
    return;
  }
  role.bullets.splice(target.bulletIndex, 1);
}

function hasSubRoles(role: Role): role is RoleWithSubRoles {
  return !!role.subRoles && role.subRoles.length > 0;
}

function removeFromSubRoles(
  subRoles: RoleWithSubRoles['subRoles'],
  target: DropTarget,
): void {
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
