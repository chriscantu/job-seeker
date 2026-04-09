#!/usr/bin/env node
// scripts/validate-plugin-structure.js
// Validates that all files referenced in plugin.json exist.
// Run: bun scripts/validate-plugin-structure.js
// Exit 0 = valid. Exit 1 = issues found.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const issues = [];

// Load and validate plugin.json
const pluginPath = path.join(root, '.claude-plugin', 'plugin.json');
if (!fs.existsSync(pluginPath)) {
  console.log('✗ .claude-plugin/plugin.json not found');
  process.exit(1);
}

let plugin;
try {
  plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
} catch (err) {
  console.log(`✗ .claude-plugin/plugin.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

// Check required fields
if (!plugin.name) {
  issues.push('plugin.json missing required "name" field');
}

// Check all skill file references exist
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

// Check hooks file reference exists
if (plugin.hooks) {
  const hooksPath = path.join(root, plugin.hooks);
  if (!fs.existsSync(hooksPath)) {
    issues.push(`hooks file not found: ${plugin.hooks}`);
  } else {
    // Validate hooks.json is parseable
    try {
      const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
      // Check that command hook scripts exist
      for (const [event, handlers] of Object.entries(hooks)) {
        if (!Array.isArray(handlers)) continue;
        for (const handler of handlers) {
          if (!handler.hooks || !Array.isArray(handler.hooks)) continue;
          for (const hook of handler.hooks) {
            if (hook.type === 'command' && hook.command) {
              // Extract script path from command (handles ${CLAUDE_PLUGIN_ROOT} prefix)
              const cmd = hook.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, root);
              const parts = cmd.split(/\s+/);
              // Find the script path (skip 'node' or other interpreters)
              const scriptPath = parts.find(p => p.startsWith('/') || p.startsWith('./'));
              if (scriptPath && !fs.existsSync(scriptPath)) {
                issues.push(`hook script not found: ${hook.command} (resolved: ${scriptPath})`);
              }
            }
          }
        }
      }
    } catch (err) {
      issues.push(`hooks file is not valid JSON: ${err.message}`);
    }
  }
}

// Check commands directory
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

// Report
if (issues.length === 0) {
  console.log('✓ Plugin structure valid');
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} issue(s) found:\n`);
  issues.forEach(i => console.log(`  ${i}\n`));
  process.exit(1);
}
