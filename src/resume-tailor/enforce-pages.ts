import { selectDropTarget } from './drop-target';
import { removeBulletFromAst } from './apply-drop';
import type { ResumeAST } from './types';

export type EnforceOpts = {
  render: (ast: ResumeAST) => Promise<number>;
  max: number;
};

export type EnforceResult = {
  pages: number;
  dropped: { roleCompany: string; bulletText: string; iteration: number }[];
};

export async function enforceTwoPages(
  ast: ResumeAST,
  scores: Map<string, number>,
  opts: EnforceOpts,
): Promise<EnforceResult> {
  const dropped: EnforceResult['dropped'] = [];
  for (let iter = 1; iter <= opts.max; iter++) {
    const pages = await opts.render(ast);
    if (pages <= 2) return { pages, dropped };
    const target = selectDropTarget(ast, scores);
    if (target === null) {
      throw new Error(`drop pool exhausted; pages=${pages} after ${iter - 1} drops`);
    }
    removeBulletFromAst(ast, target);
    dropped.push({
      roleCompany: target.roleCompany,
      bulletText: target.bulletText,
      iteration: iter,
    });
  }
  throw new Error(
    `enforce-pages did not converge in ${opts.max} iterations after ${dropped.length} drops`,
  );
}
