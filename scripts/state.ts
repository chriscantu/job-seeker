#!/usr/bin/env bun
// Shared state I/O utility for job-seeker skills.
// Centralizes glob → sort → read → parse → append for state files.
//
// Usage:
//   bun scripts/state.ts read seen-postings
//   bun scripts/state.ts read preferences
//   bun scripts/state.ts append seen-postings '{"company":"...","title":"...","url":"...","posted":"..."}'
//   bun scripts/state.ts append preferences '{"section":"...","entries":[...]}'
//   bun scripts/state.ts query seen-postings --company natera --not-flagged RESEARCHED
//   bun scripts/state.ts dedup-check seen-postings --url "..." --company "..." --title "..."
//   bun scripts/state.ts flag seen-postings --url "..." --add RESEARCHED
//   bun scripts/state.ts stale-applications applications [--today YYYY-MM-DD] [--warn N] [--alert N]
//   bun scripts/state.ts flag-for-review applications '{...}'
//   bun scripts/state.ts mark-status-changed applications '{...}'
//   bun scripts/state.ts infer-stage applications --from "<text>"
//
// Exit codes: 0 = success, 1 = error (message on stderr)
// Output: JSON on stdout
//
// JSON formatting rule:
//   - Read / query / dedup-check / stale-applications  → pretty (indent: 2)
//     Returned shape is array-of-objects or nested object intended for ad-hoc
//     terminal inspection. Pretty-printed for readability.
//   - Mutation acks (append, flag, create, update, close, reopen, add-note,
//     flag-for-review, mark-status-changed) and small one-line shapes
//     (infer-stage)                                    → compact (no indent)
//     Returned shape is a `{ success: true, ... }` ack or one-key object
//     intended to be parsed by skill orchestrators, not read by humans.
//
//   Both forms parse identically with JSON.parse — the rule is for human UX
//   at the CLI, not machine consumers. New handlers should follow this rule.

import * as path from 'path';
import * as seenPostings from './lib/seen-postings';
import * as preferences from './lib/preferences';
import * as applications from './lib/applications';
import { inferStage } from './lib/stage-inference';
import { resolveStateFile } from './lib/util';

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'output');

const STATE_TYPES = ['seen-postings', 'preferences', 'applications'] as const;
type StateType = typeof STATE_TYPES[number];

type ArgShape = 'type' | 'type+json' | 'json' | 'remaining';

interface CommandSpec {
  handler: (...args: never[]) => void;
  argShape: ArgShape;
  allowedTypes?: readonly StateType[];
}

// Command dispatch table. Each entry describes how main() routes the command:
//   handler:     the function to invoke
//   argShape:    'type' | 'type+json' | 'remaining' | 'json'
//                'type'       → handler(type)
//                'type+json'  → handler(type, args[2])
//                'remaining'  → handler(args.slice(2))
//                'json'       → handler(args[2])
//   allowedTypes (optional): if set, type must be in this list — otherwise
//                we exit with "<command> is only supported for <allowedTypes[0]>"
//
// Adding a new subcommand = one entry here. No parallel membership arrays.
const COMMANDS: Record<string, CommandSpec> = {
  'read':                { handler: handleRead as never,                argShape: 'type' },
  'append':              { handler: handleAppend as never,              argShape: 'type+json' },
  'query':               { handler: handleQuery as never,               argShape: 'remaining', allowedTypes: ['seen-postings'] },
  'dedup-check':         { handler: handleDedupCheck as never,          argShape: 'remaining', allowedTypes: ['seen-postings'] },
  'flag':                { handler: handleFlag as never,                argShape: 'remaining', allowedTypes: ['seen-postings'] },
  'update':              { handler: handleUpdate as never,              argShape: 'remaining', allowedTypes: ['applications'] },
  'add-note':            { handler: handleAddNote as never,             argShape: 'remaining', allowedTypes: ['applications'] },
  'close':               { handler: handleClose as never,               argShape: 'remaining', allowedTypes: ['applications'] },
  'reopen':              { handler: handleReopen as never,              argShape: 'remaining', allowedTypes: ['applications'] },
  'create':              { handler: handleCreate as never,              argShape: 'json',      allowedTypes: ['applications'] },
  'stale-applications':  { handler: handleStaleApplications as never,   argShape: 'remaining', allowedTypes: ['applications'] },
  'flag-for-review':     { handler: handleFlagForReview as never,       argShape: 'json',      allowedTypes: ['applications'] },
  'mark-status-changed': { handler: handleMarkStatusChanged as never,   argShape: 'json',      allowedTypes: ['applications'] },
  'infer-stage':         { handler: handleInferStage as never,          argShape: 'remaining', allowedTypes: ['applications'] },
};

