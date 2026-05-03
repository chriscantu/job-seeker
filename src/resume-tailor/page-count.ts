// src/resume-tailor/page-count.ts
import { spawn } from 'bun';
import { resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dir, '../../scripts/resume-page-count.fish');

export async function pageCount(docxPath: string): Promise<number> {
  const proc = spawn([SCRIPT, docxPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`page-count failed (exit ${exitCode}): ${err.trim()}`);
  }
  const trimmed = (await new Response(proc.stdout).text()).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`page-count returned non-integer: ${trimmed}`);
  }
  return parseInt(trimmed, 10);
}
