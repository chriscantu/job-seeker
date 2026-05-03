#!/usr/bin/env node
// scripts/validate-links.js
// Validates that backtick-quoted file paths in markdown files resolve to real files.
// Run: bun scripts/validate-links.js
// Exit 0 = valid. Exit 1 = broken links found.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const issues = [];

// Directories/paths that are gitignored — references to these are expected to
// not exist in CI or fresh clones.
const ignoredPrefixes = [
  'output/',
  'memory/',
  'config/candidate.md',
  'config/search.md',
  'references/',
  'integrations/config/',
  '.claude/',
  'credentials/',
];

// Directories to skip when scanning for markdown source files (basename match).
const skipDirs = new Set(['node_modules', '.git', 'output', 'memory', '.worktrees']);

// Markdown source prefixes (relative to repo root) to skip wholesale.
// Plans and specs describe future state — paths reference files yet to be created.
const skipSourcePrefixes = [
  'docs/superpowers/plans/',
  'docs/superpowers/specs/',
];

function isIgnoredPath(filePath) {
  return ignoredPrefixes.some(prefix => filePath.startsWith(prefix));
}

function collectMarkdownFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

// Match backtick-quoted paths that look like file references:
// - Must contain a / or end with a known extension
// - Must not be a code snippet, URL, or shell command
const pathPattern = /`([^`\n]+?\.\w{1,5})`/g;
const extensions = new Set(['md', 'js', 'json', 'yml', 'yaml', 'ts', 'pdf', 'txt']);

function looksLikeFilePath(ref) {
  // Must have a directory separator or be a root-level file with known extension
  const ext = ref.split('.').pop();
  if (!extensions.has(ext)) return false;
  // Filter out things that aren't paths
  if (ref.includes('://')) return false;   // URLs
  if (ref.includes(' ')) return false;      // prose or commands
  if (ref.startsWith('-')) return false;     // flags
  if (ref.startsWith('$')) return false;     // variables
  if (ref.includes('*')) return false;       // globs
  if (ref.includes('{')) return false;       // template/placeholder paths
  // Must contain a / — bare filenames are relative references that can't be
  // validated without directory context and produce too many false positives.
  if (!ref.includes('/')) return false;
  return true;
}

const allMdFiles = collectMarkdownFiles(root);
const mdFiles = allMdFiles.filter(file => {
  const rel = path.relative(root, file);
  return !skipSourcePrefixes.some(prefix => rel.startsWith(prefix));
});
const skippedCount = allMdFiles.length - mdFiles.length;

for (const mdFile of mdFiles) {
  const relSource = path.relative(root, mdFile);
  let content;
  try {
    content = fs.readFileSync(mdFile, 'utf8');
  } catch (err) {
    issues.push(`${relSource}: could not read file (${err.code})`);
    continue;
  }
  let match;

  pathPattern.lastIndex = 0;
  while ((match = pathPattern.exec(content)) !== null) {
    const ref = match[1];
    if (!looksLikeFilePath(ref)) continue;

    // Strip .example suffix for existence check — the template may be the
    // committed form of a gitignored file.
    const normalized = ref.replace(/\.example$/, '');

    if (isIgnoredPath(normalized)) continue;

    // Try repo-root-relative first (most paths in this project), then
    // fall back to source-file-relative resolution.
    const fromRoot = path.join(root, ref);
    const fromSource = path.join(path.dirname(mdFile), ref);
    if (!fs.existsSync(fromRoot) && !fs.existsSync(fromSource)) {
      issues.push(`${relSource}: broken reference \`${ref}\``);
    }
  }
}

// --- Report ---

if (issues.length === 0) {
  console.log(`✓ All links valid (scanned ${mdFiles.length} files, skipped ${skippedCount} plan/spec files)`);
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} broken link(s) found:\n`);
  issues.forEach(i => console.log(`  ${i}`));
  process.exit(1);
}