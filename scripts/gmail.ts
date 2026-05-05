#!/usr/bin/env bun
// Thin CLI for Gmail API operations, backed by the `googleapis` package.
// Used instead of the Claude MCP Gmail server to unify auth under a single
// OAuth2 flow and keep Gmail operations testable and portable.
//
// Usage:
//   bun scripts/gmail.ts auth                                   # One-time OAuth2 consent flow
//   bun scripts/gmail.ts profile                                # Print authenticated email address
//   bun scripts/gmail.ts search <query> [--max N]               # Search messages (prints JSON)
//   bun scripts/gmail.ts create-draft [--to X] --subject Y --body-file Z
//   bun scripts/gmail.ts trash <id>...                          # Trash messages by ID
//   bun scripts/gmail.ts trash-by-sender --sender S [--sender S ...] [--newer-than 30d] [--dry-run]
//
// Note: `auth` starts a local HTTP server on :3000 for the OAuth callback.
//
// Exit codes: 0 = success, 1 = error

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { google, gmail_v1 } from 'googleapis';
import { GaxiosError } from 'gaxios';
import {
  getAuthenticatedClient,
  getAuthUrl,
  exchangeCode,
} from './lib/gmail-auth';

type GmailClient = gmail_v1.Gmail;

const ROOT = path.resolve(__dirname, '..');

interface Flags {
  [key: string]: string | true;
}

interface ParsedFlags {
  flags: Flags;
  positional: string[];
}

// Returns a string flag value, or undefined when absent / present-as-boolean.
// Single boundary for the `string | true | undefined` flag shape so call sites
// can read flag values as `string | undefined` without inline typeof checks.
function flagString(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

interface ApiError {
  status?: number;
  message: string;
}

// Normalizes any thrown value (catch blocks are typed `unknown` in TS) into a
// known shape: HTTP status (numeric, when extractable) and a message string.
// All `typeof` / `instanceof` narrowing is concentrated in this one function;
// call sites destructure `{ status, message }` and proceed without further
// runtime checks.
//
// Status precedence: `response.status` → `status` → numeric `code`. String
// `code` (errno like 'ENOTFOUND') is ignored on purpose — only numeric values
// represent HTTP statuses (per gaxios AIP-193). The duck-typed fallback
// covers test fakes and non-gaxios HTTP errors that throw plain objects with
// the same shape.
function normalizeError(err: unknown): ApiError {
  const message = err instanceof Error && err.message ? err.message : String(err);
  if (err instanceof GaxiosError) {
    return { status: err.response?.status ?? err.status ?? (typeof err.code === 'number' ? err.code : undefined), message };
  }
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; status?: unknown; response?: { status?: unknown } };
    const responseStatus = typeof e.response?.status === 'number' ? e.response.status : undefined;
    const status        = typeof e.status === 'number' ? e.status : undefined;
    const codeAsStatus  = typeof e.code === 'number' ? e.code : undefined;
    return { status: responseStatus ?? status ?? codeAsStatus, message };
  }
  return { message };
}

function usage(): never {
  console.error(`Usage: bun scripts/gmail.ts <command> [args]

Commands:
  auth                             Authenticate with Gmail (one-time browser consent)
  profile                          Print the authenticated Gmail address
  search <query> [--max N]         Search messages, print JSON array
  create-draft [--to X] --subject Y --body-file Z
                                   Create a Gmail draft (body read from file;
                                   --to is optional — omit for drafts where
                                   the recipient is not yet known)
  trash <id>...                    Trash one or more messages by Gmail message ID
  trash-by-sender --sender S [...]  Trash INBOX messages matching from:<S> (repeated flag)
                                   Optional: --newer-than <window> (default 30d), --dry-run

Examples:
  bun scripts/gmail.ts auth
  bun scripts/gmail.ts profile
  bun scripts/gmail.ts search "from:@acme.com" --max 5
  bun scripts/gmail.ts create-draft --to jane@acme.com --subject "Re: VP Eng" --body-file /tmp/body.txt
  bun scripts/gmail.ts create-draft --subject "Cold outreach" --body-file /tmp/body.txt
  bun scripts/gmail.ts trash 18f1a2b3c4d5e6f7
  bun scripts/gmail.ts trash-by-sender --sender lensa.com --sender ladders.com --dry-run`);
  process.exit(1);
}

