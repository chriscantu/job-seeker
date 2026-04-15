#!/usr/bin/env bun
// scripts/auto_trash_inbox.js
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
//   bun scripts/auto_trash_inbox.js              # Live run — trashes matching messages
//   bun scripts/auto_trash_inbox.js --dry-run    # Print what would be trashed, skip osascript
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

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  extractAllTrashSubstrings,
  findSubstringWithComma,
} = require('./lib/trash-tables');
const {
  detectPartialFailure,
  classifyOsascriptResult,
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_OSASCRIPT,
  EXIT_PARTIAL,
} = require('./lib/trash-output');

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

function parseArgs(argv) {
  const args = { dryRun: false };
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

function printHelp() {
  process.stdout.write(
    'Usage: bun scripts/auto_trash_inbox.js [--dry-run]\n' +
      '\n' +
      'Reads config/search.md and integrations/config/mail-config.md,\n' +
      'then invokes apple_mail_trash_by_sender.applescript to trash\n' +
      'matching messages from the configured Apple Mail inbox.\n'
  );
}

function readMailConfig(configPath) {
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

function readSearchMd(searchPath) {
  if (!fs.existsSync(searchPath)) {
    throw new ConfigError(
      `search.md not found at ${searchPath}. ` +
        `Copy config/search.md.example to config/search.md and customize.`
    );
  }
  return fs.readFileSync(searchPath, 'utf8');
}

class ConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ConfigError';
  }
}

class CommaError extends Error {
  constructor(substring) {
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

function buildPlan(env) {
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

function runTrashScript(plan) {
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
// in scripts/lib/trash-output.js and are re-exported below for the existing
// unit tests in tests/auto-trash-classify.test.js.

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    printHelp();
    return EXIT_CONFIG;
  }
  if (args.help) {
    printHelp();
    return EXIT_OK;
  }

  let plan;
  try {
    plan = buildPlan(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_CONFIG;
    }
    if (err instanceof CommaError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_COMMA;
    }
    // Missing-heading errors come from extractAllTrashSubstrings as plain
    // Error instances — surface their message to stderr and classify as
    // config errors.
    process.stderr.write(`error: ${err.message}\n`);
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

  let result;
  try {
    result = runTrashScript(plan);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
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
    status: result.status,
    expectedPatternCount: plan.substrings.length,
  });
}

module.exports = {
  detectPartialFailure,
  classifyOsascriptResult,
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_OSASCRIPT,
  EXIT_PARTIAL,
};

if (require.main === module) {
  process.exit(main());
}
