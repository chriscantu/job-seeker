#!/usr/bin/env node
// scripts/state.js
// Shared state I/O utility for job-seeker skills.
// Centralizes glob → sort → read → parse → append for state files.
//
// Usage:
//   node scripts/state.js read seen-postings
//   node scripts/state.js read preferences
//   node scripts/state.js append seen-postings '{"company":"...","title":"...","url":"...","posted":"..."}'
//   node scripts/state.js append preferences '{"section":"...","entries":[...]}'
//   node scripts/state.js query seen-postings --company natera --not-flagged RESEARCHED
//   node scripts/state.js dedup-check seen-postings --url "..." --company "..." --title "..."
//   node scripts/state.js flag seen-postings --url "..." --add RESEARCHED
//
// Exit codes: 0 = success, 1 = error (message on stderr)
// Output: JSON on stdout

const path = require('path');
const seenPostings = require('./lib/seen-postings');
const preferences = require('./lib/preferences');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

function usage() {
  console.error(`Usage: node scripts/state.js <command> <type> [args]

Commands:
  read <type>                      Read all entries as JSON
  append <type> '<json>'           Append a validated entry
  query seen-postings [filters]    Filtered read
  dedup-check seen-postings [opts] Check for duplicates
  flag seen-postings --url <url> --add <flag>  Mutate an entry's flags

Types: seen-postings, preferences

Query filters:
  --company <name>       Case-insensitive substring match
  --flagged <flag>       Only entries with this flag
  --not-flagged <flag>   Only entries without this flag

Dedup-check options:
  --url <url>            Check for URL match
  --company <name>       Check for company+title match (requires --title)
  --title <title>        Used with --company for fuzzy match`);
  process.exit(1);
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = value;
      if (value !== true) i++;
    }
  }
  return parsed;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const command = args[0];
  const type = args[1];

  if (!['seen-postings', 'preferences'].includes(type)) {
    console.error(`Unknown type: ${type}. Must be "seen-postings" or "preferences".`);
    process.exit(1);
  }

  try {
    switch (command) {
      case 'read':
        handleRead(type);
        break;
      case 'append':
        handleAppend(type, args[2]);
        break;
      case 'query':
        handleQuery(type, args.slice(2));
        break;
      case 'dedup-check':
        handleDedupCheck(args.slice(2));
        break;
      case 'flag':
        handleFlag(args.slice(2));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        usage();
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

function handleRead(type) {
  if (type === 'seen-postings') {
    const entries = seenPostings.parseSeenPostings(OUTPUT_DIR);
    console.log(JSON.stringify(entries, null, 2));
  } else if (type === 'preferences') {
    const file = preferences.resolveStateFile(OUTPUT_DIR, 'preferences');
    if (!file) {
      console.log(JSON.stringify({ last_run_date: null, sections: {}, tables: [] }));
      return;
    }
    const result = preferences.parsePreferencesFile(file);
    console.log(JSON.stringify(result, null, 2));
  }
}

function handleAppend(type, jsonStr) {
  if (!jsonStr) {
    console.error('append requires a JSON argument');
    process.exit(1);
  }

  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch {
    console.error('Invalid JSON argument');
    process.exit(1);
  }

  if (type === 'seen-postings') {
    seenPostings.appendSeenPosting(OUTPUT_DIR, entry);
    console.log(JSON.stringify({ success: true }));
  } else if (type === 'preferences') {
    preferences.appendPreferences(OUTPUT_DIR, entry);
    console.log(JSON.stringify({ success: true }));
  }
}

function handleQuery(type, remainingArgs) {
  if (type !== 'seen-postings') {
    console.error('query is only supported for seen-postings');
    process.exit(1);
  }

  const opts = parseArgs(remainingArgs);
  const filters = {};

  if (opts.company) filters.company = opts.company;
  if (opts.flagged) filters.flagged = opts.flagged;
  if (opts['not-flagged']) filters.notFlagged = opts['not-flagged'];

  const results = seenPostings.querySeenPostings(OUTPUT_DIR, filters);
  console.log(JSON.stringify(results, null, 2));
}

function handleDedupCheck(remainingArgs) {
  const opts = parseArgs(remainingArgs);

  const result = seenPostings.dedupCheck(OUTPUT_DIR, {
    url: opts.url || null,
    company: opts.company || null,
    title: opts.title || null,
  });
  console.log(JSON.stringify(result, null, 2));
}

function handleFlag(remainingArgs) {
  const opts = parseArgs(remainingArgs);

  if (!opts.url) {
    console.error('flag requires --url');
    process.exit(1);
  }
  if (!opts.add) {
    console.error('flag requires --add <flag>');
    process.exit(1);
  }

  const result = seenPostings.flagSeenPosting(OUTPUT_DIR, opts.url, opts.add);
  if (!result.success) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(JSON.stringify(result));
}

main();
