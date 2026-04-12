#!/usr/bin/env node
// scripts/gmail.js
// Thin CLI for Gmail API operations that the built-in MCP cannot do.
//
// Usage:
//   bun scripts/gmail.js auth              # One-time OAuth2 consent flow
//   bun scripts/gmail.js trash <id>...     # Trash messages by ID
//
// Exit codes: 0 = success, 1 = error

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
  auth              Authenticate with Gmail (one-time browser consent)
  trash <id>...     Trash one or more messages by Gmail message ID

Examples:
  bun scripts/gmail.js auth
  bun scripts/gmail.js trash 18f1a2b3c4d5e6f7 18f1a2b3c4d5e6f8`);
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
    case 'trash':
      await trashCommand(args.slice(1));
      break;
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
