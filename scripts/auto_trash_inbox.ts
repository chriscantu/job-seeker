#!/usr/bin/env bun
//
// Deterministic Phase 6 Step 1 of scan-email. Reads the three auto-trash
// tables from config/search.md, validates the no-comma invariant, and
// shells out to apple_mail_trash_by_sender.applescript with the concatenated
// sender pattern list. Prints the AppleScript output verbatim so the caller
// (and the user) can see per-pattern moved/matched counts.
//
// Why this exists:
//   Before issue #88, Phase 6 Step 1 was a prose instruction in
//   skills/scan-email/SKILL.md: "read 3 markdown tables, concatenate, call
//   osascript, parse output, surface every line." Executed by an LLM agent,
//   any of those steps could be silently skipped under budget/subagent/
//   abort pressure — which is exactly what happened. Ladders, Lensa, and
//   LinkedIn connection invites accumulated in the inbox because the
//   trash-by-sender script was never invoked, even though the script
//   itself works perfectly. This CLI replaces the prose with a single
//   atomic command: read, validate, call, return.
//
// Usage:
//   bun scripts/auto_trash_inbox.ts              # Live run — trashes matching messages
//   bun scripts/auto_trash_inbox.ts --dry-run    # Print what would be trashed, skip osascript
//
// Exit codes:
//   0  success (or dry-run completed)
//   2  usage / config error (missing search.md, missing mail-config.md, missing table heading)
//   3  comma invariant violated in a trash substring
//   4  osascript error (ACCOUNT_NOT_FOUND, MAILBOX_NOT_FOUND, TRASH_NOT_FOUND, error:...)
//   5  partial failure (moved < matched for one or more patterns)
//
// Env overrides (intended for tests):
//   JOB_SEEKER_SEARCH_MD     override path to search.md
//   JOB_SEEKER_MAIL_CONFIG   override path to integrations/config/mail-config.md

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

import {
  extractAllTrashSubstrings,
  findSubstringWithComma,
} from './lib/trash-tables';
import {
  detectPartialFailure,
  classifyOsascriptResult,
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_OSASCRIPT,
  EXIT_PARTIAL,
} from './lib/trash-output';
import { errorMessage } from './lib/util';

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SEARCH_MD = path.join(REPO_ROOT, 'config', 'search.md');
const DEFAULT_MAIL_CONFIG = path.join(
  REPO_ROOT,
  'integrations',
  'config',
  'mail-config.md'
);
const TRASH_SCRIPT = path.join(
  REPO_ROOT,
  'scripts',
  'apple_mail_trash_by_sender.applescript'
);

interface ParsedArgs {
  dryRun: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { dryRun: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp(): void {
  process.stdout.write(
    'Usage: bun scripts/auto_trash_inbox.ts [--dry-run]\n' +
      '\n' +
      'Reads config/search.md and integrations/config/mail-config.md,\n' +
      'then invokes apple_mail_trash_by_sender.applescript to trash\n' +
      'matching messages from the configured Apple Mail inbox.\n'
  );
}

class ConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ConfigError';
  }
}

class CommaError extends Error {
  substring: string;
  constructor(substring: string) {
    super(
      `Trash substring "${substring}" contains a comma. ` +
        `apple_mail_trash_by_sender.applescript splits its input on commas, ` +
        `so a literal comma would turn this into two bogus patterns. ` +
        `Remove the comma in config/search.md.`
    );
    this.name = 'CommaError';
    this.substring = substring;
  }
}

interface MailConfig {
  accountName: string;
  inboxName: string;
}

function readMailConfig(configPath: string): MailConfig {
  if (!fs.existsSync(configPath)) {
    throw new ConfigError(
      `mail-config.md not found at ${configPath}. ` +
        `Copy integrations/config/mail-config.md.example and fill in your ` +
        `account_name and inbox_name.`
    );
  }
  const content = fs.readFileSync(configPath, 'utf8');
  const accountMatch = content.match(/^\s*account_name:\s*(.+)\s*$/m);
  const inboxMatch = content.match(/^\s*inbox_name:\s*(.+)\s*$/m);
  if (!accountMatch || !inboxMatch) {
    throw new ConfigError(
      `mail-config.md at ${configPath} is missing account_name or inbox_name.`
    );
  }
  return {
    accountName: accountMatch[1].trim(),
    inboxName: inboxMatch[1].trim(),
  };
}