function parseFlags(args: string[]): ParsedFlags {
  const flags: Flags = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function handleApiError(err: unknown, context: string): never {
  const { status, message } = normalizeError(err);
  if (status === 401 || status === 403) {
    console.error(`Auth error (${status}): ${message}`);
    console.error('Re-authenticate with: bun scripts/gmail.ts auth');
    process.exit(1);
  }
  console.error(`Error: ${context} [${status ?? 'unknown'}] ${message}`);
  process.exit(1);
}

async function authCommand(): Promise<void> {
  const url = getAuthUrl(ROOT);
  console.log('Open this URL in your browser to authorize:\n');
  console.log(url);
  console.log('\nWaiting for authorization...');

  return new Promise<void>((resolve, reject) => {
    const TIMEOUT = 5 * 60 * 1000;
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url || '/', 'http://localhost:3000');
      const code = reqUrl.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing authorization code.');
        return;
      }
      try {
        await exchangeCode(ROOT, code);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>');
        console.log('Authorization successful. Tokens saved.');
        clearTimeout(timer);
        server.close();
        resolve();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Authorization failed: ' + msg);
        clearTimeout(timer);
        server.close();
        reject(err);
      }
    });
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error('Port 3000 is already in use. Close the other process and try again.'));
      } else {
        reject(err);
      }
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 5 minutes. Run auth again.'));
    }, TIMEOUT);
    server.listen(3000, () => {
      console.log('Listening on http://localhost:3000 for OAuth callback...');
    });
  });
}

async function profileCommand(): Promise<void> {
  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });
  try {
    const res = await gmail.users.getProfile({ userId: 'me' });
    console.log(JSON.stringify({
      emailAddress: res.data.emailAddress,
      messagesTotal: res.data.messagesTotal,
      threadsTotal: res.data.threadsTotal,
    }, null, 2));
  } catch (err) {
    handleApiError(err, 'profile');
  }
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  const h = headers.find((h) => (h.name || '').toLowerCase() === name.toLowerCase());
  return h ? (h.value || '') : '';
}

async function searchCommand(args: string[]): Promise<void> {
  const { flags, positional } = parseFlags(args);
  const query = positional[0];
  if (!query) {
    console.error('Error: search query is required.');
    process.exit(1);
  }
  const maxResults = parseInt(flagString(flags, 'max') ?? '10', 10);

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
    const messages = list.data.messages || [];
    const results = [];
    for (const { id } of messages) {
      if (!id) continue;
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });
      const headers = msg.data.payload?.headers || [];
      results.push({
        id,
        threadId: msg.data.threadId,
        from: getHeader(headers, 'From'),
        to: getHeader(headers, 'To'),
        subject: getHeader(headers, 'Subject'),
        date: getHeader(headers, 'Date'),
        snippet: msg.data.snippet || '',
      });
    }
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    handleApiError(err, 'search');
  }
}

export function encodeRfc822(to: string | undefined, subject: string, body: string): string {
  const lines: string[] = [];
  if (to) lines.push(`To: ${to}`);
  lines.push(
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  );
  const message = lines.join('\r\n');
  return Buffer.from(message).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createDraftCommand(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const subject = flagString(flags, 'subject');
  const bodyFile = flagString(flags, 'body-file');
  const to = flagString(flags, 'to');
  if (!subject) {
    console.error('Error: --subject is required.');
    process.exit(1);
  }
  if (!bodyFile) {
    console.error('Error: --body-file is required.');
    process.exit(1);
  }
  if (!fs.existsSync(bodyFile)) {
    console.error(`Error: body file not found: ${bodyFile}`);
    process.exit(1);
  }
  const body = fs.readFileSync(bodyFile, 'utf8');

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const raw = encodeRfc822(to, subject, body);
    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw } },
    });
    console.log(JSON.stringify({
      draftId: res.data.id,
      messageId: res.data.message?.id,
    }, null, 2));
  } catch (err) {
    handleApiError(err, 'create-draft');
  }
}

