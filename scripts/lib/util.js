const fs = require('fs');
const path = require('path');
const os = require('os');

function resolveStateFile(dir, type) {
  if (!fs.existsSync(dir)) return null;
  const pattern = new RegExp(`\\d{4}-\\d{2}-\\d{2}-${type}\\.md$`);
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function atomicWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  const tmpFile = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmpFile, content);
  fs.renameSync(tmpFile, filePath);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Returns today's date as YYYY-MM-DD in UTC. Centralizes the convention so
// daysBetween (which interprets dates as UTC midnights) composes correctly
// with all "today" defaults across the lib. Don't switch to
// toLocaleDateString() or new Date().getDate() — local-tz output would
// off-by-one around the local midnight boundary, hard to reproduce in tests.
function getTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { resolveStateFile, atomicWriteFileSync, ensureDir, getTodayUtc };
