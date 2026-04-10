#!/usr/bin/env node
// scripts/cache.js
// Phase cache utility for resumable skill execution.
//
// Usage:
//   bun scripts/cache.js read <skill> <phase>
//   bun scripts/cache.js write <skill> <phase> '<json>'
//   bun scripts/cache.js list [skill]
//   bun scripts/cache.js clean [skill]
//
// Exit codes: 0 = success, 1 = error or cache miss
// Output: JSON on stdout (read, write) or text (list, clean)

const path = require('path');
const { readCache, writeCache, listCaches, cleanCaches } = require('./lib/cache');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'output');

function usage() {
  console.error(`Usage: bun scripts/cache.js <command> [args]

Commands:
  read <skill> <phase>           Read cached phase result (exit 1 if miss/expired)
  write <skill> <phase> '<json>' Write phase result to cache
  list [skill]                   List active cache entries
  clean [skill]                  Remove cache files`);
  process.exit(1);
}

function formatAge(cachedAt) {
  const ms = Date.now() - new Date(cachedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const command = args[0];

  try {
    switch (command) {
      case 'read': {
        if (args.length < 3) {
          console.error('read requires <skill> <phase>');
          process.exit(1);
        }
        const result = readCache(OUTPUT_DIR, args[1], args[2]);
        if (!result) process.exit(1);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'write': {
        if (args.length < 4) {
          console.error('write requires <skill> <phase> <json>');
          process.exit(1);
        }
        let data;
        try {
          data = JSON.parse(args[3]);
        } catch (err) {
          console.error(`Invalid JSON: ${err.message}`);
          process.exit(1);
        }
        writeCache(OUTPUT_DIR, args[1], args[2], data);
        console.log(JSON.stringify({ success: true }));
        break;
      }
      case 'list': {
        const entries = listCaches(OUTPUT_DIR, args[1] || undefined);
        if (entries.length === 0) {
          console.log('No cache entries found');
        } else {
          for (const entry of entries) {
            console.log(`${entry.skill}/${entry.phase}  ${entry.cached_at.slice(0, 16).replace('T', ' ')}  (${formatAge(entry.cached_at)})`);
          }
        }
        break;
      }
      case 'clean': {
        const count = cleanCaches(OUTPUT_DIR, args[1] || undefined);
        console.log(`Removed ${count} cache file${count !== 1 ? 's' : ''}`);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        usage();
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