export interface TrashBySenderArgs {
  senders: string[];
  newerThan: string;
  dryRun: boolean;
}

// Parse argv for trash-by-sender: repeated --sender collects into an
// array; --newer-than takes a value; --dry-run is a boolean. Unknown
// flags are a hard error. Kept separate from parseFlags() because
// parseFlags overwrites repeated keys, which would silently drop all
// but the last --sender.
//
// Both `--flag value` and `--flag=value` forms are accepted so that
// substrings starting with `--` can still be expressed via the `=`
// form. The space form rejects `--`-prefixed values to catch the
// common typo of omitting a value.
//
// Exported for unit testing — see tests/gmail-helpers.test.js.
export function parseTrashBySenderArgs(args: string[]): TrashBySenderArgs {
  const senders: string[] = [];
  let newerThan = '30d';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];

    // `--sender=VALUE` — value comes from inside the same token, so
    // the `--`-prefixed typo guard does not apply. This is the escape
    // hatch for the rare legitimate case of a sender substring that
    // starts with `--`.
    if (a.startsWith('--sender=')) {
      const v = a.slice('--sender='.length);
      if (v === '') throw new Error('--sender= requires a value');
      senders.push(v);
      continue;
    }
    if (a === '--sender') {
      const v = args[i + 1];
      if (v === undefined || v === '' || v.startsWith('--')) {
        throw new Error(
          '--sender requires a value. Use --sender=VALUE if the substring starts with "--".'
        );
      }
      senders.push(v);
      i++;
      continue;
    }

    if (a.startsWith('--newer-than=')) {
      const v = a.slice('--newer-than='.length);
      if (v === '') {
        throw new Error('--newer-than= requires a value (e.g. 30d, 7d, 1y)');
      }
      newerThan = v;
      continue;
    }
    if (a === '--newer-than') {
      const v = args[i + 1];
      if (v === undefined || v === '' || v.startsWith('--')) {
        throw new Error('--newer-than requires a value (e.g. 30d, 7d, 1y)');
      }
      newerThan = v;
      i++;
      continue;
    }

    if (a === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (a === '-h' || a === '--help') {
      usage();
    }

    throw new Error(`unknown flag: ${a}`);
  }
  return { senders, newerThan, dryRun };
}

export interface SenderResult {
  pattern: string;
  moved: number;
  matched: number;
  errors: string[];
  capHit: boolean;
  ids?: string[];
}

// Format per-pattern results as `trashed: pat1=M/N pat2=X/Y ...` matching
// the AppleScript output that auto_trash_inbox.ts parses. Optional
// suffixes:
//   - `(errors: pat=id:code|id:code ...)` when any per-message trash failed
//   - `(cap-hit: pat=N ...)` when any pattern hit MAX_MATCHES_PER_PATTERN
//
// The cap-hit suffix lives inside stdout (not stderr) so the Phase 6
// orchestrator does NOT misclassify a capped-but-successful run as a
// Gmail API failure via the stderr-non-empty-with-status-0 rule.
// detectPartialFailure in lib/trash-output.ts strips both `(errors: ...)`
// and subsequent suffixes at `(` boundaries, so adding new suffixes is
// safe as long as they come after the core entries.
//
// Exported for unit testing — see tests/gmail-helpers.test.js.
export function formatTrashBySenderOutput(results: SenderResult[]): string {
  const parts = results.map((r) => `${r.pattern}=${r.moved}/${r.matched}`);
  let line = `trashed: ${parts.join(' ')}`;

  const errored = results.filter((r) => r.errors && r.errors.length > 0);
  if (errored.length > 0) {
    const errSummary = errored
      .map((r) => `${r.pattern}=${r.errors.join('|')}`)
      .join(' ');
    line += ` (errors: ${errSummary})`;
  }

  const capped = results.filter((r) => r.capHit);
  if (capped.length > 0) {
    const capSummary = capped
      .map((r) => `${r.pattern}=${r.matched}`)
      .join(' ');
    line += ` (cap-hit: ${capSummary})`;
  }

  return line;
}

