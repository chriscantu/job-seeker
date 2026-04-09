#!/usr/bin/env node
// scripts/state.js
// Shared state I/O utility for job-seeker skills.
// Centralizes glob → sort → read → parse → append for state files.
//
// Usage:
//   bun scripts/state.js read seen-postings
//   bun scripts/state.js read preferences
//   bun scripts/state.js append seen-postings '{"company":"...","title":"...","url":"...","posted":"..."}'
//   bun scripts/state.js append preferences '{"section":"...","entries":[...]}'
//   bun scripts/state.js query seen-postings --company natera --not-flagged RESEARCHED
//   bun scripts/state.js dedup-check seen-postings --url "..." --company "..." --title "..."
//   bun scripts/state.js flag seen-postings --url "..." --add RESEARCHED
//
// Exit codes: 0 = success, 1 = error (message on stderr)
// Output: JSON on stdout

const path = require('path');
const seenPostings = require('./lib/seen-postings');
const preferences = require('./lib/preferences');
const applications = require('./lib/applications');
const { resolveStateFile } = require('./lib/util');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'output');

const SEEN_POSTINGS_COMMANDS = ['query', 'dedup-check', 'flag'];
const APPLICATIONS_COMMANDS = ['update', 'add-note', 'create'];

function usage() {
  console.error(`Usage: bun scripts/state.js <command> <type> [args]

Commands:
  read <type> [--stage <stage>]    Read all entries as JSON (--stage filter for applications)
  append <type> '<json>'           Append a validated entry
  query seen-postings [filters]    Filtered read
  dedup-check seen-postings [opts] Check for duplicates
  flag seen-postings --url <url> --add <flag>  Mutate an entry's flags
  create applications '<json>'     Create a new application entry
  update applications --company <name> --stage <stage> [--detail <text>]  Update application stage
  add-note applications --company <name> --note <text>  Append a note to an application

Types: seen-postings, preferences, applications

Query filters:
  --company <name>       Case-insensitive substring match
  --flagged <flag>       Only entries with this flag
  --not-flagged <flag>   Only entries without this flag

Dedup-check options:
  --url <url>            Check for URL match
  --company <name>       Check for company+title match (requires --title)
  --title <title>        Used with --company for fuzzy match

Examples:
  bun scripts/state.js read applications
  bun scripts/state.js read applications --stage Applied
  bun scripts/state.js create applications '{"company":"Acme","title":"VP Eng","stage":"Applied"}'
  bun scripts/state.js update applications --company acme --stage Interviewing
  bun scripts/state.js add-note applications --company acme --note "Great call with CTO"`);
  process.exit(1);
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const nextArg = args[i + 1];
      if (nextArg !== undefined && !nextArg.startsWith('--')) {
        parsed[key] = nextArg;
        i++;
      } else {
        console.error(`Option --${key} requires a value`);
        process.exit(1);
      }
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

  if (!['seen-postings', 'preferences', 'applications'].includes(type)) {
    console.error(`Unknown type: ${type}. Must be "seen-postings", "preferences", or "applications".`);
    process.exit(1);
  }

  if (SEEN_POSTINGS_COMMANDS.includes(command) && type !== 'seen-postings') {
    console.error(`${command} is only supported for seen-postings`);
    process.exit(1);
  }

  if (APPLICATIONS_COMMANDS.includes(command) && type !== 'applications') {
    console.error(`${command} is only supported for applications`);
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
        handleQuery(args.slice(2));
        break;
      case 'dedup-check':
        handleDedupCheck(args.slice(2));
        break;
      case 'flag':
        handleFlag(args.slice(2));
        break;
      case 'update':
        handleUpdate(args.slice(2));
        break;
      case 'add-note':
        handleAddNote(args.slice(2));
        break;
      case 'create':
        handleCreate(type, args[2]);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        usage();
    }
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
}

function handleRead(type) {
  if (type === 'seen-postings') {
    const entries = seenPostings.parseSeenPostings(OUTPUT_DIR);
    console.log(JSON.stringify(entries, null, 2));
  } else if (type === 'preferences') {
    const file = resolveStateFile(OUTPUT_DIR, 'preferences');
    if (!file) {
      console.log(JSON.stringify({ last_run_date: null, sections: {}, tables: [] }));
      return;
    }
    const result = preferences.parsePreferencesFile(file);
    console.log(JSON.stringify(result, null, 2));
  } else if (type === 'applications') {
    const data = applications.parseApplications(OUTPUT_DIR);
    const opts = parseArgs(process.argv.slice(4));
    let entries = [...data.active, ...data.closed];
    if (opts.stage) {
      entries = entries.filter(e => e.stage === opts.stage);
    }
    console.log(JSON.stringify(entries, null, 2));
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
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
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

function handleQuery(remainingArgs) {
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

function handleUpdate(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.company) {
    console.error('update requires --company');
    process.exit(1);
  }
  if (!opts.stage) {
    console.error('update requires --stage');
    process.exit(1);
  }
  applications.updateApplication(OUTPUT_DIR, {
    company: opts.company,
    stage: opts.stage,
    detail: opts.detail || null,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleAddNote(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.company) {
    console.error('add-note requires --company');
    process.exit(1);
  }
  if (!opts.note) {
    console.error('add-note requires --note');
    process.exit(1);
  }
  applications.addNote(OUTPUT_DIR, {
    company: opts.company,
    note: opts.note,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleCreate(type, jsonStr) {
  if (!jsonStr) {
    console.error('create requires a JSON argument');
    process.exit(1);
  }
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
    process.exit(1);
  }
  applications.createApplication(OUTPUT_DIR, entry);
  console.log(JSON.stringify({ success: true }));
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
