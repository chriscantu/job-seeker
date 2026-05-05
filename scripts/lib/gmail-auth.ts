import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';

export const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

export interface CredentialPaths {
  clientSecret: string;
  tokens: string;
}

export function resolveCredentialPaths(projectRoot: string): CredentialPaths {
  const dir = path.join(projectRoot, 'credentials');
  return {
    clientSecret: path.join(dir, 'gmail-client-secret.json'),
    tokens: path.join(dir, 'gmail-tokens.json'),
  };
}

export function loadTokens(tokenPath: string): Record<string, unknown> | null {
  if (!fs.existsSync(tokenPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
  } catch {
    throw new Error(
      `Token file is corrupted: ${tokenPath}. Delete it and run: bun scripts/gmail.js auth`
    );
  }
}

export function saveTokens(tokenPath: string, tokens: Record<string, unknown>): void {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function createOAuth2Client(clientSecretPath: string) {
  if (!fs.existsSync(clientSecretPath)) {
    throw new Error(`Client secret file not found: ${clientSecretPath}`);
  }
  const content = JSON.parse(fs.readFileSync(clientSecretPath, 'utf8'));
  const { client_id, client_secret } = content.installed || content.web || {};
  if (!client_id || !client_secret) {
    throw new Error('Invalid client secret file: missing client_id or client_secret');
  }
  // Always use our loopback redirect URI. Google's Desktop app OAuth clients
  // ship with `redirect_uris: ["http://localhost"]` (no port), but the OAuth
  // server accepts any `http://localhost:PORT` for Desktop type clients — so
  // we hardcode the port our callback server listens on.
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

export function getAuthenticatedClient(projectRoot: string) {
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
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Warning: failed to persist refreshed tokens: ${message}`);
      console.error('You may need to re-authenticate: bun scripts/gmail.js auth');
    }
  });
  return oauth2;
}

export function getAuthUrl(projectRoot: string): string {
  const paths = resolveCredentialPaths(projectRoot);
  const oauth2 = createOAuth2Client(paths.clientSecret);
  return oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
}

export async function exchangeCode(projectRoot: string, code: string): Promise<Record<string, unknown>> {
  const paths = resolveCredentialPaths(projectRoot);
  const oauth2 = createOAuth2Client(paths.clientSecret);
  const { tokens } = await oauth2.getToken(code);
  saveTokens(paths.tokens, tokens as Record<string, unknown>);
  return tokens as Record<string, unknown>;
}
