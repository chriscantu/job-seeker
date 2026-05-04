import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteFileSync, ensureDir } from './util';

export const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface CacheEntry {
  skill: string;
  phase: string;
  cached_at: string;
  expires_at: string;
  data: unknown;
}

export function cacheDir(outputDir: string): string {
  return path.join(outputDir, '.cache');
}

export function cacheFilePath(outputDir: string, skill: string, phase: string): string {
  return path.join(cacheDir(outputDir), `${skill}-${phase}.json`);
}

export function writeCache(outputDir: string, skill: string, phase: string, data: unknown): void {
  if (!skill || typeof skill !== 'string') throw new Error('skill is required');
  if (!phase || typeof phase !== 'string') throw new Error('phase is required');
  if (data === null || data === undefined) throw new Error('data is required');

  const dir = cacheDir(outputDir);
  ensureDir(dir);

  const now = new Date();
  const content: CacheEntry = {
    skill,
    phase,
    cached_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    data,
  };

  atomicWriteFileSync(cacheFilePath(outputDir, skill, phase), JSON.stringify(content, null, 2));
}

export function readCache(outputDir: string, skill: string, phase: string): CacheEntry | null {
  const filePath = cacheFilePath(outputDir, skill, phase);
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  let content: CacheEntry;
  try {
    content = JSON.parse(raw);
  } catch {
    return null;
  }

  const expiresAt = content.expires_at ? new Date(content.expires_at).getTime() : 0;
  if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

  return content;
}

export function listCaches(outputDir: string, skill?: string): CacheEntry[] {
  const dir = cacheDir(outputDir);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const entries: CacheEntry[] = [];

  for (const file of files) {
    let content: CacheEntry;
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      content = JSON.parse(raw);
    } catch {
      continue;
    }
    if (skill && content.skill !== skill) continue;
    entries.push(content);
  }

  return entries;
}

export function cleanCaches(outputDir: string, skill?: string): number {
  const dir = cacheDir(outputDir);
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let count = 0;

  for (const file of files) {
    if (skill) {
      let content: CacheEntry;
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf8');
        content = JSON.parse(raw);
      } catch {
        continue;
      }
      if (content.skill !== skill) continue;
    }
    fs.unlinkSync(path.join(dir, file));
    count++;
  }

  return count;
}
