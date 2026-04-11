# Follow-Up Draft Skill + Gmail Trash Utility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/follow-up` skill that drafts personalized follow-up emails for stale applications, and a `scripts/gmail.js` utility that trashes processed Gmail messages so scan-email can clean up after itself.

**Architecture:** Two independent deliverables — a thin Node.js CLI (`scripts/gmail.js`) wrapping `googleapis` for OAuth2 + trash, and a Claude Code skill (`skills/follow-up/SKILL.md`) that reads application state, identifies stale apps, and creates Gmail drafts via built-in MCP. The scan-email skill is updated to call the trash script in Phase 6.

**Tech Stack:** Node.js (CommonJS, matches existing `scripts/`), `googleapis` npm package, `node:test` for tests, built-in Gmail MCP for drafts.

**Spec:** `docs/superpowers/specs/2026-04-11-follow-up-gmail-trash-design.md`

---

## File Structure

```text
credentials/                        # gitignored — user provides gmail-client-secret.json
  gmail-client-secret.json          # Google Cloud OAuth2 Desktop client
  gmail-tokens.json                 # Auto-generated on first auth

scripts/
  gmail.js                          # CLI entry: auth + trash commands
  lib/gmail-auth.js                 # OAuth2 load/refresh/save tokens

tests/
  gmail-auth.test.js                # Token load/save/refresh logic
  gmail-cli.test.js                 # CLI argument parsing, trash command

skills/
  follow-up/
    SKILL.md                        # Main skill definition

.claude/commands/
  follow-up.md                      # Slash command registration
```

---

### Task 1: Add `googleapis` dependency and `credentials/` to .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add `googleapis` dependency**

```bash
cd /Users/cantu/repos/job-seeker && bun add googleapis
```

Expected: `googleapis` appears in `package.json` dependencies, `node_modules/` updated.

- [ ] **Step 2: Verify installation**

```bash
cd /Users/cantu/repos/job-seeker && bun -e "const { google } = require('googleapis'); console.log('ok:', typeof google.gmail)"
```

Expected: `ok: function`

- [ ] **Step 3: Add `credentials/` to .gitignore**

Add to `.gitignore` after the existing `# OS files` section:

```text
# Gmail API credentials (OAuth2 tokens — personal)
credentials/
```

- [ ] **Step 4: Create credentials directory with .gitkeep**

```bash
mkdir -p /Users/cantu/repos/job-seeker/credentials
touch /Users/cantu/repos/job-seeker/credentials/.gitkeep
```

Note: `.gitkeep` won't be tracked since `credentials/` is gitignored, but the directory is needed at runtime. The `gmail-auth.js` module will create it if missing.

- [ ] **Step 5: Commit**

```bash
cd /Users/cantu/repos/job-seeker && git add package.json bun.lockb .gitignore && git commit -m "chore: add googleapis dependency and gitignore credentials/"
```

---

### Task 2: Implement `scripts/lib/gmail-auth.js` — OAuth2 token management

**Files:**
- Create: `scripts/lib/gmail-auth.js`
- Create: `tests/gmail-auth.test.js`

- [ ] **Step 1: Write the failing test for token loading**

Create `tests/gmail-auth.test.js`:

```js
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/cantu/repos/job-seeker && bun test tests/gmail-auth.test.js
```

Expected: FAIL — `Cannot find module '../scripts/lib/gmail-auth'`

- [ ] **Step 3: Implement gmail-auth.js**

Create `scripts/lib/gmail-auth.js`:

```js
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
  return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
}

function saveTokens(tokenPath, tokens) {
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
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
    const merged = { ...tokens, ...newTokens };
    saveTokens(paths.tokens, merged);
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/cantu/repos/job-seeker && bun test tests/gmail-auth.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/cantu/repos/job-seeker && git add scripts/lib/gmail-auth.js tests/gmail-auth.test.js && git commit -m "feat: add Gmail OAuth2 token management (scripts/lib/gmail-auth.js)"
```

