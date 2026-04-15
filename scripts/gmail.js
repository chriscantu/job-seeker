#!/usr/bin/env node
// scripts/gmail.js
// Thin CLI for Gmail API operations, backed by the `googleapis` package.
// Used instead of the Claude MCP Gmail server to unify auth under a single
// OAuth2 flow and keep Gmail operations testable and portable.
//
// Usage:
//   bun scripts/gmail.js auth                                   # One-time OAuth2 consent flow
//   bun scripts/gmail.js profile                                # Print authenticated email address
//   bun scripts/gmail.js search <query> [--max N]               # Search messages (prints JSON)
//   bun scripts/gmail.js create-draft --to X --subject Y --body-file Z
//   bun scripts/gmail.js trash <id>...                          # Trash messages by ID
//   bun scripts/gmail.js trash-by-sender --sender S [--sender S ...] [--newer-than 30d] [--dry-run]
//
// Note: `auth` starts a local HTTP server on :3000 for the OAuth callback.
//
// Exit codes: 0 = success, 1 = error

const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');
const {
  getAuthenticatedClient,
  getAuthUrl,
  exchangeCode,
} = require('./lib/gmail-auth');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  console.error(`Usage: bun scripts/gmail.js <command> [args]

Commands:
  auth                             Authenticate with Gmail (one-time browser consent)
  profile                          Print the authenticated Gmail address
  search <query> [--max N]         Search messages, print JSON array
  create-draft --to X --subject Y --body-file Z
                                   Create a Gmail draft (body read from file)
  trash <id>...                    Trash one or more messages by Gmail message ID
  trash-by-sender --sender S [...]  Trash INBOX messages matching from:<S> (repeated flag)
                                   Optional: --newer-than <window> (default 30d), --dry-run

Examples:
  bun scripts/gmail.js auth
  bun scripts/gmail.js profile
  bun scripts/gmail.js search "from:@acme.com" --max 5
  bun scripts/gmail.js create-draft --to jane@acme.com --subject "Re: VP Eng" --body-file /tmp/body.txt
  bun scripts/gmail.js trash 18f1a2b3c4d5e6f7
  bun scripts/gmail.js trash-by-sender --sender lensa.com --sender ladders.com --dry-run`);
  process.exit(1);
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
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

function handleApiError(err, context) {
  const status = err.code || err.status;
  const reason = err.message || 'unknown error';
  if (status === 401 || status === 403) {
    console.error(`Auth error (${status}): ${reason}`);
    console.error('Re-authenticate with: bun scripts/gmail.js auth');
    process.exit(1);
  }
  console.error(`Error: ${context} [${status || 'unknown'}] ${reason}`);
  process.exit(1);
}