function usage(): never {
  console.error(`Usage: bun scripts/state.ts <command> <type> [args]

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
  infer-stage applications --from "<text>"  Infer canonical stage from natural-language activity text (pure function — type token ignored)

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
  bun scripts/state.ts read applications
  bun scripts/state.ts read applications --stage Applied
  bun scripts/state.ts create applications '{"company":"Acme","title":"VP Eng","stage":"Applied"}'
  bun scripts/state.ts update applications --company acme --stage Screen
  bun scripts/state.ts close applications --company acme --reason rejected --summary "No response"
  bun scripts/state.ts reopen applications --company acme --stage Screen --detail "Recruiter reached out"
  bun scripts/state.ts add-note applications --company acme --note "Great call with CTO"`);
  process.exit(1);
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
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

function isStateType(t: string): t is StateType {
  return (STATE_TYPES as readonly string[]).includes(t);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    usage();
  }

  const command = args[0];
  const type = args[1];

  if (!isStateType(type)) {
    console.error(`Unknown type: ${type}. Must be "seen-postings", "preferences", or "applications".`);
    process.exit(1);
  }

  const entry = COMMANDS[command];
  if (!entry) {
    console.error(`Unknown command: ${command}`);
    usage();
  }

  if (entry.allowedTypes && !entry.allowedTypes.includes(type)) {
    console.error(`${command} is only supported for ${entry.allowedTypes[0]}`);
    process.exit(1);
  }

  try {
    switch (entry.argShape) {
      case 'type':
        (entry.handler as (t: StateType) => void)(type);
        break;
      case 'type+json':
        (entry.handler as (t: StateType, j: string | undefined) => void)(type, args[2]);
        break;
      case 'json':
        (entry.handler as (j: string | undefined) => void)(args[2]);
        break;
      case 'remaining':
        (entry.handler as (r: string[]) => void)(args.slice(2));
        break;
    }
  } catch (err) {
    // Default: clean message only (CLI users shouldn't see internal frames).
    // Set DEBUG=1 to get the full stack for troubleshooting.
    if (process.env.DEBUG) {
      console.error(err instanceof Error ? (err.stack || err.message) : String(err));
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  }
}

function handleRead(type: StateType): void {
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

function handleAppend(type: StateType, jsonStr: string | undefined): void {
  if (!jsonStr) {
    console.error('append requires a JSON argument');
    process.exit(1);
  }

  let entry: unknown;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Invalid JSON argument: ${msg}`);
    process.exit(1);
  }

  if (type === 'applications') {
    console.error('append is not supported for applications. Use "create" instead.');
    process.exit(1);
  }

  if (type === 'seen-postings') {
    seenPostings.appendSeenPosting(OUTPUT_DIR, entry as seenPostings.SeenPostingEntry);
    console.log(JSON.stringify({ success: true }));
  } else if (type === 'preferences') {
    preferences.appendPreferences(OUTPUT_DIR, entry as preferences.PreferencesEntry);
    console.log(JSON.stringify({ success: true }));
  }
}

function handleQuery(remainingArgs: string[]): void {
  const opts = parseArgs(remainingArgs);
  const filters: seenPostings.SeenPostingsFilters = {};

  if (opts.company) filters.company = opts.company;
  if (opts.flagged) filters.flagged = opts.flagged;
  if (opts['not-flagged']) filters.notFlagged = opts['not-flagged'];

  const results = seenPostings.querySeenPostings(OUTPUT_DIR, filters);
  console.log(JSON.stringify(results, null, 2));
}

function handleDedupCheck(remainingArgs: string[]): void {
  const opts = parseArgs(remainingArgs);

  const result = seenPostings.dedupCheck(OUTPUT_DIR, {
    url: opts.url || undefined,
    company: opts.company || undefined,
    title: opts.title || undefined,
  });
  console.log(JSON.stringify(result, null, 2));
}

function handleUpdate(remainingArgs: string[]): void {
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
    detail: opts.detail || undefined,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleAddNote(remainingArgs: string[]): void {
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

function handleClose(remainingArgs: string[]): void {
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
    summary: opts.summary || undefined,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleReopen(remainingArgs: string[]): void {
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
    detail: opts.detail || undefined,
  });
  console.log(JSON.stringify({ success: true }));
}

function handleCreate(jsonStr: string | undefined): void {
  if (!jsonStr) {
    console.error('create requires a JSON argument');
    process.exit(1);
  }
  let entry: unknown;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Invalid JSON argument: ${msg}`);
    process.exit(1);
  }
  applications.createApplication(OUTPUT_DIR, entry as applications.CreateApplicationInput);
  console.log(JSON.stringify({ success: true }));
}

