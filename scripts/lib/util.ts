import * as fs from 'fs';
import * as path from 'path';

export function resolveStateFile(dir: string, type: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const pattern = new RegExp(`\\d{4}-\\d{2}-\\d{2}-${type}\\.md$`);
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

export function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmpFile, content);
  fs.renameSync(tmpFile, filePath);
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Extracts a human-readable message from any thrown value. Catch blocks are
// typed `unknown` under TS strict, so call sites otherwise repeat
// `err instanceof Error ? err.message : String(err)` for every catch. Use
// this helper instead — concentrates the narrowing in one place.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Variant that prefers stack trace when available (for DEBUG-mode logging).
// Falls back to message, then String(err).
export function errorStackOrMessage(err: unknown): string {
  if (err instanceof Error) return err.stack || err.message;
  return String(err);
}

// Returns today's date as YYYY-MM-DD in UTC. Centralizes the convention so
// daysBetween (which interprets dates as UTC midnights) composes correctly
// with all "today" defaults across the lib. Don't switch to
// toLocaleDateString() or new Date().getDate() — local-tz output would
// off-by-one around the local midnight boundary, hard to reproduce in tests.
export function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