// Default cap on matches per pattern. A misconfigured substring that
// matches thousands of messages is a config-level anomaly, not a bulk
// trash operation. Tunable via JOB_SEEKER_GMAIL_TRASH_MAX so a user
// with a legitimately noisy inbox (LinkedIn alerts on return from a
// long PTO) can raise it without forking the code.
export const DEFAULT_MAX_MATCHES_PER_PATTERN = 500;

export function resolveMaxMatches(env: NodeJS.ProcessEnv): number {
  const raw = env.JOB_SEEKER_GMAIL_TRASH_MAX;
  if (!raw) return DEFAULT_MAX_MATCHES_PER_PATTERN;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `JOB_SEEKER_GMAIL_TRASH_MAX must be a positive integer, got: ${raw}`
    );
  }
  return n;
}

// List INBOX messages matching `from:<sender> newer_than:<window>`,
// paging through nextPageToken. Returns {ids, capHit}. The cap is a
// defensive truncation — the caller communicates it via the stdout
// summary suffix, NOT via stderr, so the orchestrator does not treat
// it as a Gmail API failure.
//
// Exported for unit testing with an injectable gmail client.
export async function listMatchingIds(
  gmail: GmailClient,
  sender: string,
  newerThan: string,
  maxMatches: number,
): Promise<{ ids: string[]; capHit: boolean }> {
  const q = `from:${sender} in:inbox newer_than:${newerThan}`;
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
      pageToken,
    });
    const page = res.data.messages || [];
    for (const m of page) {
      if (m.id) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
    if (ids.length >= maxMatches) {
      return { ids: ids.slice(0, maxMatches), capHit: true };
    }
  } while (pageToken);
  return { ids, capHit: false };
}

interface ProcessSenderOpts {
  newerThan: string;
  maxMatches: number;
  dryRun: boolean;
}

// Process a single sender: list matching IDs, trash them one by one,
// return a result record. A thrown error indicates an unrecoverable
// failure for this run (auth expired, list API died) — the caller is
// expected to stop iterating, flush the summary for patterns already
// attempted, and exit 1.
export async function processSender(
  gmail: GmailClient,
  sender: string,
  opts: ProcessSenderOpts,
): Promise<SenderResult> {
  const { ids, capHit } = await listMatchingIds(
    gmail,
    sender,
    opts.newerThan,
    opts.maxMatches
  );

  if (opts.dryRun) {
    return {
      pattern: sender,
      moved: ids.length,
      matched: ids.length,
      errors: [],
      capHit,
      ids,
    };
  }

  // Per-message trash so per-pattern moved/matched is accurate.
  // batchModify is atomic and can't report partial progress.
  const errors: string[] = [];
  let moved = 0;
  for (const id of ids) {
    try {
      await gmail.users.messages.trash({ userId: 'me', id });
      moved++;
    } catch (err) {
      const { status } = normalizeError(err);
      // Auth errors mid-loop are unrecoverable — propagate so the
      // caller can flush the summary and exit 1. Non-auth errors
      // (per-message 404, 500, etc.) go into the errors array and
      // surface as a partial failure via classifyGmailResult.
      if (status === 401 || status === 403) {
        throw err;
      }
      errors.push(`${id}:${status ?? 'err'}`);
    }
  }
  return {
    pattern: sender,
    moved,
    matched: ids.length,
    errors,
    capHit,
  };
}

interface FatalError {
  kind: 'AUTH_REQUIRED' | 'GMAIL_ERROR';
  message: string;
  sender: string;
}

