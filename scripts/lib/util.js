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

module.exports = { resolveStateFile, atomicWriteFileSync, ensureDir };