async function authCommand() {
  const url = getAuthUrl(ROOT);
  console.log('Open this URL in your browser to authorize:\n');
  console.log(url);
  console.log('\nWaiting for authorization...');

  return new Promise((resolve, reject) => {
    const TIMEOUT = 5 * 60 * 1000;
    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url, 'http://localhost:3000');
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
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Authorization failed: ' + err.message);
        clearTimeout(timer);
        server.close();
        reject(err);
      }
    });
    server.on('error', (err) => {
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

async function profileCommand() {
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

function getHeader(headers, name) {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

async function searchCommand(args) {
  const { flags, positional } = parseFlags(args);
  const query = positional[0];
  if (!query) {
    console.error('Error: search query is required.');
    process.exit(1);
  }
  const maxResults = parseInt(flags.max || '10', 10);

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
    const messages = list.data.messages || [];
    const results = [];
    for (const { id } of messages) {
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

function encodeRfc822(to, subject, body) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ];
  const message = lines.join('\r\n');
  return Buffer.from(message).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createDraftCommand(args) {
  const { flags } = parseFlags(args);
  if (!flags.to) {
    console.error('Error: --to is required.');
    process.exit(1);
  }
  if (!flags.subject) {
    console.error('Error: --subject is required.');
    process.exit(1);
  }
  if (!flags['body-file']) {
    console.error('Error: --body-file is required.');
    process.exit(1);
  }
  if (!fs.existsSync(flags['body-file'])) {
    console.error(`Error: body file not found: ${flags['body-file']}`);
    process.exit(1);
  }
  const body = fs.readFileSync(flags['body-file'], 'utf8');

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    const raw = encodeRfc822(flags.to, flags.subject, body);
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
function parseTrashBySenderArgs(args) {
  const senders = [];
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

// Format per-pattern results as `trashed: pat1=M/N pat2=X/Y ...` matching
// the AppleScript output that auto_trash_inbox.js parses. Optional
// suffixes:
//   - `(errors: pat=id:code|id:code ...)` when any per-message trash failed
//   - `(cap-hit: pat=N ...)` when any pattern hit MAX_MATCHES_PER_PATTERN
//
// The cap-hit suffix lives inside stdout (not stderr) so the Phase 6
// orchestrator does NOT misclassify a capped-but-successful run as a
// Gmail API failure via the stderr-non-empty-with-status-0 rule.
// detectPartialFailure in lib/trash-output.js strips both `(errors: ...)`
// and subsequent suffixes at `(` boundaries, so adding new suffixes is
// safe as long as they come after the core entries.
//
// Exported for unit testing — see tests/gmail-helpers.test.js.
function formatTrashBySenderOutput(results) {
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
const DEFAULT_MAX_MATCHES_PER_PATTERN = 500;

function resolveMaxMatches(env) {
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
async function listMatchingIds(gmail, sender, newerThan, maxMatches) {
  const q = `from:${sender} in:inbox newer_than:${newerThan}`;
  const ids = [];
  let pageToken;
  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 100,
      pageToken,
    });
    const page = res.data.messages || [];
    for (const m of page) ids.push(m.id);
    pageToken = res.data.nextPageToken;
    if (ids.length >= maxMatches) {
      return { ids: ids.slice(0, maxMatches), capHit: true };
    }
  } while (pageToken);
  return { ids, capHit: false };
}

// Process a single sender: list matching IDs, trash them one by one,
// return a result record. A thrown error indicates an unrecoverable
// failure for this run (auth expired, list API died) — the caller is
// expected to stop iterating, flush the summary for patterns already
// attempted, and exit 1.
async function processSender(gmail, sender, opts) {
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
  const errors = [];
  let moved = 0;
  for (const id of ids) {
    try {
      await gmail.users.messages.trash({ userId: 'me', id });
      moved++;
    } catch (err) {
      const status = err.code || err.status;
      // Auth errors mid-loop are unrecoverable — propagate so the
      // caller can flush the summary and exit 1. Non-auth errors
      // (per-message 404, 500, etc.) go into the errors array and
      // surface as a partial failure via classifyGmailResult.
      if (status === 401 || status === 403) {
        throw err;
      }
      errors.push(`${id}:${status || 'err'}`);
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

async function trashBySenderCommand(args, envOverride) {
  const env = envOverride || process.env;

  let parsed;
  try {
    parsed = parseTrashBySenderArgs(args);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
  if (parsed.senders.length === 0) {
    console.error(
      'error: trash-by-sender requires at least one --sender <substring>'
    );
    process.exit(1);
  }

  let maxMatches;
  try {
    maxMatches = resolveMaxMatches(env);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  // Single exit point: every termination path below flushes the
  // partial summary before process.exit so the user (and the Phase 6
  // orchestrator) can see what was attempted, even on mid-run failure.
  const results = [];
  let fatalError = null;

  for (const sender of parsed.senders) {
    try {
      const r = await processSender(gmail, sender, {
        newerThan: parsed.newerThan,
        maxMatches,
        dryRun: parsed.dryRun,
      });
      results.push(r);
    } catch (err) {
      const status = err.code || err.status;
      const reason = err.message || 'unknown error';
      if (status === 401 || status === 403) {
        fatalError = {
          kind: 'AUTH_REQUIRED',
          message: reason,
          sender,
        };
      } else {
        fatalError = {
          kind: 'GMAIL_ERROR',
          message: `list failed for "${sender}" [${status || 'unknown'}] ${reason}`,
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
      console.error('Re-authenticate with: bun scripts/gmail.js auth');
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

async function trashCommand(messageIds) {
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
      const status = err.code || err.status;
      const reason = err.message || 'unknown error';

      if (status === 401 || status === 403) {
        console.error(`Auth error (${status}): ${reason}`);
        console.error('Re-authenticate with: bun scripts/gmail.js auth');
        process.exit(1);
      }

      console.error(`error: ${id} [${status || 'unknown'}] ${reason}`);
      failed++;
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
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

// Export pure helpers for unit testing. When run as a CLI
// (require.main === module), main() is invoked below; when required
// from a test, only the exports are visible and main() does not run.
module.exports = {
  parseTrashBySenderArgs,
  formatTrashBySenderOutput,
  listMatchingIds,
  processSender,
  resolveMaxMatches,
  DEFAULT_MAX_MATCHES_PER_PATTERN,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