function readSearchMd(searchPath: string): string {
  if (!fs.existsSync(searchPath)) {
    throw new ConfigError(
      `search.md not found at ${searchPath}. ` +
        `Copy config/search.md.example to config/search.md and customize.`
    );
  }
  return fs.readFileSync(searchPath, 'utf8');
}

interface TrashPlan {
  accountName: string;
  inboxName: string;
  substrings: string[];
  patterns: string;
}

function buildPlan(env: NodeJS.ProcessEnv): TrashPlan {
  const searchPath = env.JOB_SEEKER_SEARCH_MD || DEFAULT_SEARCH_MD;
  const mailConfigPath = env.JOB_SEEKER_MAIL_CONFIG || DEFAULT_MAIL_CONFIG;

  const { accountName, inboxName } = readMailConfig(mailConfigPath);
  const md = readSearchMd(searchPath);
  const substrings = extractAllTrashSubstrings(md);
  const offender = findSubstringWithComma(substrings);
  if (offender !== null) {
    throw new CommaError(offender);
  }
  const patterns = substrings.join(',');
  return { accountName, inboxName, substrings, patterns };
}

interface OsascriptResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

function runTrashScript(plan: TrashPlan): OsascriptResult {
  const result = spawnSync(
    'osascript',
    [TRASH_SCRIPT, plan.accountName, plan.inboxName, plan.patterns],
    { encoding: 'utf8' }
  );
  if (result.error) {
    throw new Error(`osascript invocation failed: ${result.error.message}`);
  }
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  return { stdout, stderr, status: result.status };
}

// Classifier helpers (detectPartialFailure, classifyOsascriptResult) live
// in scripts/lib/trash-output.ts and are re-exported below for the existing
// unit tests in tests/auto-trash-classify.test.js.

function main(): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    const msg = errorMessage(err);
    process.stderr.write(`error: ${msg}\n`);
    printHelp();
    return EXIT_CONFIG;
  }
  if (args.help) {
    printHelp();
    return EXIT_OK;
  }

  let plan: TrashPlan;
  try {
    plan = buildPlan(process.env);
  } catch (err) {
    const msg = errorMessage(err);
    if (err instanceof ConfigError) {
      process.stderr.write(`error: ${msg}\n`);
      return EXIT_CONFIG;
    }
    if (err instanceof CommaError) {
      process.stderr.write(`error: ${msg}\n`);
      return EXIT_COMMA;
    }
    // Missing-heading errors come from extractAllTrashSubstrings as plain
    // Error instances — surface their message to stderr and classify as
    // config errors.
    process.stderr.write(`error: ${msg}\n`);
    return EXIT_CONFIG;
  }

  if (args.dryRun) {
    process.stdout.write(
      `dry-run: Phase 6 Step 1 would trash by sender\n` +
        `  account: ${plan.accountName}\n` +
        `  inbox: ${plan.inboxName}\n` +
        `  pattern count: ${plan.substrings.length}\n` +
        `  patterns: ${plan.patterns}\n`
    );
    return EXIT_OK;
  }

  let result: OsascriptResult;
  try {
    result = runTrashScript(plan);
  } catch (err) {
    const msg = errorMessage(err);
    process.stderr.write(`error: ${msg}\n`);
    return EXIT_OSASCRIPT;
  }

  // Always print the AppleScript's stdout verbatim — this is the
  // per-pattern moved/matched line the user needs to see.
  if (result.stdout) {
    process.stdout.write(result.stdout + '\n');
  }
  if (result.stderr) {
    process.stderr.write(result.stderr + '\n');
  }

  return classifyOsascriptResult({
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status ?? -1,
    expectedPatternCount: plan.substrings.length,
  });
}

export {
  detectPartialFailure,
  classifyOsascriptResult,
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_OSASCRIPT,
  EXIT_PARTIAL,
};

if (import.meta.main) {
  process.exit(main());
}