async function trashBySenderCommand(args: string[], envOverride?: NodeJS.ProcessEnv): Promise<void> {
  const env = envOverride || process.env;

  let parsed: TrashBySenderArgs;
  try {
    parsed = parseTrashBySenderArgs(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`error: ${msg}`);
    process.exit(1);
  }
  if (parsed.senders.length === 0) {
    console.error(
      'error: trash-by-sender requires at least one --sender <substring>'
    );
    process.exit(1);
  }

  let maxMatches: number;
  try {
    maxMatches = resolveMaxMatches(env);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`error: ${msg}`);
    process.exit(1);
  }

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  // Single exit point: every termination path below flushes the
  // partial summary before process.exit so the user (and the Phase 6
  // orchestrator) can see what was attempted, even on mid-run failure.
  const results: SenderResult[] = [];
  let fatalError: FatalError | null = null;

  for (const sender of parsed.senders) {
    try {
      const r = await processSender(gmail, sender, {
        newerThan: parsed.newerThan,
        maxMatches,
        dryRun: parsed.dryRun,
      });
      results.push(r);
    } catch (err) {
      const { status, message } = normalizeError(err);
      if (status === 401 || status === 403) {
        fatalError = {
          kind: 'AUTH_REQUIRED',
          message,
          sender,
        };
      } else {
        fatalError = {
          kind: 'GMAIL_ERROR',
          message: `list failed for "${sender}" [${status ?? 'unknown'}] ${message}`,
          sender,
        };
      }
      break;
    }
  }

  // Flush the summary line for every pattern attempted BEFORE emitting
  // any error text. This guarantees that even a mid-run auth expiry
  // leaves a readable per-pattern record in stdout — the orchestrator's
  // count-mismatch anomaly path then catches the missing patterns.
  console.log(formatTrashBySenderOutput(results));

  if (parsed.dryRun) {
    for (const r of results) {
      if (r.ids && r.ids.length > 0) {
        console.log(`  ${r.pattern}: ${r.ids.join(' ')}`);
      }
    }
  }

  if (fatalError) {
    console.error(`${fatalError.kind}: ${fatalError.message}`);
    if (fatalError.kind === 'AUTH_REQUIRED') {
      console.error('Re-authenticate with: bun scripts/gmail.ts auth');
    }
    process.exit(1);
  }

  // Exit 0 even on per-pattern partial failures. The orchestrator
  // parses the `trashed:` summary to classify EXIT_PARTIAL (exit 5);
  // exiting 1 here would force classifyGmailResult into EXIT_GMAIL_API
  // and make slot 5 permanently unreachable (the original PR #92
  // review finding C2 / M3).
  process.exit(0);
}

async function trashCommand(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) {
    console.error('Error: trash requires at least one message ID.');
    process.exit(1);
  }

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });
  let failed = 0;

  for (const id of messageIds) {
    try {
      await gmail.users.messages.trash({ userId: 'me', id });
      console.log(`trashed: ${id}`);
    } catch (err) {
      const { status, message } = normalizeError(err);

      if (status === 401 || status === 403) {
        console.error(`Auth error (${status}): ${message}`);
        console.error('Re-authenticate with: bun scripts/gmail.ts auth');
        process.exit(1);
      }

      console.error(`error: ${id} [${status ?? 'unknown'}] ${message}`);
      failed++;
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'auth':
      await authCommand();
      break;
    case 'profile':
      await profileCommand();
      break;
    case 'search':
      await searchCommand(args.slice(1));
      break;
    case 'create-draft':
      await createDraftCommand(args.slice(1));
      break;
    case 'trash':
      await trashCommand(args.slice(1));
      break;
    case 'trash-by-sender':
      await trashBySenderCommand(args.slice(1));
      break;
    default:
      usage();
  }
}

// CLI entry guard: bun's `import.meta.main` is true when this file is
// the entry point invoked from CLI, false when imported from a test.
if (import.meta.main) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  });
}
