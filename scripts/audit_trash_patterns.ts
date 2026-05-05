#!/usr/bin/env bun
//
// Discovers Gmail inbox senders not covered by any configured auto-trash
// pattern. Outputs structured JSON for the scan-email skill to present
// interactively for human review.
//
// Usage:
//   bun scripts/audit_trash_patterns.ts                    # Full audit
//   bun scripts/audit_trash_patterns.ts --newer-than 7d    # Narrow window
//   bun scripts/audit_trash_patterns.ts --uncovered-only   # Skip covered
//
// Exit codes:
//   0  success
//   2  config or argument error (missing search.md, missing credentials, bad CLI args)
//   4  Gmail API error (search subprocess failed)
//
// Env overrides (intended for tests):
//   JOB_SEEKER_SEARCH_MD           override path to search.md
//   JOB_SEEKER_GMAIL_BIN           override path to gmail.ts
//   JOB_SEEKER_GMAIL_CREDS         override path to credentials/ dir
//   JOB_SEEKER_SKIP_CRED_CHECK     skip credential existence check

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

import { extractAllTrashSubstrings } from './lib/trash-tables';
import { classifySender, SenderCategory, Confidence } from './lib/sender-classifier';

const EXIT_OK = 0;
const EXIT_CONFIG = 2;
const EXIT_GMAIL_API = 4;

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SEARCH_MD = path.join(REPO_ROOT, 'config', 'search.md');
const DEFAULT_GMAIL_BIN = path.join(REPO_ROOT, 'scripts', 'gmail.ts');
const DEFAULT_CREDS_DIR = path.join(REPO_ROOT, 'credentials');

class ConfigError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ConfigError';
  }
}

interface AuditArgs {
  newerThan: string;
  uncoveredOnly: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): AuditArgs {
  const args: AuditArgs = { newerThan: '30d', uncoveredOnly: false };
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
  if (args.newerThan && !/^\d+[dhm]$/.test(args.newerThan)) {
    throw new Error(
      `invalid --newer-than value "${args.newerThan}" — ` +
        `expected format like 30d, 7d, 24h, 60m`
    );
  }
  return args;
}

function printHelp(): void {
  process.stdout.write(
    'Usage: bun scripts/audit_trash_patterns.ts [--newer-than WINDOW] [--uncovered-only]\n' +
      '\n' +
      'Discovers Gmail inbox senders not covered by auto-trash patterns.\n' +
      'Outputs structured JSON.\n'
  );
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

function checkCredentials(credsDir: string): void {
  const clientSecret = path.join(credsDir, 'gmail-client-secret.json');
  const tokens = path.join(credsDir, 'gmail-tokens.json');
  if (!fs.existsSync(clientSecret) || !fs.existsSync(tokens)) {
    throw new ConfigError(
      `Gmail credentials missing in ${credsDir}. ` +
        `Expected gmail-client-secret.json and gmail-tokens.json. ` +
        `Run: bun scripts/gmail.ts auth`
    );
  }
}

// Extract email address from a From header like "Name <email@domain.com>"
// or bare "email@domain.com". Returns the address lowercased.
function parseEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return fromHeader.trim().toLowerCase();
}

function extractDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at === -1) return email;
  return email.slice(at + 1);
}

// Check if a sender email or domain is covered by any configured pattern.
function isCovered(email: string, domain: string, patterns: string[]): string | null {
  for (const p of patterns) {
    if (email.includes(p) || domain.includes(p)) {
      return p;
    }
  }
  return null;
}

interface GmailSearchMessage {
  id?: string;
  threadId?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  snippet?: string;
}

function runGmailSearch(gmailBin: string, newerThan: string): GmailSearchMessage[] {
  const query = `in:inbox newer_than:${newerThan}`;
  const result = spawnSync('bun', [gmailBin, 'search', query, '--max', '500'], {
    encoding: 'utf8',
    timeout: 60000,
  });
  if (result.error) {
    throw new Error(`gmail.ts search failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const msg = (result.stderr || '').trim() || 'unknown error';
    throw new Error(`gmail.ts search exited ${result.status}: ${msg}`);
  }
  const stdout = (result.stdout || '').trim();
  if (!stdout) return [];
  try {
    return JSON.parse(stdout) as GmailSearchMessage[];
  } catch {
    const preview = stdout.slice(0, 200);
    throw new Error(
      `gmail.ts search returned invalid JSON. ` +
        `First 200 chars of output: ${preview}`
    );
  }
}

interface DomainData {
  fromAddresses: Set<string>;
  subjects: string[];
  count: number;
}

interface UncoveredSender {
  domain: string;
  fromAddresses: string[];
  messageCount: number;
  suggestedCategory: SenderCategory;
  suggestedPattern: string;
  sampleSubjects: string[];
  confidence: Confidence;
}

interface CoveredSender {
  domain: string;
  messageCount: number;
  matchedPatterns: string[];
}

interface AuditOutput {
  coveredCount: number;
  uncoveredSenders: UncoveredSender[];
  coveredSenders?: CoveredSender[];
}

function main(): number {
  let args: AuditArgs;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${msg}\n`);
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

  let patterns: string[];
  try {
    const md = readSearchMd(searchPath);
    patterns = extractAllTrashSubstrings(md);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // ConfigError and extractAllTrashSubstrings errors (missing heading,
    // empty table) are config problems — report and exit cleanly.
    // Unexpected runtime errors (TypeError, etc.) should propagate with
    // their stack trace for debugging.
    if (
      err instanceof ConfigError ||
      msg.includes('Trash table') ||
      msg.includes('Heading not found')
    ) {
      process.stderr.write(`error: ${msg}\n`);
      return EXIT_CONFIG;
    }
    throw err;
  }

  if (!skipCredCheck) {
    try {
      checkCredentials(credsDir);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: ${msg}\n`);
      return EXIT_CONFIG;
    }
  }

  let messages: GmailSearchMessage[];
  try {
    messages = runGmailSearch(gmailBin, args.newerThan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${msg}\n`);
    return EXIT_GMAIL_API;
  }

  // Group by sender domain
  const domainMap = new Map<string, DomainData>();
  let skippedNoFrom = 0;
  for (const msg of messages) {
    if (!msg.from) { skippedNoFrom++; continue; }
    const email = parseEmailAddress(msg.from);
    const domain = extractDomain(email);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        fromAddresses: new Set(),
        subjects: [],
        count: 0,
      });
    }
    const entry = domainMap.get(domain)!;
    entry.fromAddresses.add(email);
    if (msg.subject) entry.subjects.push(msg.subject);
    entry.count++;
  }

  if (skippedNoFrom > 0) {
    process.stderr.write(
      `warning: ${skippedNoFrom} of ${messages.length} messages had no From header and were skipped\n`
    );
  }
  if (messages.length > 0 && domainMap.size === 0) {
    process.stderr.write(
      `warning: all ${messages.length} messages were skipped (none had a From header). ` +
        `This likely indicates a gmail.ts bug or Gmail API schema change.\n`
    );
  }

  // Classify each domain
  const uncoveredSenders: UncoveredSender[] = [];
  const coveredSenders: CoveredSender[] = [];
  let coveredCount = 0;

  for (const [domain, data] of domainMap) {
    const fromAddresses = [...data.fromAddresses];
    let matchedPattern: string | null = null;
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

  const output: AuditOutput = { coveredCount, uncoveredSenders };
  if (!args.uncoveredOnly) {
    output.coveredSenders = coveredSenders;
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  return EXIT_OK;
}

export { EXIT_OK, EXIT_CONFIG, EXIT_GMAIL_API };

if (import.meta.main) {
  process.exit(main());
}
