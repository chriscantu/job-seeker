import { resolve } from 'node:path';

const DEFAULT_SCRIPT = resolve(import.meta.dir, '../../scripts/render-resume.fish');

export type RenderOpts = {
  markdownPath: string;
  templatePath: string;
  outputPath: string;
};

export async function renderResume(
  opts: RenderOpts,
  scriptPath: string = DEFAULT_SCRIPT,
): Promise<void> {
  const proc = Bun.spawn(
    [scriptPath, opts.markdownPath, opts.templatePath, opts.outputPath],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`render-resume failed (exit ${exitCode}): ${err.trim()}`);
  }
}
