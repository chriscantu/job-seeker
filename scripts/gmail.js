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
// flags are a hard error (printed to stderr; caller exits 1). Kept
// separate from parseFlags() because parseFlags overwrites repeated
// keys, which would silently drop all but the last --sender.
function parseTrashBySenderArgs(args) {
  const senders = [];
  let newerThan = '30d';
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--sender') {
      const v = args[i + 1];
      if (!v || v.startsWith('--')) {
        throw new Error('--sender requires a value');
      }
      senders.push(v);
      i++;
    } else if (a === '--newer-than') {
      const v = args[i + 1];
      if (!v || v.startsWith('--')) {
        throw new Error('--newer-than requires a value (e.g. 30d, 7d, 1y)');
      }
      newerThan = v;
      i++;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '-h' || a === '--help') {
      usage();
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  return { senders, newerThan, dryRun };
}

// Format per-pattern results as `trashed: pat1=M/N pat2=X/Y ...` matching
// the AppleScript output that auto_trash_inbox.js parses. Append an
// `(errors: ...)` suffix when any pattern had per-message trash failures,
// so classifyGmailResult can detect partial failures with the same regex
// shared with the Apple Mail path.
function formatTrashBySenderOutput(results) {
  const parts = results.map((r) => `${r.pattern}=${r.moved}/${r.matched}`);
  const line = `trashed: ${parts.join(' ')}`;
  const errored = results.filter((r) => r.errors && r.errors.length > 0);
  if (errored.length === 0) {
    return line;
  }
  const errSummary = errored
    .map((r) => `${r.pattern}=${r.errors.join('|')}`)
    .join(' ');
  return `${line} (errors: ${errSummary})`;
}

// List INBOX messages matching `from:<sender> newer_than:<window>`,
// paging through nextPageToken. Returns an array of message IDs. Caps
// at 500 to protect against a misconfigured pattern matching thousands
// of messages — a config-level anomaly that should be flagged, not
// silently trashed.
const MAX_MATCHES_PER_PATTERN = 500;

async function listMatchingIds(gmail, sender, newerThan) {
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
    if (ids.length >= MAX_MATCHES_PER_PATTERN) {
      console.error(
        `warning: sender "${sender}" matched ≥${MAX_MATCHES_PER_PATTERN} messages; ` +
          `trashing the first ${MAX_MATCHES_PER_PATTERN}. ` +
          `Tighten --newer-than or check config/search.md for an overly broad substring.`
      );
      return ids.slice(0, MAX_MATCHES_PER_PATTERN);
    }
  } while (pageToken);
  return ids;
}

async function trashBySenderCommand(args) {
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

  const auth = getAuthenticatedClient(ROOT);
  const gmail = google.gmail({ version: 'v1', auth });

  const results = [];
  for (const sender of parsed.senders) {
    let ids;
    try {
      ids = await listMatchingIds(gmail, sender, parsed.newerThan);
    } catch (err) {
      const status = err.code || err.status;
      const reason = err.message || 'unknown error';
      if (status === 401 || status === 403) {
        console.error(`AUTH_REQUIRED: ${reason}`);
        console.error('Re-authenticate with: bun scripts/gmail.js auth');
        process.exit(1);
      }
      console.error(
        `GMAIL_ERROR: list failed for "${sender}" [${status || 'unknown'}] ${reason}`
      );
      process.exit(1);
    }

    if (parsed.dryRun) {
      results.push({
        pattern: sender,
        moved: ids.length,
        matched: ids.length,
        errors: [],
        ids,
      });
      continue;
    }

    // Per-message trash so we can track per-pattern moved/matched for
    // partial-failure detection. batchModify is atomic and can't report
    // partial progress.
    const errors = [];
    let moved = 0;
    for (const id of ids) {
      try {
        await gmail.users.messages.trash({ userId: 'me', id });
        moved++;
      } catch (err) {
        const status = err.code || err.status;
        const reason = err.message || 'unknown error';
        if (status === 401 || status === 403) {
          console.error(`AUTH_REQUIRED: ${reason}`);
          console.error('Re-authenticate with: bun scripts/gmail.js auth');
          process.exit(1);
        }
        errors.push(`${id}:${status || 'err'}`);
      }
    }
    results.push({
      pattern: sender,
      moved,
      matched: ids.length,
      errors,
    });
  }

  // Always print the `trashed: ...` summary line — including 0/0 entries
  // — so the caller (auto_trash_gmail.js / scan-email Phase 6) can spot
  // typos and verify every configured pattern was attempted.
  console.log(formatTrashBySenderOutput(results));

  if (parsed.dryRun) {
    // Also print per-pattern ID lists for operator inspection.
    for (const r of results) {
      if (r.ids && r.ids.length > 0) {
        console.log(`  ${r.pattern}: ${r.ids.join(' ')}`);
      }
    }
  }

  const anyPartial = results.some((r) => r.moved < r.matched);
  process.exit(anyPartial ? 1 : 0);
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

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
