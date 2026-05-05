#!/usr/bin/env bun
// Validates that all files referenced in plugin.json exist.
// Run: bun scripts/validate-plugin-structure.ts
// Exit 0 = valid. Exit 1 = issues found.

import * as fs from 'fs';
import * as path from 'path';
import { errorMessage } from './lib/util';

interface SkillEntry {
  file?: string;
}

interface HookSpec {
  type?: string;
  command?: string;
}

interface HookHandler {
  hooks?: HookSpec[];
}

interface PluginManifest {
  name?: string;
  skills?: SkillEntry[];
  hooks?: string;
}

const root = path.resolve(__dirname, '..');
const issues: string[] = [];

const pluginPath = path.join(root, '.claude-plugin', 'plugin.json');
if (!fs.existsSync(pluginPath)) {
  console.log('✗ .claude-plugin/plugin.json not found');
  process.exit(1);
}

let plugin: PluginManifest;
try {
  plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8')) as PluginManifest;
} catch (err) {
  const msg = errorMessage(err);
  console.log(`✗ .claude-plugin/plugin.json is not valid JSON: ${msg}`);
  process.exit(1);
}

if (!plugin.name) {
  issues.push('plugin.json missing required "name" field');
}

if (Array.isArray(plugin.skills)) {
  for (const skill of plugin.skills) {
    const skillFile = skill.file;
    if (!skillFile) {
      issues.push('plugin.json has a skill entry with no "file" field');
      continue;
    }
    const fullPath = path.join(root, skillFile);
    if (!fs.existsSync(fullPath)) {
      issues.push(`skill file not found: ${skillFile}`);
    }
  }
}

if (plugin.hooks) {
  const hooksPath = path.join(root, plugin.hooks);
  if (!fs.existsSync(hooksPath)) {
    issues.push(`hooks file not found: ${plugin.hooks}`);
  } else {
    try {
      const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as Record<string, unknown>;
      for (const handlers of Object.values(hooks)) {
        if (!Array.isArray(handlers)) continue;
        for (const handler of handlers as HookHandler[]) {
          if (!handler.hooks || !Array.isArray(handler.hooks)) continue;
          for (const hook of handler.hooks) {
            if (hook.type === 'command' && hook.command) {
              const cmd = hook.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, root);
              const parts = cmd.split(/\s+/);
              const scriptPath = parts.find(p => p.startsWith('/') || p.startsWith('./'));
              if (scriptPath && !fs.existsSync(scriptPath)) {
                issues.push(`hook script not found: ${hook.command} (resolved: ${scriptPath})`);
              }
            }
          }
        }
      }
    } catch (err) {
      const msg = errorMessage(err);
      issues.push(`hooks file is not valid JSON: ${msg}`);
    }
  }
}

const commandsDir = path.join(root, 'commands');
if (fs.existsSync(commandsDir)) {
  const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));
  for (const cmd of commands) {
    const content = fs.readFileSync(path.join(commandsDir, cmd), 'utf8');
    if (!content.startsWith('---')) {
      issues.push(`command ${cmd} is missing YAML frontmatter`);
    }
  }
}

if (issues.length === 0) {
  console.log('✓ Plugin structure valid');
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} issue(s) found:\n`);
  issues.forEach(i => console.log(`  ${i}\n`));
  process.exit(1);
}
