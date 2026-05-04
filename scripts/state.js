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
//   bun scripts/state.js stale-applications applications [--today YYYY-MM-DD] [--warn N] [--alert N]
//   bun scripts/state.js flag-for-review applications '{...}'
//   bun scripts/state.js mark-status-changed applications '{...}'
//   bun scripts/state.js infer-stage applications --from "<text>"
//
// Exit codes: 0 = success, 1 = error (message on stderr)
// Output: JSON on stdout

const path = require('path');
const seenPostings = require('./lib/seen-postings');
const preferences = require('./lib/preferences');
const applications = require('./lib/applications');
const { inferStage } = require('./lib/stage-inference');
const { resolveStateFile } = require('./lib/util');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'output');

const SEEN_POSTINGS_COMMANDS = ['query', 'dedup-check', 'flag'];
const APPLICATIONS_COMMANDS = ['update', 'add-note', 'create', 'close', 'reopen', 'stale-applications', 'flag-for-review', 'mark-status-changed', 'infer-stage'];

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
  close applications --company <name> --reason <reason> [--summary <text>]  Close an application
  reopen applications --company <name> --stage <stage> [--detail <text>]  Reopen a closed application
  add-note applications --company <name> --note <text>  Append a note to an application
  stale-applications applications [--today YYYY-MM-DD] [--warn N] [--alert N]  Active entries enriched with daysSinceLastActivity
  flag-for-review applications '<json>'  Append a flagged-for-review entry
  mark-status-changed applications '<json>'  Apply a status-change classifier result
  infer-stage applications --from "<text>"  Infer canonical stage from natural-language activity text

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
  bun scripts/state.js update applications --company acme --stage Screen
  bun scripts/state.js close applications --company acme --reason rejected --summary "No response"
  bun scripts/state.js reopen applications --company acme --stage Screen --detail "Recruiter reached out"
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
      case 'close':
        handleClose(args.slice(2));
        break;
      case 'reopen':
        handleReopen(args.slice(2));
        break;
      case 'create':
        handleCreate(type, args[2]);
        break;
      case 'stale-applications':
        handleStaleApplications(args.slice(2));
        break;
      case 'flag-for-review':
        handleFlagForReview(type, args[2]);
        break;
      case 'mark-status-changed':
        handleMarkStatusChanged(type, args[2]);
        break;
      case 'infer-stage':
        handleInferStage(args.slice(2));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        usage();
    }
  } catch (err) {
    // Default: clean message only (CLI users shouldn't see internal frames).
    // Set DEBUG=1 to get the full stack for troubleshooting.
    if (process.env.DEBUG) {
      console.error(err.stack || err.message);
    } else {
      console.error(err.message || String(err));
    }
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
    const file = resolveStateFile(OUTPUT_DIR, 'applications');
    if (!file) {
      console.error('No applications file found in output/');
      console.log(JSON.stringify([], null, 2));
      return;
    }
    const data = applications.parseApplicationsFile(file);
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

  if (type === 'applications') {
    console.error('append is not supported for applications. Use "create" instead.');
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

function handleClose(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.company) {
    console.error('close requires --company');
    process.exit(1);
  }
  if (!opts.reason) {
    console.error('close requires --reason');
    process.exit(1);
  }
  applications.closeApplication(OUTPUT_DIR, {
    company: opts.company,
    reason: opts.reason,
    summary: opts.summary || null,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleReopen(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.company) {
    console.error('reopen requires --company');
    process.exit(1);
  }
  if (!opts.stage) {
    console.error('reopen requires --stage');
    process.exit(1);
  }
  applications.reopenApplication(OUTPUT_DIR, {
    company: opts.company,
    stage: opts.stage,
    detail: opts.detail || null,
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

function handleInferStage(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  if (!opts.from) {
    console.error('infer-stage requires --from "<text>"');
    process.exit(1);
  }
  const stage = inferStage(opts.from);
  console.log(JSON.stringify({ stage }));
}

function handleMarkStatusChanged(type, jsonStr) {
  if (!jsonStr) {
    console.error('mark-status-changed requires a JSON argument');
    process.exit(1);
  }
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
    process.exit(1);
  }
  const result = applications.markStatusChanged(OUTPUT_DIR, entry);
  console.log(JSON.stringify({ success: true, ...result }));
}

function handleFlagForReview(type, jsonStr) {
  if (!jsonStr) {
    console.error('flag-for-review requires a JSON argument');
    process.exit(1);
  }
  let entry;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    console.error(`Invalid JSON argument: ${err.message}`);
    process.exit(1);
  }
  const result = applications.flagForReview(OUTPUT_DIR, entry);
  console.log(JSON.stringify({ success: true, ...result }));
}

function parseIntegerOpt(opts, name) {
  if (opts[name] === undefined) return undefined;
  const n = Number(opts[name]);
  if (!Number.isInteger(n)) {
    console.error(`--${name} must be an integer`);
    process.exit(1);
  }
  return n;
}

function handleStaleApplications(remainingArgs) {
  const opts = parseArgs(remainingArgs);
  const aggregatorOpts = {};
  if (opts.today) aggregatorOpts.today = opts.today;
  const warn = parseIntegerOpt(opts, 'warn');
  if (warn !== undefined) aggregatorOpts.warn = warn;
  const alert = parseIntegerOpt(opts, 'alert');
  if (alert !== undefined) aggregatorOpts.alert = alert;
  const result = applications.staleApplications(OUTPUT_DIR, aggregatorOpts);
  console.log(JSON.stringify(result, null, 2));
}

main();
