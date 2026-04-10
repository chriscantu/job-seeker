const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync, ensureDir } = require('./util');

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function cacheDir(outputDir) {
  return path.join(outputDir, '.cache');
}

function cacheFilePath(outputDir, skill, phase) {
  return path.join(cacheDir(outputDir), `${skill}-${phase}.json`);
}

function writeCache(outputDir, skill, phase, data) {
  if (!skill || typeof skill !== 'string') throw new Error('skill is required');
  if (!phase || typeof phase !== 'string') throw new Error('phase is required');
  if (data === null || data === undefined) throw new Error('data is required');

  const dir = cacheDir(outputDir);
  ensureDir(dir);

  const now = new Date();
  const content = {
    skill,
    phase,
    cached_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    data,
  };

  atomicWriteFileSync(cacheFilePath(outputDir, skill, phase), JSON.stringify(content, null, 2));
}

function readCache(outputDir, skill, phase) {
  const filePath = cacheFilePath(outputDir, skill, phase);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  const content = JSON.parse(raw);

  const expiresAt = new Date(content.expires_at).getTime();
  if (Date.now() > expiresAt) return null;

  return content;
}

function listCaches(outputDir, skill) {
  const dir = cacheDir(outputDir);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const entries = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const content = JSON.parse(raw);
    if (skill && content.skill !== skill) continue;
    entries.push(content);
  }

  return entries;
}

function cleanCaches(outputDir, skill) {
  const dir = cacheDir(outputDir);
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  let count = 0;

  for (const file of files) {
    if (skill) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf8');
      const content = JSON.parse(raw);
      if (content.skill !== skill) continue;
    }
    fs.unlinkSync(path.join(dir, file));
    count++;
  }

  return count;
}

module.exports = { writeCache, readCache, listCaches, cleanCaches, cacheDir, cacheFilePath, CACHE_TTL_MS };