---

### Task 3: Implement `scripts/gmail.js` — CLI entry point

**Files:**
- Create: `scripts/gmail.js`
- Create: `tests/gmail-cli.test.js`

- [ ] **Step 1: Write the failing test for CLI argument parsing**

Create `tests/gmail-cli.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'scripts', 'gmail.js');

describe('gmail CLI', () => {
  describe('usage', () => {
    it('prints usage and exits 1 with no arguments', () => {
      try {
        execSync(`bun ${CLI}`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('Usage:'), `expected usage in stderr, got: ${err.stderr}`);
        assert.equal(err.status, 1);
      }
    });

    it('prints usage for unknown command', () => {
      try {
        execSync(`bun ${CLI} unknown`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('Usage:'));
        assert.equal(err.status, 1);
      }
    });
  });

  describe('trash command', () => {
    it('exits 1 with error when no message IDs provided', () => {
      try {
        execSync(`bun ${CLI} trash`, { encoding: 'utf8', stdio: 'pipe' });
        assert.fail('should have exited non-zero');
      } catch (err) {
        assert.ok(err.stderr.includes('at least one message ID'));
        assert.equal(err.status, 1);
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/cantu/repos/job-seeker && bun test tests/gmail-cli.test.js
```

Expected: FAIL — script does not exist.

- [ ] **Step 3: Implement gmail.js CLI**

Create `scripts/gmail.js`:

```js
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
  resolveCredentialPaths,
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/cantu/repos/job-seeker && bun test tests/gmail-cli.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/cantu/repos/job-seeker && git add scripts/gmail.js tests/gmail-cli.test.js && git commit -m "feat: add Gmail CLI with auth and trash commands (scripts/gmail.js)"
```

---

### Task 4: Update scan-email skill to trash Gmail messages

**Files:**
- Modify: `skills/scan-email/SKILL.md:196-234`

- [ ] **Step 1: Replace the Gmail cleanup report section**

In `skills/scan-email/SKILL.md`, replace lines 196-199:

```markdown
### Gmail cleanup report
Skip if `gmail_enabled = false` or no Gmail candidates body-fetched.

Report processed messages for manual cleanup (Gmail MCP cannot trash).
```

With:

```markdown
### Trash Gmail alerts
Skip if `gmail_enabled = false` or no Gmail candidates body-fetched.

Collect all `messageId`s from Gmail candidates that were body-fetched AND
presented in the Phase 5 confirmation table.

**Check credentials first:**
```bash
test -f {plugin_root}/credentials/gmail-client-secret.json && test -f {plugin_root}/credentials/gmail-tokens.json && echo "ready" || echo "not-configured"
```

If `not-configured`, fall back to manual cleanup report:
> "Gmail trash not configured. Run `bun scripts/gmail.js auth` to enable
> automatic cleanup. Processed Gmail messages for manual review:
> {list messageIds}"

If `ready`, trash in one call:
```bash
bun {plugin_root}/scripts/gmail.js trash {id1} {id2} ...
```

Parse output: count `trashed:` lines for success, surface any `error:` lines.
Report: "Trashed {N} Gmail messages." or "Trashed {N}/{total} Gmail messages
({errors} failed — check manually)."
```

- [ ] **Step 2: Update the Key Constraints section**

In `skills/scan-email/SKILL.md`, change line 220:

```markdown
- Apple Mail: read + trash; Gmail: read only
```

To:

```markdown
- Apple Mail: read + trash; Gmail: read + trash (via scripts/gmail.js)
```

- [ ] **Step 3: Remove the Gmail trash future enhancement**

In `skills/scan-email/SKILL.md`, remove line 234:

```markdown
- Gmail trash support (when MCP adds message modification)
```

- [ ] **Step 4: Update the skill description in frontmatter**

In `skills/scan-email/SKILL.md`, update the description (lines 3-8) to replace:

```markdown
  Processed Apple Mail alerts
  are trashed; Gmail alerts are reported for manual cleanup (MCP limitation).
```

With:

```markdown
  Processed alerts are trashed from both Apple Mail and Gmail.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/cantu/repos/job-seeker && git add skills/scan-email/SKILL.md && git commit -m "feat(scan-email): add Gmail trash support via scripts/gmail.js (#17)"
```

---

### Task 5: Create the `/follow-up` skill

**Files:**
- Create: `skills/follow-up/SKILL.md`
- Create: `.claude/commands/follow-up.md`

- [ ] **Step 1: Create the slash command registration**

Create `.claude/commands/follow-up.md`:

```markdown
Read and execute skills/follow-up/SKILL.md for the current session.
Use $ARGUMENTS as the user's input if provided.
```

- [ ] **Step 2: Create the skill definition**

Create `skills/follow-up/SKILL.md`:

```markdown
---
name: follow-up
description: >
  Identify stale applications and draft personalized follow-up emails.
  Reads application state, filters by staleness thresholds, generates
  emails per voice-guide, creates Gmail drafts via MCP, and updates
  application state. Never sends automatically — always drafts for review.
  Triggers: "draft follow-ups", "follow up on applications", "any stale apps",
  "what needs follow-up"
allowed-tools: Read, Write, Edit, Bash, Glob
---

# Follow-Up

Draft personalized follow-up emails for stale applications. Creates Gmail
drafts for user review — never sends automatically.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute.

Additionally:
- Read `references/voice-guide.md` — tone and anti-patterns for email copy
- Read `integrations/config/gmail-config.md` — verify Gmail is enabled

If Gmail is not enabled, stop:
> "Gmail is required for follow-up drafts. Configure it first:
> copy `integrations/config/gmail-config.md.example` to `gmail-config.md`"

Verify Gmail MCP connection: `[gmail_get_profile]`. If error, stop with
guidance.

## Phase 1 — Identify Stale Applications

Read application state:
```bash
bun scripts/state.js read applications
```

Parse the JSON output. Filter for **active applications** that meet staleness
thresholds:

| Stage | Days since last activity |
| ----- | ----------------------- |
| Applied | 10 |
| Screen | 7 |
| Interview (1) | 5 |
| Interview (2+) | 5 |
| Final Round | 5 |
| Offer | 3 |
| Decision | 3 |

Calculate days since last activity using `lastActivity.date` and today's date.

**Skip** entries where:
- Stage is Discovery, Research, or Closed
- Stage starts with `Closed`

If `$ARGUMENTS` contains a company name, filter to only that company
(case-insensitive substring match) regardless of staleness threshold.

If no stale applications found:
> "No stale applications found. All active apps have recent activity."

Stop.

## Phase 2 — Present Candidates

Show the stale applications in a table:

```text
Stale Applications — Follow-Up Candidates
──────────────────────────────────────────────────
 # | Company          | Role                  | Stage          | Last Activity    | Days
 1 | Acme Corp        | VP Engineering        | Applied        | 2026-03-28       | 14
 2 | Widgets Inc      | Sr Dir Engineering    | Interview (1)  | 2026-04-04       | 7