function handleFlag(remainingArgs: string[]): void {
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

function handleInferStage(remainingArgs: string[]): void {
  const opts = parseArgs(remainingArgs);
  if (!opts.from) {
    console.error('infer-stage requires --from "<text>"');
    process.exit(1);
  }
  const stage = inferStage(opts.from);
  console.log(JSON.stringify({ stage }));
}

function handleMarkStatusChanged(jsonStr: string | undefined): void {
  if (!jsonStr) {
    console.error('mark-status-changed requires a JSON argument');
    process.exit(1);
  }
  let entry: unknown;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Invalid JSON argument: ${msg}`);
    process.exit(1);
  }
  const result = applications.markStatusChanged(OUTPUT_DIR, entry as Parameters<typeof applications.markStatusChanged>[1]);
  console.log(JSON.stringify({ success: true, ...result }));
}

function handleFlagForReview(jsonStr: string | undefined): void {
  if (!jsonStr) {
    console.error('flag-for-review requires a JSON argument');
    process.exit(1);
  }
  let entry: unknown;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Invalid JSON argument: ${msg}`);
    process.exit(1);
  }
  const result = applications.flagForReview(OUTPUT_DIR, entry as Parameters<typeof applications.flagForReview>[1]);
  console.log(JSON.stringify({ success: true, ...result }));
}

function parseIntegerOpt(opts: Record<string, string>, name: string): number | undefined {
  if (opts[name] === undefined) return undefined;
  const n = Number(opts[name]);
  if (!Number.isInteger(n)) {
    console.error(`--${name} must be an integer`);
    process.exit(1);
  }
  return n;
}

function handleStaleApplications(remainingArgs: string[]): void {
  const opts = parseArgs(remainingArgs);
  const aggregatorOpts: Parameters<typeof applications.staleApplications>[1] = {};
  if (opts.today) aggregatorOpts.today = opts.today;
  const warn = parseIntegerOpt(opts, 'warn');
  if (warn !== undefined) aggregatorOpts.warn = warn;
  const alert = parseIntegerOpt(opts, 'alert');
  if (alert !== undefined) aggregatorOpts.alert = alert;
  const result = applications.staleApplications(OUTPUT_DIR, aggregatorOpts);
  console.log(JSON.stringify(result, null, 2));
}

main();
