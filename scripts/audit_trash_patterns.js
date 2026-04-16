#!/usr/bin/env bun
// scripts/audit_trash_patterns.js
//
// Discovers Gmail inbox senders not covered by any configured auto-trash
// pattern. Outputs structured JSON for the scan-email skill to present
// interactively for human review.
//
// Usage:
//   bun scripts/audit_trash_patterns.js                    # Full audit
//   bun scripts/audit_trash_patterns.js --newer-than 7d    # Narrow window
//   bun scripts/audit_trash_patterns.js --uncovered-only   # Skip covered
//
// Exit codes:
//   0  success
//   2  config error (missing search.md, missing credentials)
//   4  Gmail API error (search subprocess failed)
//
// Env overrides (intended for tests):
//   JOB_SEEKER_SEARCH_MD           override path to search.md
//   JOB_SEEKER_GMAIL_BIN           override path to gmail.js
//   JOB_SEEKER_GMAIL_CREDS         override path to credentials/ dir
//   JOB_SEEKER_SKIP_CRED_CHECK     skip credential existence check

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { extractAllTrashSubstrings } = require('./lib/trash-tables');
const { classifySender } = require('./lib/sender-classifier');

const EXIT_OK = 0;
const EXIT_CONFIG = 2;
const EXIT_GMAIL_API = 4;

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

function parseArgs(argv) {
  const args = { newerThan: '30d', uncoveredOnly: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--uncovered-only') {
      args.uncoveredOnly = true;
    } else if (a.startsWith('--newer-than=')) {
      args.newerThan = a.slice('--newer-than='.length);
    } else if (a === '--newer-than') {
      const v = rest[i + 1];
      if (v === undefined || v.startsWith('--')) {
        throw new Error('--newer-than requires a value');
      }
      args.newerThan = v;
      i++;
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
    'Usage: bun scripts/audit_trash_patterns.js [--newer-than WINDOW] [--uncovered-only]\n' +
      '\n' +
      'Discovers Gmail inbox senders not covered by auto-trash patterns.\n' +
      'Outputs structured JSON.\n'
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

// Extract email address from a From header like "Name <email@domain.com>"
// or bare "email@domain.com".
function parseEmailAddress(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return fromHeader.trim().toLowerCase();
}

// Extract domain from an email address.
function extractDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return email;
  return email.slice(at + 1);
}

// Check if a sender email or domain is covered by any configured pattern.
function isCovered(email, domain, patterns) {
  for (const p of patterns) {
    if (email.includes(p) || domain.includes(p)) {
      return p;
    }
  }
  return null;
}

function runGmailSearch(gmailBin, newerThan) {
  const query = `in:inbox newer_than:${newerThan}`;
  const result = spawnSync('bun', [gmailBin, 'search', query, '--max', '500'], {
    encoding: 'utf8',
    timeout: 60000,
  });
  if (result.error) {
    throw new Error(`gmail.js search failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const msg = (result.stderr || '').trim() || 'unknown error';
    throw new Error(`gmail.js search exited ${result.status}: ${msg}`);
  }
  const stdout = (result.stdout || '').trim();
  if (!stdout) return [];
  return JSON.parse(stdout);
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

  const searchPath = process.env.JOB_SEEKER_SEARCH_MD || DEFAULT_SEARCH_MD;
  const gmailBin = process.env.JOB_SEEKER_GMAIL_BIN || DEFAULT_GMAIL_BIN;
  const credsDir = process.env.JOB_SEEKER_GMAIL_CREDS || DEFAULT_CREDS_DIR;
  const skipCredCheck = Boolean(process.env.JOB_SEEKER_SKIP_CRED_CHECK);

  let patterns;
  try {
    const md = readSearchMd(searchPath);
    patterns = extractAllTrashSubstrings(md);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_CONFIG;
    }
    process.stderr.write(`error: ${err.message}\n`);
    return EXIT_CONFIG;
  }

  if (!skipCredCheck) {
    try {
      checkCredentials(credsDir);
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_CONFIG;
    }
  }

  let messages;
  try {
    messages = runGmailSearch(gmailBin, args.newerThan);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return EXIT_GMAIL_API;
  }

  // Group by sender domain
  const domainMap = new Map();
  for (const msg of messages) {
    if (!msg.from) continue;
    const email = parseEmailAddress(msg.from);
    const domain = extractDomain(email);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        fromAddresses: new Set(),
        subjects: [],
        count: 0,
      });
    }
    const entry = domainMap.get(domain);
    entry.fromAddresses.add(email);
    if (msg.subject) entry.subjects.push(msg.subject);
    entry.count++;
  }

  // Classify each domain
  const uncoveredSenders = [];
  const coveredSenders = [];
  let coveredCount = 0;

  for (const [domain, data] of domainMap) {
    const fromAddresses = [...data.fromAddresses];
    let matchedPattern = null;
    for (const addr of fromAddresses) {
      matchedPattern = isCovered(addr, domain, patterns);
      if (matchedPattern) break;
    }

    if (matchedPattern) {
      coveredCount += data.count;
      coveredSenders.push({
        domain,
        messageCount: data.count,
        matchedPatterns: [matchedPattern],
      });
    } else {
      const classification = classifySender({
        domain,
        fromAddresses,
        messageCount: data.count,
        subjects: data.subjects,
      });
      uncoveredSenders.push({
        domain,
        fromAddresses,
        messageCount: data.count,
        suggestedCategory: classification.suggestedCategory,
        suggestedPattern: domain,
        sampleSubjects: data.subjects.slice(0, 5),
        confidence: classification.confidence,
      });
    }
  }

  uncoveredSenders.sort((a, b) => b.messageCount - a.messageCount);

  const output = { coveredCount, uncoveredSenders };
  if (!args.uncoveredOnly) {
    output.coveredSenders = coveredSenders;
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  return EXIT_OK;
}

module.exports = { EXIT_OK, EXIT_CONFIG, EXIT_GMAIL_API };

if (require.main === module) {
  process.exit(main());
}
