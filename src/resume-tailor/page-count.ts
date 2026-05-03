// src/resume-tailor/page-count.ts
import { spawn } from 'bun';

export async function pageCount(docxPath: string): Promise<number> {
  const proc = spawn(['scripts/resume-page-count.fish', docxPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`page-count failed (exit ${exitCode}): ${err.trim()}`);
  }
  const out = await new Response(proc.stdout).text();
  const n = parseInt(out.trim(), 10);
  if (!Number.isFinite(n)) {
    throw new Error(`page-count returned non-integer: ${out}`);
  }
  return n;
}
