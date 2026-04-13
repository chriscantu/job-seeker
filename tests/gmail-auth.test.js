const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('gmail-auth', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmail-auth-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('resolveCredentialPaths', () => {
    it('returns default paths relative to project root', () => {
      const { resolveCredentialPaths } = require('../scripts/lib/gmail-auth');
      const paths = resolveCredentialPaths(tmpDir);
      assert.equal(paths.clientSecret, path.join(tmpDir, 'credentials', 'gmail-client-secret.json'));
      assert.equal(paths.tokens, path.join(tmpDir, 'credentials', 'gmail-tokens.json'));
    });
  });

  describe('loadTokens', () => {
    it('returns null when token file does not exist', () => {
      const { loadTokens } = require('../scripts/lib/gmail-auth');
      const result = loadTokens(path.join(tmpDir, 'nonexistent.json'));
      assert.equal(result, null);
    });

    it('returns parsed JSON when token file exists', () => {
      const { loadTokens } = require('../scripts/lib/gmail-auth');
      const tokenPath = path.join(tmpDir, 'tokens.json');
      const tokens = { access_token: 'test-access', refresh_token: 'test-refresh' };
      fs.writeFileSync(tokenPath, JSON.stringify(tokens));
      const result = loadTokens(tokenPath);
      assert.deepEqual(result, tokens);
    });
  });

  describe('saveTokens', () => {
    it('writes tokens to file, creating parent directory', () => {
      const { saveTokens } = require('../scripts/lib/gmail-auth');
      const tokenPath = path.join(tmpDir, 'sub', 'tokens.json');
      const tokens = { access_token: 'a', refresh_token: 'r' };
      saveTokens(tokenPath, tokens);
      const saved = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      assert.deepEqual(saved, tokens);
    });
  });

  describe('createOAuth2Client', () => {
    it('throws when client secret file does not exist', () => {
      const { createOAuth2Client } = require('../scripts/lib/gmail-auth');
      assert.throws(
        () => createOAuth2Client(path.join(tmpDir, 'missing.json')),
        /client secret file not found/i
      );
    });

    it('creates OAuth2 client from valid client secret file', () => {
      const { createOAuth2Client } = require('../scripts/lib/gmail-auth');
      const secretPath = path.join(tmpDir, 'client_secret.json');
      fs.writeFileSync(secretPath, JSON.stringify({
        installed: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uris: ['http://localhost'],
        },
      }));
      const client = createOAuth2Client(secretPath);
      assert.ok(client);
      assert.equal(typeof client.generateAuthUrl, 'function');
    });

    // Desktop-app OAuth clients ship with `redirect_uris: ["http://localhost"]`
    // (no port). Our callback server listens on :3000, so the client must use
    // the ported form regardless of what's in the client secret — otherwise
    // auth can never complete.
    it('uses the hardcoded loopback redirect URI regardless of client secret contents', () => {
      const { createOAuth2Client } = require('../scripts/lib/gmail-auth');
      const bareLocalhost = path.join(tmpDir, 'bare.json');
      fs.writeFileSync(bareLocalhost, JSON.stringify({
        installed: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uris: ['http://localhost'],
        },
      }));
      assert.equal(
        createOAuth2Client(bareLocalhost).redirectUri,
        'http://localhost:3000/oauth2callback'
      );

      const unrelated = path.join(tmpDir, 'unrelated.json');
      fs.writeFileSync(unrelated, JSON.stringify({
        installed: {
          client_id: 'test-id',
          client_secret: 'test-secret',
          redirect_uris: ['https://example.com/callback'],
        },
      }));
      assert.equal(
        createOAuth2Client(unrelated).redirectUri,
        'http://localhost:3000/oauth2callback'
      );
    });
  });
});
