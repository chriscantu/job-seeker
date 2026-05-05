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
import { resolveStateFile, errorMessage, errorStackOrMessage } from './lib/util';

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'output');

const STATE_TYPES = ['seen-postings', 'preferences', 'applications'] as const;
type StateType = typeof STATE_TYPES[number];

// Command dispatch table — discriminated union by argShape so the type checker
// can verify each handler matches the args main() forwards. Adding a new
// subcommand = one entry here; the union forces handler signature alignment.
//
// argShape semantics:
//   'type'           → handler(type)
//   'type+json'      → handler(type, args[2])
//   'json'           → handler(args[2])
//   'remaining'      → handler(args.slice(2))
//   'type+remaining' → handler(type, args.slice(2))   [used by read for --stage]
//
// allowedTypes (optional): if set, type must be in this list — otherwise main
// exits with "<command> is only supported for <allowedTypes[0]>".
type CommandSpec =
  | { argShape: 'type';           handler: (t: StateType) => void;                          allowedTypes?: readonly StateType[] }
  | { argShape: 'type+json';      handler: (t: StateType, j: string | undefined) => void;   allowedTypes?: readonly StateType[] }
  | { argShape: 'json';           handler: (j: string | undefined) => void;                 allowedTypes?: readonly StateType[] }
  | { argShape: 'remaining';      handler: (r: string[]) => void;                           allowedTypes?: readonly StateType[] }
  | { argShape: 'type+remaining'; handler: (t: StateType, r: string[]) => void;             allowedTypes?: readonly StateType[] };

const COMMANDS: Record<string, CommandSpec> = {
  'read':                { argShape: 'type+remaining', handler: handleRead },
  'append':              { argShape: 'type+json',      handler: handleAppend },
  'query':               { argShape: 'remaining',      handler: handleQuery,               allowedTypes: ['seen-postings'] },
  'dedup-check':         { argShape: 'remaining',      handler: handleDedupCheck,          allowedTypes: ['seen-postings'] },
  'flag':                { argShape: 'remaining',      handler: handleFlag,                allowedTypes: ['seen-postings'] },
  'update':              { argShape: 'remaining',      handler: handleUpdate,              allowedTypes: ['applications'] },
  'add-note':            { argShape: 'remaining',      handler: handleAddNote,             allowedTypes: ['applications'] },
  'close':               { argShape: 'remaining',      handler: handleClose,               allowedTypes: ['applications'] },
  'reopen':              { argShape: 'remaining',      handler: handleReopen,              allowedTypes: ['applications'] },
  'create':              { argShape: 'json',           handler: handleCreate,              allowedTypes: ['applications'] },
  'stale-applications':  { argShape: 'remaining',      handler: handleStaleApplications,   allowedTypes: ['applications'] },
  'flag-for-review':     { argShape: 'json',           handler: handleFlagForReview,       allowedTypes: ['applications'] },
  'mark-status-changed': { argShape: 'json',           handler: handleMarkStatusChanged,   allowedTypes: ['applications'] },
  'infer-stage':         { argShape: 'remaining',      handler: handleInferStage,          allowedTypes: ['applications'] },
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

// Narrows JSON-parsed unknown to a string-keyed record at the CLI boundary.
// Lib functions then runtime-validate field shapes and throw with a precise
// error — this just stops the type checker lying about the cast site.
function parseJsonArg(jsonStr: string | undefined, label: string): Record<string, unknown> {
  if (!jsonStr) {
    console.error(`${label} requires a JSON argument`);
    process.exit(1);
  }
  let entry: unknown;
  try {
    entry = JSON.parse(jsonStr);
  } catch (err) {
    const msg = errorMessage(err);
    console.error(`Invalid JSON argument: ${msg}`);
    process.exit(1);
  }
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    console.error(`${label}: JSON argument must be an object, got ${Array.isArray(entry) ? 'array' : typeof entry}`);
    process.exit(1);
  }
  return entry as Record<string, unknown>;
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
        entry.handler(type);
        break;
      case 'type+json':
        entry.handler(type, args[2]);
        break;
      case 'json':
        entry.handler(args[2]);
        break;
      case 'remaining':
        entry.handler(args.slice(2));
        break;
      case 'type+remaining':
        entry.handler(type, args.slice(2));
        break;
    }
  } catch (err) {
    // Default: clean message only (CLI users shouldn't see internal frames).
    // Set DEBUG=1 to get the full stack for troubleshooting.
    if (process.env.DEBUG) {
      console.error(errorStackOrMessage(err));
    } else {
      console.error(errorMessage(err));
    }
    process.exit(1);
  }
}

function handleRead(type: StateType, remainingArgs: string[]): void {
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
    const opts = parseArgs(remainingArgs);
    let entries = [...data.active, ...data.closed];
    if (opts.stage) {
      entries = entries.filter(e => e.stage === opts.stage);
    }
    console.log(JSON.stringify(entries, null, 2));
  }
}

function handleAppend(type: StateType, jsonStr: string | undefined): void {
  const entry = parseJsonArg(jsonStr, 'append');

  if (type === 'applications') {
    console.error('append is not supported for applications. Use "create" instead.');
    process.exit(1);
  }

  if (type === 'seen-postings') {
    seenPostings.appendSeenPosting(OUTPUT_DIR, entry as unknown as seenPostings.SeenPostingEntry);
    console.log(JSON.stringify({ success: true }));
  } else if (type === 'preferences') {
    preferences.appendPreferences(OUTPUT_DIR, entry as unknown as preferences.PreferencesEntry);
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
  const entry = parseJsonArg(jsonStr, 'create');
  applications.createApplication(OUTPUT_DIR, entry as unknown as applications.CreateApplicationInput);
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
  const entry = parseJsonArg(jsonStr, 'mark-status-changed');
  const result = applications.markStatusChanged(OUTPUT_DIR, entry as unknown as applications.MarkStatusChangedInput);
  console.log(JSON.stringify({ success: true, ...result }));
}

function handleFlagForReview(jsonStr: string | undefined): void {
  const entry = parseJsonArg(jsonStr, 'flag-for-review');
  const result = applications.flagForReview(OUTPUT_DIR, entry as unknown as applications.FlagForReviewInput);
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
