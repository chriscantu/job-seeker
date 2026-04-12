const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

function resolveCredentialPaths(projectRoot) {
  const dir = path.join(projectRoot, 'credentials');
  return {
    clientSecret: path.join(dir, 'gmail-client-secret.json'),
    tokens: path.join(dir, 'gmail-tokens.json'),
  };
}

function loadTokens(tokenPath) {
  if (!fs.existsSync(tokenPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  } catch {
    throw new Error(
      `Token file is corrupted: ${tokenPath}. Delete it and run: bun scripts/gmail.js auth`
    );
  }
}

function saveTokens(tokenPath, tokens) {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

function createOAuth2Client(clientSecretPath) {
  if (!fs.existsSync(clientSecretPath)) {
    throw new Error(`Client secret file not found: ${clientSecretPath}`);
  }
  const content = JSON.parse(fs.readFileSync(clientSecretPath, 'utf8'));
  const { client_id, client_secret, redirect_uris } = content.installed || content.web || {};
  if (!client_id || !client_secret) {
    throw new Error('Invalid client secret file: missing client_id or client_secret');
  }
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || REDIRECT_URI);
}

function getAuthenticatedClient(projectRoot) {
  const paths = resolveCredentialPaths(projectRoot);
  const oauth2 = createOAuth2Client(paths.clientSecret);
  const tokens = loadTokens(paths.tokens);
  if (!tokens) {
    throw new Error(
      'Not authenticated. Run: bun scripts/gmail.js auth'
    );
  }
  oauth2.setCredentials(tokens);
  oauth2.on('tokens', (newTokens) => {
    try {
      const current = loadTokens(paths.tokens) || tokens;
      const merged = { ...current, ...newTokens };
      saveTokens(paths.tokens, merged);
    } catch (err) {
      console.error(`Warning: failed to persist refreshed tokens: ${err.message}`);
      console.error('You may need to re-authenticate: bun scripts/gmail.js auth');
    }
  });
  return oauth2;
}

function getAuthUrl(projectRoot) {
  const paths = resolveCredentialPaths(projectRoot);
  const oauth2 = createOAuth2Client(paths.clientSecret);
  return oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
}

async function exchangeCode(projectRoot, code) {
  const paths = resolveCredentialPaths(projectRoot);
  const oauth2 = createOAuth2Client(paths.clientSecret);
  const { tokens } = await oauth2.getToken(code);
  saveTokens(paths.tokens, tokens);
  return tokens;
}

module.exports = {
  SCOPES,
  resolveCredentialPaths,
  loadTokens,
  saveTokens,
  createOAuth2Client,
  getAuthenticatedClient,
  getAuthUrl,
  exchangeCode,
};