──────────────────────────────────────────────────
```

Ask the user which applications to draft follow-ups for:
> "Which ones should I draft follow-ups for? (e.g., '1,2', 'all', or 'none')"

If `none`, stop.

## Phase 3 — Resolve Recipients

For each selected application, resolve the recipient email address:

**Step 3a: Check Contacts field**
If the application entry has a contact name, ask the user:
> "{Company}: Contact is {name}. What's their email address?"

**Step 3b: Search Gmail for prior correspondence**
If no contact or user says "search":
```
[gmail_search_messages: query="from:@{company-domain} OR to:@{company-domain}" maxResults=5]
```

Read the most recent thread to extract the recruiter/HR email address.
Present the found address to the user for confirmation.

**Step 3c: Ask directly**
If neither source yields an address:
> "{Company}: I couldn't find a contact email. Who should this go to?"

Do NOT store the resolved email in application state (privacy constraint).

## Phase 4 — Generate and Draft

For each selected application:

### Step 4a: Gather context

Check for existing company materials:
- `output/{company-slug}/company-research.md`
- `output/{company-slug}/*CoverLetter*.md`
- `output/{company-slug}/*ResumeTailor*.md`
- `output/{company-slug}/why-this-company*.md`

Read any that exist — use them to personalize the follow-up with a brief
value connection (1 sentence max).

Read `config/candidate.md` for the candidate's name.

### Step 4b: Generate email body

Write a follow-up email following these rules from `references/voice-guide.md`:

**Tone**: peer-to-peer, direct, warm. Not desperate, not corporate.

**Structure**:
1. Opening: Reference the specific role and last interaction
   ("Following up on the {title} conversation from {timeframe}")
2. Value connection: One sentence connecting candidate strengths to the
   role, drawn from company research or cover letter if available.
   Skip if no context exists — don't fabricate.
3. Close: Point forward with a low-pressure ask
   ("Happy to share anything else that would be helpful for next steps")
4. Sign-off: "Best, {candidate_name}"

**Banned phrases** — do not use any of these:
- "just checking in"
- "circling back"
- "touching base"
- "I'm passionate about"
- "uniquely positioned"
- "leverage my experience"
- "I wanted to follow up" (use active framing instead)

**Format**: Plain text. No HTML, no markdown formatting.

**Length**: 4-6 sentences. Short enough to read on a phone.

**Subject line**: "Re: {role title} — {company}" or
"Following up — {role title} at {company}"

### Step 4c: Show draft for approval

Present the draft to the user:

```text
──────────────────────────────────────────────────
To: {email}
Subject: {subject}

{body}
──────────────────────────────────────────────────
```

Ask: "Send this to Gmail drafts? (yes / edit / skip)"

- **yes**: proceed to create draft
- **edit**: ask what to change, regenerate, show again
- **skip**: move to next application

### Step 4d: Create Gmail draft

```
[gmail_create_draft: to="{email}" subject="{subject}" body="{body}"]
```

Report: "Draft created for {Company}."

### Step 4e: Update application state

Update the **Next action** field to `Review and send follow-up draft in Gmail`
by reading the applications state file, finding the entry, editing the
`Next action` line, and writing it back.

Then append a note via CLI (this updates `lastActivity` and `history`
automatically — see `scripts/lib/applications.js:404-422`):

```bash
bun scripts/state.js add-note applications --company "{company}" --note "Follow-up drafted {today} via /follow-up"
```

## Phase 5 — Summary

After all selected applications are processed:

> "Created {N} follow-up draft(s) in Gmail — review before sending.
> {list of companies with draft status}"

## Error Handling

| Condition | Behavior |
| --------- | -------- |
| No applications file | Stop: "No applications tracked yet. Use /application-tracker first." |
| Gmail MCP error | Stop: show connection guidance |
| gmail_create_draft fails | Report error, continue with next app |
| state.js add-note fails | Warn, continue — draft was still created |
| Company slug directory missing | Skip context gathering, draft without personalization |

## Key Constraints

- Never send emails automatically — always create drafts for user review
- Follow voice-guide.md tone — peer-to-peer, no desperation
- Do not store recruiter email addresses in application state
- User confirms each draft before it goes to Gmail
- Plain text only — no HTML emails
```

- [ ] **Step 3: Verify skill file is valid YAML frontmatter**

```bash
cd /Users/cantu/repos/job-seeker && bun -e "const { parseFrontmatter } = require('./scripts/lib/frontmatter'); const fs = require('fs'); const content = fs.readFileSync('skills/follow-up/SKILL.md', 'utf8'); const { meta } = parseFrontmatter(content); console.log(JSON.stringify(meta, null, 2))"
```

Expected: Prints parsed frontmatter with `name: follow-up` and `description`.

- [ ] **Step 4: Commit**

```bash
cd /Users/cantu/repos/job-seeker && git add skills/follow-up/SKILL.md .claude/commands/follow-up.md && git commit -m "feat: add /follow-up skill for stale application draft emails (#17)"
```

---

### Task 6: Update CLAUDE.md skill routing and setup skill

**Files:**
- Modify: `CLAUDE.md`
- Modify: `skills/setup/SKILL.md`

- [ ] **Step 1: Add follow-up to CLAUDE.md skill routing table**

In `CLAUDE.md`, add a new row to the skill routing table (after the interview-prep row):

```markdown
| draft follow-ups, follow up on applications, any stale apps, what needs follow-up | `/follow-up` |
```

- [ ] **Step 2: Add Gmail API credential checks to setup skill**

In `skills/setup/SKILL.md`, add a new optional check after section `2e` (Apple Notes). Add as `2f`:

```markdown
### 2f — credentials/gmail-client-secret.json (optional)

Explain what Gmail API credentials provide:
> "The Gmail API integration lets scan-email automatically trash processed
> job alert emails instead of requiring manual cleanup. It requires a
> Google Cloud project with the Gmail API enabled.
>
> Want to set it up?"

If yes:
1. Guide the user through Google Cloud Console:
   - Go to https://console.cloud.google.com/
   - Create a project (or select existing)
   - Enable the Gmail API
   - Create OAuth 2.0 credentials (Desktop application type)
   - Download the JSON file
2. Ask the user to save it as `credentials/gmail-client-secret.json`
3. Run `bun scripts/gmail.js auth` to complete the OAuth flow
4. Verify: check that `credentials/gmail-tokens.json` was created

If no, move on. This is optional — scan-email falls back to manual
cleanup reports without it.
```

Also add to the Phase 1 optional checks:

```markdown
6. **credentials/gmail-client-secret.json** — does it exist? If yes, does
   `credentials/gmail-tokens.json` also exist (authenticated)?
```

- [ ] **Step 3: Commit**

```bash
cd /Users/cantu/repos/job-seeker && git add CLAUDE.md skills/setup/SKILL.md && git commit -m "feat: add /follow-up to skill routing and Gmail API setup check (#17)"
```

---

### Task 7: Full integration verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/cantu/repos/job-seeker && bun test
```

Expected: All existing tests pass, plus the new `gmail-auth.test.js` and `gmail-cli.test.js` tests.

- [ ] **Step 2: Verify skill frontmatter parses correctly**

```bash
cd /Users/cantu/repos/job-seeker && bun -e "const { parseFrontmatter } = require('./scripts/lib/frontmatter'); const fs = require('fs'); ['skills/follow-up/SKILL.md', 'skills/scan-email/SKILL.md'].forEach(f => { const { meta } = parseFrontmatter(fs.readFileSync(f, 'utf8')); console.log(f + ':', meta.name) })"
```

Expected:
```text
skills/follow-up/SKILL.md: follow-up
skills/scan-email/SKILL.md: scan-email
```

- [ ] **Step 3: Verify slash command registration**

```bash
ls /Users/cantu/repos/job-seeker/.claude/commands/follow-up.md && echo "exists"
```

Expected: `exists`

- [ ] **Step 4: Verify gmail CLI shows usage**

```bash
cd /Users/cantu/repos/job-seeker && bun scripts/gmail.js 2>&1; true
```

Expected: Usage text with `auth` and `trash` commands listed.

- [ ] **Step 5: Verify .gitignore covers credentials**

```bash
cd /Users/cantu/repos/job-seeker && git status credentials/ 2>&1
```

Expected: No untracked files shown (directory is gitignored).

- [ ] **Step 6: Final commit if any fixups needed**

If any verification steps required fixes, commit them:

```bash
cd /Users/cantu/repos/job-seeker && git add -A && git commit -m "fix: address integration verification findings (#17)"
```

Skip if no changes needed.
