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
        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Authorization failed: ' + err.message);
        server.close();
        reject(err);
      }
    });
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
      const reason = err.message || 'unknown error';
      console.error(`error: ${id} ${reason}`);
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
