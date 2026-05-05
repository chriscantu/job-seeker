#!/usr/bin/env bun
// Validates that STRUCTURE.md's directory map matches the actual repo and plugin.json.
// Run: bun scripts/validate-structure.ts
// Exit 0 = valid. Exit 1 = issues found.

import * as fs from 'fs';
import * as path from 'path';

interface SkillEntry {
  file?: string;
}

interface PluginManifest {
  skills?: SkillEntry[];
}

const root = path.resolve(__dirname, '..');
const issues: string[] = [];

// --- Parse STRUCTURE.md directory map ---

const structurePath = path.join(root, 'STRUCTURE.md');
if (!fs.existsSync(structurePath)) {
  console.log('✗ STRUCTURE.md not found');
  process.exit(1);
}

const structureContent = fs.readFileSync(structurePath, 'utf8');

const mapMatch = structureContent.match(/## Directory Map\s+```[\s\S]*?^([\s\S]*?)```/m);
if (!mapMatch) {
  console.log('✗ Could not find Directory Map code block in STRUCTURE.md');
  process.exit(1);
}

const mapBlock = mapMatch[1];

const documentedDirs = new Set<string>();
const documentedSkills = new Set<string>();

const lines = mapBlock.split('\n');
let inSkillsBlock = false;

for (const line of lines) {
  const topMatch = line.match(/^[├└]── \.?([\w-]+)\//);
  if (topMatch) {
    documentedDirs.add(topMatch[1]);
    inSkillsBlock = topMatch[1] === 'skills';
    continue;
  }

  if (inSkillsBlock) {
    const skillMatch = line.match(/^│\s+[├└]── ([\w-]+)\//);
    if (skillMatch && skillMatch[1] !== '_shared') {
      documentedSkills.add(skillMatch[1]);
    }
    if (!line.startsWith('│') && line.trim() !== '') {
      inSkillsBlock = false;
    }
  }
}

// --- Check 1: Documented top-level directories exist ---

const optionalDirs = new Set(['output', 'config', 'references', 'tests', 'credentials']);

for (const dir of documentedDirs) {
  if (optionalDirs.has(dir)) continue;
  const dirPath = path.join(root, dir);
  const altPath = path.join(root, '.' + dir);
  if (!fs.existsSync(dirPath) && !fs.existsSync(altPath)) {
    issues.push(`STRUCTURE.md lists directory "${dir}/" but it does not exist`);
  }
}

// --- Check 2: Actual top-level directories not in STRUCTURE.md ---

const ignoredDirs = new Set([
  'node_modules', '.git', '.claude', '.github', '.worktrees', 'docs',
  'config', 'output', 'memory', 'credentials',
]);

const actualDirs = fs.readdirSync(root, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .filter(d => !ignoredDirs.has(d.name))
  .map(d => d.name);

for (const dir of actualDirs) {
  const normalized = dir.replace(/^\./, '');
  if (!documentedDirs.has(dir) && !documentedDirs.has(normalized)) {
    issues.push(`Directory "${dir}/" exists but is not in STRUCTURE.md directory map`);
  }
}

// --- Check 3: Skill directories — STRUCTURE.md vs filesystem ---

const skillsDir = path.join(root, 'skills');
const actualSkills = new Set<string>();
const nonSkillDirs = new Set(['_shared']);
if (fs.existsSync(skillsDir)) {
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !nonSkillDirs.has(entry.name)) {
      actualSkills.add(entry.name);
    }
  }
}

for (const skill of documentedSkills) {
  if (!actualSkills.has(skill)) {
    issues.push(`STRUCTURE.md lists skill "${skill}/" but skills/${skill}/ does not exist`);
  }
}

for (const skill of actualSkills) {
  if (!documentedSkills.has(skill)) {
    issues.push(`skills/${skill}/ exists but is not listed in STRUCTURE.md directory map`);
  }
}

// --- Check 4: Cross-reference plugin.json skills with STRUCTURE.md ---

const pluginPath = path.join(root, '.claude-plugin', 'plugin.json');
if (fs.existsSync(pluginPath)) {
  let plugin: PluginManifest | undefined;
  try {
    plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8')) as PluginManifest;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push(`Could not parse plugin.json: ${msg}`);
  }

  if (plugin && Array.isArray(plugin.skills)) {
    const pluginSkillNames = new Set<string>();
    for (const skill of plugin.skills) {
      const match = skill.file && skill.file.match(/^skills\/([\w-]+)\//);
      if (match) {
        pluginSkillNames.add(match[1]);
      }
    }

    for (const skill of pluginSkillNames) {
      if (!documentedSkills.has(skill)) {
        issues.push(`plugin.json registers skill "${skill}" but it is not in STRUCTURE.md directory map`);
      }
    }

    for (const skill of documentedSkills) {
      if (!pluginSkillNames.has(skill)) {
        issues.push(`STRUCTURE.md lists skill "${skill}/" but it is not registered in plugin.json`);
      }
    }
  }
}

// --- Report ---

if (issues.length === 0) {
  console.log('✓ Structure valid');
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} issue(s) found:\n`);
  issues.forEach(i => console.log(`  ${i}`));
  process.exit(1);
}
