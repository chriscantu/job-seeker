import { resolve } from 'node:path';
import type { PageCount } from './types';

export type { PageCount };

const DEFAULT_SCRIPT = resolve(import.meta.dir, '../../scripts/resume-page-count.fish');

export async function pageCount(
  docxPath: string,
  scriptPath: string = DEFAULT_SCRIPT,
): Promise<PageCount> {
  const proc = Bun.spawn([scriptPath, docxPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`page-count failed (exit ${exitCode}): ${err.trim()}`);
  }
  const trimmed = (await new Response(proc.stdout).text()).trim();
  // Stdout must be a bare positive integer (one or more digits, nothing else).
  // Rejects: empty string, "Pages: 3", "1.5", "3xyz" — defends against future
  // fish script edits that accidentally print debug text or change pdfinfo parsing.
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`page-count returned non-integer: ${trimmed}`);
  }
  return parseInt(trimmed, 10) as PageCount;
}
