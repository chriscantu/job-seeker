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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(label: string, value: string): void {
  if (!DATE_RE.test(value)) {
    throw new Error(`daysBetween: ${label} must be YYYY-MM-DD, got ${value}`);
  }
  const y = +value.slice(0, 4);
  const m = +value.slice(5, 7);
  const day = +value.slice(8, 10);
  const d = new Date(Date.UTC(y, m - 1, day));
  if (d.toISOString().slice(0, 10) !== value) {
    throw new Error(`daysBetween: ${label} must be YYYY-MM-DD, got ${value}`);
  }
}

/**
 * Returns the signed integer count of calendar days from `fromDate` to
 * `toDate`, both YYYY-MM-DD strings interpreted as UTC midnights. Result
 * is positive when `toDate` is later, zero when equal, negative when
 * earlier. Throws if either input is not a YYYY-MM-DD string.
 */
export function daysBetween(fromDate: string, toDate: string): number {
  assertDate('fromDate', fromDate);
  assertDate('toDate', toDate);
  const MS_PER_DAY = 86_400_000;
  const from = Date.UTC(+fromDate.slice(0, 4), +fromDate.slice(5, 7) - 1, +fromDate.slice(8, 10));
  const to = Date.UTC(+toDate.slice(0, 4), +toDate.slice(5, 7) - 1, +toDate.slice(8, 10));
  return Math.round((to - from) / MS_PER_DAY);
}
