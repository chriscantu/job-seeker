#!/usr/bin/env bun
// scripts/auto_trash_gmail.js
//
// Deterministic Phase 6 Step 1G of scan-email — Gmail-side equivalent of
// auto_trash_inbox.js. Reads the three auto-trash tables from
// config/search.md, validates the no-comma invariant, and shells out to
// `gmail.js trash-by-sender` with one `--sender` flag per substring.
// Prints the child's stdout verbatim so the caller (and the user) can see
// per-pattern moved/matched counts, including 0/0 rows that surface typos
// in config/search.md.
//
// Why this exists:
//   Before this CLI, the only Gmail trash path was Phase 6 Step 2 — a
//   by-id trash of messages that had already been body-fetched during the
//   scan. Aggregator, marketing, and job-alert senders whose messages got
//   filtered out BEFORE body fetch (age filter, title classifier, dedup,
//   newsletter skip) accumulated in the Gmail inbox indefinitely, because
//   config/search.md's three trash tables were only applied to Apple Mail.
//
//   The 2026-04-15 scan-email run left Glassdoor, RemoteHunter, and
//   Wellfound messages in the Gmail inbox after a clean pass. Adding those
//   senders to the "Job Alert Senders" table was a no-op on Gmail until
//   this script landed.
//
// Usage:
//   bun scripts/auto_trash_gmail.js              # Live run — trashes matching messages
//   bun scripts/auto_trash_gmail.js --dry-run    # Print what would be trashed, skip Gmail API
//
// Exit codes:
//   0  success (or dry-run completed)
//   2  usage / config error (missing search.md, missing table heading,
//      empty required table, missing Gmail credentials)
//   3  comma invariant violated in a trash substring
//   4  Gmail API error (child process exit ≠ 0, AUTH_REQUIRED sentinel,
//      GMAIL_ERROR sentinel, stderr-with-status-0, or detectPartialFailure
//      anomaly)
//   5  partial failure (moved < matched for one or more patterns)
//
// Env overrides (intended for tests):
//   JOB_SEEKER_SEARCH_MD     override path to search.md
//   JOB_SEEKER_GMAIL_BIN     override path to gmail.js (for test stubs)
//   JOB_SEEKER_GMAIL_CREDS   override path to credentials/ dir

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  extractAllTrashSubstrings,
  findSubstringWithComma,
} = require('./lib/trash-tables');
const {
  classifyGmailResult,
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_GMAIL_API,
  EXIT_PARTIAL,
} = require('./lib/trash-output');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SEARCH_MD = path.join(REPO_ROOT, 'config', 'search.md');
const DEFAULT_GMAIL_BIN = path.join(REPO_ROOT, 'scripts', 'gmail.js');
const DEFAULT_CREDS_DIR = path.join(REPO_ROOT, 'credentials');

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
        `auto_trash_gmail ships substrings through gmail.js trash-by-sender ` +
        `as repeated --sender flags, but a literal comma likely indicates a ` +
        `typo in config/search.md — the Apple Mail path splits on commas and ` +
        `would mis-parse this. Remove the comma to keep both paths consistent.`
    );
    this.name = 'CommaError';
    this.substring = substring;
  }
}

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
    'Usage: bun scripts/auto_trash_gmail.js [--dry-run]\n' +
      '\n' +
      'Reads config/search.md, then invokes gmail.js trash-by-sender with\n' +
      'one --sender flag per substring to move matching INBOX messages to\n' +
      'Gmail Trash.\n'
  );
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

function checkCredentials(credsDir) {
  const clientSecret = path.join(credsDir, 'gmail-client-secret.json');
  const tokens = path.join(credsDir, 'gmail-tokens.json');
  if (!fs.existsSync(clientSecret) || !fs.existsSync(tokens)) {
    throw new ConfigError(
      `Gmail credentials missing in ${credsDir}. ` +
        `Expected gmail-client-secret.json and gmail-tokens.json. ` +
        `Run: bun scripts/gmail.js auth`
    );
  }
}

function buildPlan(env) {
  const searchPath = env.JOB_SEEKER_SEARCH_MD || DEFAULT_SEARCH_MD;
  const credsDir = env.JOB_SEEKER_GMAIL_CREDS || DEFAULT_CREDS_DIR;
  const gmailBin = env.JOB_SEEKER_GMAIL_BIN || DEFAULT_GMAIL_BIN;

  // Credentials are only required for live runs. Tests and `--dry-run`
  // against a stub gmail.js should not need them. The caller decides
  // based on args.dryRun + env override presence.
  const skipCredCheck = Boolean(env.JOB_SEEKER_GMAIL_BIN);

  const md = readSearchMd(searchPath);
  const substrings = extractAllTrashSubstrings(md);
  const offender = findSubstringWithComma(substrings);
  if (offender !== null) {
    throw new CommaError(offender);
  }
  return { substrings, gmailBin, credsDir, skipCredCheck };
}

function runTrashBySender(plan, dryRun) {
  const args = [plan.gmailBin, 'trash-by-sender'];
  for (const s of plan.substrings) {
    args.push('--sender', s);
  }
  if (dryRun) args.push('--dry-run');
  const result = spawnSync('bun', args, { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`bun invocation failed: ${result.error.message}`);
  }
  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  return { stdout, stderr, status: result.status };
}

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
    // Missing-heading / empty-table errors come from extractAllTrashSubstrings
    // as plain Error instances — surface their message to stderr and
    // classify as config errors (issue #90 finding 2 convention).
    process.stderr.write(`error: ${err.message}\n`);
    return EXIT_CONFIG;
  }

  // Local dry-run (no stub) prints the plan and exits without touching
  // Gmail at all — no credential check, no subprocess. A stub override
  // falls through so integration tests can exercise the full pipeline.
  if (args.dryRun && !plan.skipCredCheck) {
    process.stdout.write(
      `dry-run: Phase 6 Step 1G would trash Gmail INBOX messages by sender\n` +
        `  pattern count: ${plan.substrings.length}\n` +
        `  patterns: ${plan.substrings.join(',')}\n`
    );
    return EXIT_OK;
  }

  // Live run (or stubbed test run) — verify credentials unless a stub
  // override is in effect. Stubs don't need real credentials.
  if (!plan.skipCredCheck) {
    try {
      checkCredentials(plan.credsDir);
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_CONFIG;
    }
  }

  let result;
  try {
    result = runTrashBySender(plan, args.dryRun);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return EXIT_GMAIL_API;
  }

  // Always surface the child's stdout/stderr verbatim — this is the
  // per-pattern moved/matched line the user needs to see.
  if (result.stdout) {
    process.stdout.write(result.stdout + '\n');
  }
  if (result.stderr) {
    process.stderr.write(result.stderr + '\n');
  }

  return classifyGmailResult({
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
    expectedPatternCount: plan.substrings.length,
  });
}

module.exports = {
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_GMAIL_API,
  EXIT_PARTIAL,
};

if (require.main === module) {
  process.exit(main());
}
