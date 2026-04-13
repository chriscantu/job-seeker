# scan-email Status Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a parallel Status Change Path to scan-email that detects ATS application status emails (Greenhouse/Lever/Ashby), tiers them by confidence, and mutates `output/*-applications.md` only through explicit confirmation gates.

**Architecture:** Pure classifier lib (`scripts/lib/status-classifier.js`) with a thin CLI wrapper (`scripts/classify-status-email.js`). The skill orchestrates; the script does the deterministic work and returns JSON. State writes go through extended `scripts/lib/applications.js` APIs with message-ID idempotency. Testing uses fixture emails + a fixture applications.md.

**Tech Stack:** Bun runtime, `node:test` + `node:assert/strict` (run via `bun test`), CommonJS modules, YAML frontmatter via existing `scripts/lib/frontmatter.js`.

**Spec:** [docs/superpowers/specs/2026-04-13-scan-email-status-detection-design.md](../specs/2026-04-13-scan-email-status-detection-design.md)

---

## File Structure

### Create

| File | Responsibility |
|---|---|
| `tests/fixtures/status-emails/applications.md` | Minimal fixture applications.md used as resolution target by classifier tests |
| `tests/fixtures/status-emails/atlassian-rejection-greenhouse.json` | HIGH tier Rejected — URL match |
| `tests/fixtures/status-emails/discord-rejection-greenhouse.json` | MEDIUM tier Rejected — name match (fixture entry has no URL) |
| `tests/fixtures/status-emails/realtor-interview-greenhouse.json` | HIGH tier Interview — URL match |
| `tests/fixtures/status-emails/unknown-company-greenhouse.json` | LOW tier — ATS sender + signal but no matching entry |
| `tests/fixtures/status-emails/ambiguous-no-signal.json` | LOW tier — ATS sender but no signal phrase |
| `tests/fixtures/status-emails/non-ats-sender.json` | Non-ATS sender — classifier returns null (skip) |
| `scripts/lib/status-classifier.js` | Pure function: `classifyStatusEmail({ sender, senderName, subject, body, msgId, applicationsData })` → result object or null |
| `scripts/classify-status-email.js` | CLI wrapper: reads email JSON + applications.md path, prints classification JSON |
| `tests/status-classifier.test.js` | Unit tests against fixture emails + fixture applications.md |
| `tests/classify-status-email-cli.test.js` | CLI-level integration test |

### Modify

| File | Change |
|---|---|
| `scripts/lib/applications.js` | Add Flagged-for-Review parse/format support; add `flagForReview()` and `markStatusChanged()` write functions with msg-id idempotency |
| `tests/applications.test.js` | Add test coverage for the new functions |
| `references/email-patterns.md` | Promote "Future: Application Status Patterns (v2)" to active section |
| `skills/scan-email/classification-rules.md` | Add "Status Change Path" section parallel to existing "Job Alert Path" |
| `skills/scan-email/SKILL.md` | Phase 2/2G dispatch, Gmail query expansion, Phase 5 Gate 2 UX, Phase 6 write path + cleanup suggestions |
| `output/2026-04-09-applications.md` | Frontmatter migration: add `flagged_count: 0` |

### Interfaces

**`scripts/lib/status-classifier.js` — `classifyStatusEmail(input)`**

Input:
```js
{
  sender: 'no-reply@greenhouse-mail.io',
  senderName: 'Atlassian Talent Acquisition',
  subject: 'Update on your application',
  body: '...\nhttps://boards.greenhouse.io/atlassian/jobs/5123456\n...',
  msgId: '<abc123@mail.gmail.com>',
  applicationsData: { active: [...], closed: [...] }  // from parseApplicationsContent
}
```

Returns `null` if sender does not match any ATS domain. Otherwise:
```js
{
  tier: 'HIGH' | 'MEDIUM' | 'LOW',
  status: 'Applied' | 'Screen/Interview' | 'Interview' | 'Rejected' | 'Offer' | null,
  matchMethod: 'url' | 'name' | 'none',
  signal: 'we\'ve decided not to move forward' | null,
  atsSender: 'greenhouse' | 'lever' | 'ashby',
  matchedEntry: { company, title, url, stage } | null,
  msgId: '<abc123@mail.gmail.com>'
}
```

**`scripts/classify-status-email.js` — CLI**

```
bun scripts/classify-status-email.js --email <email.json> --applications-dir <output/>
```

Prints classification JSON to stdout, or `null` if not a status email. Exit code 0 on success, non-zero on I/O errors.

**`scripts/lib/applications.js` extensions**

```js
// New parser support: parseApplicationsContent now returns { active, closed, flagged }

// New write functions:
flagForReview(dir, { company, title, signal, status, sender, matchMethod, msgId, detectedAt })
markStatusChanged(dir, { msgId, matchedCompany, newStatus, signal, atsSender, detectedAt })
// markStatusChanged is idempotent: if any history entry in applications.md contains
// `msg-id: <msgId>`, the function is a no-op and returns { skipped: true }
```

---

## Task Breakdown

### Task 1: Create fixture applications.md and fixture emails

**Files:**
- Create: `tests/fixtures/status-emails/applications.md`
- Create: `tests/fixtures/status-emails/atlassian-rejection-greenhouse.json`
- Create: `tests/fixtures/status-emails/discord-rejection-greenhouse.json`
- Create: `tests/fixtures/status-emails/realtor-interview-greenhouse.json`
- Create: `tests/fixtures/status-emails/unknown-company-greenhouse.json`
- Create: `tests/fixtures/status-emails/ambiguous-no-signal.json`
- Create: `tests/fixtures/status-emails/non-ats-sender.json`

- [ ] **Step 1: Create the fixtures directory**

```bash
mkdir -p tests/fixtures/status-emails
```

- [ ] **Step 2: Create `tests/fixtures/status-emails/applications.md`**

```markdown
---
format_version: 1
last_updated: 2026-04-13
active_count: 3
closed_count: 0
flagged_count: 0
---
# Application Pipeline

Last updated: 2026-04-13

## Active Applications

### Atlassian — VP Engineering

- **Stage**: Applied
- **Applied**: 2026-04-02
- **Last activity**: 2026-04-02 — Applied — Added to pipeline
- **Next action**: 
- **Contacts**: 
- **URL**: https://boards.greenhouse.io/atlassian/jobs/5123456
- **Notes**: 

#### History

- 2026-04-02: Applied — Added to pipeline

---

### Discord — Director of Engineering

- **Stage**: Applied
- **Applied**: 2026-04-05
- **Last activity**: 2026-04-05 — Applied — Added to pipeline
- **Next action**: 
- **Contacts**: 
- **URL**: 
- **Notes**: 

#### History

- 2026-04-05: Applied — Added to pipeline

---

### Realtor.com — Director, Software Engineering

- **Stage**: Applied
- **Applied**: 2026-04-07
- **Last activity**: 2026-04-07 — Applied — Added to pipeline
- **Next action**: 
- **Contacts**: 
- **URL**: https://boards.greenhouse.io/realtor/jobs/5234567
- **Notes**: 

#### History

- 2026-04-07: Applied — Added to pipeline


## Closed Applications

```

- [ ] **Step 3: Create fixture email JSON files**

`tests/fixtures/status-emails/atlassian-rejection-greenhouse.json`:
```json
{
  "sender": "no-reply@greenhouse-mail.io",
  "senderName": "Atlassian Talent Acquisition",
  "subject": "Update on your Atlassian application",
  "body": "Hi Chris,\n\nThank you for your interest in the VP Engineering role at Atlassian. After careful review, we've decided not to move forward with your application at this time.\n\nYou can view the posting here: https://boards.greenhouse.io/atlassian/jobs/5123456\n\nBest,\nAtlassian Talent Team",
  "msgId": "<fixture-atlassian-001@mail.gmail.com>"
}
```

`tests/fixtures/status-emails/discord-rejection-greenhouse.json`:
```json
{
  "sender": "no-reply@greenhouse-mail.io",
  "senderName": "Discord",
  "subject": "Your application to Discord",
  "body": "Hi Chris,\n\nUnfortunately, we will not be moving forward with your application for Director of Engineering at Discord. We appreciate your interest.\n\nPosting: https://boards.greenhouse.io/discord/jobs/9999999\n\nBest,\nDiscord Recruiting",
  "msgId": "<fixture-discord-001@mail.gmail.com>"
}
```

`tests/fixtures/status-emails/realtor-interview-greenhouse.json`:
```json
{
  "sender": "no-reply@greenhouse-mail.io",
  "senderName": "Realtor.com Recruiting",
  "subject": "Next steps — Realtor.com Director role",
  "body": "Hi Chris,\n\nWe'd like to move forward with next steps for the Director, Software Engineering role. Please schedule your interview at your earliest convenience.\n\nRole: https://boards.greenhouse.io/realtor/jobs/5234567\n\nThanks,\nRealtor.com Talent",
  "msgId": "<fixture-realtor-001@mail.gmail.com>"
}
```

`tests/fixtures/status-emails/unknown-company-greenhouse.json`:
```json
{
  "sender": "no-reply@greenhouse-mail.io",
  "senderName": "Acme Corp Recruiting",
  "subject": "Update on your application",
  "body": "Hi Chris,\n\nThank you for your interest in Acme Corp. Unfortunately, we've decided to move forward with other candidates.\n\nhttps://boards.greenhouse.io/acme/jobs/1111111\n\nBest,\nAcme Recruiting",
  "msgId": "<fixture-unknown-001@mail.gmail.com>"
}
```

`tests/fixtures/status-emails/ambiguous-no-signal.json`:
```json
{
  "sender": "notifications@lever.co",
  "senderName": "Atlassian via Lever",
  "subject": "Application received",
  "body": "Hi Chris,\n\nWe received your application. Our team is reviewing applications and will follow up with qualified candidates. This is an automated message.\n\n—The Lever team",
  "msgId": "<fixture-ambiguous-001@mail.gmail.com>"
}
```

Note: This fixture has ATS sender + body mentions "application received" (priority 5 Applied signal), so it should classify as LOW tier with `status: 'Applied'` when no match method hits. Kept here specifically to test that LOW can carry a non-null status when the match fails but signal extracts.

`tests/fixtures/status-emails/non-ats-sender.json`:
```json
{
  "sender": "talent@randomcompany.com",
  "senderName": "Random Company Talent",
  "subject": "Your application status",
  "body": "Unfortunately we've decided not to proceed.",
  "msgId": "<fixture-nonats-001@mail.gmail.com>"
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/status-emails/
git commit -m "test: add fixtures for scan-email status classifier"
```

---

### Task 2: Status classifier — ATS sender match (TDD)

**Files:**
- Create: `scripts/lib/status-classifier.js`
- Create: `tests/status-classifier.test.js`

- [ ] **Step 1: Write the failing test for sender matching**

Create `tests/status-classifier.test.js`:

```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { classifyStatusEmail, ATS_SENDERS } = require('../scripts/lib/status-classifier');
const { parseApplicationsContent } = require('../scripts/lib/applications');

const FIXTURES = path.join(__dirname, 'fixtures', 'status-emails');

function loadEmail(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function loadApplications() {
  const content = fs.readFileSync(path.join(FIXTURES, 'applications.md'), 'utf8');
  return parseApplicationsContent(content);
}

describe('classifyStatusEmail — sender matching', () => {
  it('returns null for non-ATS sender', () => {
    const email = loadEmail('non-ats-sender.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result, null);
  });

  it('matches @greenhouse-mail.io as greenhouse', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.notEqual(result, null);
    assert.equal(result.atsSender, 'greenhouse');
  });

  it('matches @lever.co as lever', () => {
    const email = loadEmail('ambiguous-no-signal.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.notEqual(result, null);
    assert.equal(result.atsSender, 'lever');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test tests/status-classifier.test.js
```

Expected: FAIL with "Cannot find module '../scripts/lib/status-classifier'".

- [ ] **Step 3: Create minimal implementation**

Create `scripts/lib/status-classifier.js`:

```javascript
const ATS_SENDERS = {
  greenhouse: [/@greenhouse\.io$/i, /@greenhouse-mail\.io$/i],
  lever: [/@lever\.co$/i],
  ashby: [/@ashbyhq\.com$/i],
};

function matchAtsSender(sender) {
  if (!sender) return null;
  for (const [name, patterns] of Object.entries(ATS_SENDERS)) {
    if (patterns.some(re => re.test(sender))) return name;
  }
  return null;
}

function classifyStatusEmail(input) {
  const { sender } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  return {
    tier: 'LOW',
    status: null,
    matchMethod: 'none',
    signal: null,
    atsSender,
    matchedEntry: null,
    msgId: input.msgId,
  };
}

module.exports = { classifyStatusEmail, ATS_SENDERS, matchAtsSender };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test tests/status-classifier.test.js
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/status-classifier.js tests/status-classifier.test.js
git commit -m "feat(scan-email): classifier ATS sender matching"
```

---

### Task 3: Status classifier — signal extraction (TDD)

**Files:**
- Modify: `scripts/lib/status-classifier.js`
- Modify: `tests/status-classifier.test.js`

- [ ] **Step 1: Write failing tests for signal extraction**

Append to `tests/status-classifier.test.js`:

```javascript
describe('classifyStatusEmail — signal extraction', () => {
  it('extracts Rejected signal from "we\'ve decided not to move forward"', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
    assert.match(result.signal, /not to move forward/i);
  });

  it('extracts Rejected signal from "unfortunately" + "moving forward"', () => {
    const email = loadEmail('discord-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
  });

  it('extracts Interview signal from "next steps" + "schedule your interview"', () => {
    const email = loadEmail('realtor-interview-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Interview');
  });

  it('extracts Applied signal from "application received"', () => {
    const email = loadEmail('ambiguous-no-signal.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    // NB: fixture body says "We received your application" — normalize test expectations
    assert.equal(result.status, 'Applied');
  });

  it('status is null when no signal phrases match', () => {
    const email = {
      sender: 'notifications@lever.co',
      senderName: 'Test',
      subject: 'Generic update',
      body: 'Hello, this is just a status email with no specific signal phrases.',
      msgId: '<test-no-signal@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, null);
  });

  it('priority: Rejected beats Applied when both phrases present', () => {
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Test',
      subject: 'Application update',
      body: 'Thank you for applying. After review, we\'ve decided not to move forward.',
      msgId: '<test-priority@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/status-classifier.test.js
```

Expected: signal-related tests fail (status is null).

- [ ] **Step 3: Implement signal extraction**

Update `scripts/lib/status-classifier.js`:

```javascript
const ATS_SENDERS = {
  greenhouse: [/@greenhouse\.io$/i, /@greenhouse-mail\.io$/i],
  lever: [/@lever\.co$/i],
  ashby: [/@ashbyhq\.com$/i],
};

// Priority 1 (highest) wins if multiple match.
const SIGNAL_RULES = [
  {
    status: 'Offer',
    priority: 1,
    patterns: [/\boffer\b/i, /excited to extend/i],
  },
  {
    status: 'Interview',
    priority: 2,
    patterns: [/interview scheduled/i, /schedule your interview/i],
  },
  {
    status: 'Interview',
    priority: 3,
    patterns: [/move forward with you/i, /next steps/i, /we'?d like to/i],
  },
  {
    status: 'Rejected',
    priority: 4,
    patterns: [
      /not to move forward/i,
      /not moving forward/i,
      /we'?ve decided/i,
      /will not be moving forward/i,
      /unfortunately/i,
      /other candidates/i,
    ],
  },
  {
    status: 'Applied',
    priority: 5,
    patterns: [
      /application received/i,
      /thank you for applying/i,
      /received your application/i,
    ],
  },
];

function matchAtsSender(sender) {
  if (!sender) return null;
  for (const [name, patterns] of Object.entries(ATS_SENDERS)) {
    if (patterns.some(re => re.test(sender))) return name;
  }
  return null;
}

function extractSignal({ subject, body }) {
  const haystack = `${subject || ''}\n${body || ''}`;
  let best = null; // { priority, status, signal }
  for (const rule of SIGNAL_RULES) {
    for (const re of rule.patterns) {
      const m = haystack.match(re);
      if (m && (!best || rule.priority < best.priority)) {
        best = { priority: rule.priority, status: rule.status, signal: m[0] };
      }
    }
  }
  return best;
}

function classifyStatusEmail(input) {
  const { sender, subject, body, msgId } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  const sig = extractSignal({ subject, body });

  return {
    tier: 'LOW',
    status: sig ? sig.status : null,
    matchMethod: 'none',
    signal: sig ? sig.signal : null,
    atsSender,
    matchedEntry: null,
    msgId,
  };
}

module.exports = { classifyStatusEmail, ATS_SENDERS, SIGNAL_RULES, matchAtsSender, extractSignal };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/status-classifier.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/status-classifier.js tests/status-classifier.test.js
git commit -m "feat(scan-email): classifier signal extraction with priority"
```

---

### Task 4: Status classifier — URL-based slug resolution (TDD)

**Files:**
- Modify: `scripts/lib/status-classifier.js`
- Modify: `tests/status-classifier.test.js`

- [ ] **Step 1: Write failing tests for URL matching**

Append to `tests/status-classifier.test.js`:

```javascript
describe('classifyStatusEmail — URL matching', () => {
  it('HIGH tier when body URL matches applications.md entry URL', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'HIGH');
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Atlassian');
  });

  it('HIGH tier for interview URL match', () => {
    const email = loadEmail('realtor-interview-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'HIGH');
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Realtor.com');
  });

  it('URL normalization: strips query params and trailing slash', () => {
    const applicationsData = {
      active: [{
        company: 'Test',
        title: 'Role',
        url: 'https://boards.greenhouse.io/test/jobs/999',
        stage: 'Applied',
      }],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Test',
      subject: 'Update',
      body: 'Unfortunately https://boards.greenhouse.io/test/jobs/999/?utm=foo we have decided.',
      msgId: '<test-norm@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Test');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/status-classifier.test.js
```

Expected: URL tests fail (`matchMethod: 'none'`).

- [ ] **Step 3: Implement URL extraction and matching**

Update `scripts/lib/status-classifier.js` — add URL helpers and use them in `classifyStatusEmail`:

```javascript
const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();
    const pathname = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${host}${pathname}`;
  } catch {
    return null;
  }
}

function extractUrls(body) {
  if (!body) return [];
  const matches = body.match(URL_RE) || [];
  return matches.map(normalizeUrl).filter(Boolean);
}

function allEntries(applicationsData) {
  return [
    ...(applicationsData.active || []),
    ...(applicationsData.closed || []),
    ...(applicationsData.flagged || []),
  ];
}

function matchByUrl(body, applicationsData) {
  const bodyUrls = new Set(extractUrls(body));
  if (bodyUrls.size === 0) return null;
  for (const entry of allEntries(applicationsData)) {
    const entryUrl = normalizeUrl(entry.url);
    if (entryUrl && bodyUrls.has(entryUrl)) {
      return entry;
    }
  }
  return null;
}
```

Then update `classifyStatusEmail` to call `matchByUrl` and set tier/matchMethod when it hits:

```javascript
function classifyStatusEmail(input) {
  const { sender, subject, body, msgId, applicationsData } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  const sig = extractSignal({ subject, body });

  const urlMatch = matchByUrl(body, applicationsData || { active: [], closed: [], flagged: [] });

  let tier = 'LOW';
  let matchMethod = 'none';
  let matchedEntry = null;

  if (urlMatch) {
    matchMethod = 'url';
    matchedEntry = urlMatch;
    if (sig) tier = 'HIGH';
  }

  return {
    tier,
    status: sig ? sig.status : null,
    matchMethod,
    signal: sig ? sig.signal : null,
    atsSender,
    matchedEntry,
    msgId,
  };
}

module.exports = {
  classifyStatusEmail,
  ATS_SENDERS,
  SIGNAL_RULES,
  matchAtsSender,
  extractSignal,
  normalizeUrl,
  extractUrls,
  matchByUrl,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/status-classifier.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/status-classifier.js tests/status-classifier.test.js
git commit -m "feat(scan-email): classifier URL-based slug resolution"
```

---

### Task 5: Status classifier — name-based slug resolution (TDD)

**Files:**
- Modify: `scripts/lib/status-classifier.js`
- Modify: `tests/status-classifier.test.js`

- [ ] **Step 1: Write failing tests for name matching**

Append to `tests/status-classifier.test.js`:

```javascript
describe('classifyStatusEmail — name matching', () => {
  it('MEDIUM tier when sender name matches entry without URL', () => {
    const email = loadEmail('discord-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'MEDIUM');
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Discord');
  });

  it('LOW tier when ATS sender + signal but no entry matches', () => {
    const email = loadEmail('unknown-company-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'LOW');
    assert.equal(result.matchMethod, 'none');
    assert.equal(result.matchedEntry, null);
    // Status still extracted — this is a LOW-with-status case
    assert.equal(result.status, 'Rejected');
  });

  it('name normalization strips "Inc" / "LLC" / punctuation', () => {
    const applicationsData = {
      active: [{
        company: 'Realtor.com',
        title: 'Director',
        url: null,
        stage: 'Applied',
      }],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Realtor com Inc',
      subject: 'Update',
      body: 'Unfortunately, we will not be moving forward.',
      msgId: '<test-norm-name@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Realtor.com');
  });

  it('URL match takes precedence over name match', () => {
    const applicationsData = {
      active: [
        { company: 'Alpha', title: 'VP', url: 'https://boards.greenhouse.io/alpha/jobs/1', stage: 'Applied' },
        { company: 'Beta', title: 'VP', url: null, stage: 'Applied' },
      ],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Beta',
      subject: 'Update',
      body: 'Unfortunately, check https://boards.greenhouse.io/alpha/jobs/1 for the posting.',
      msgId: '<test-precedence@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Alpha');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/status-classifier.test.js
```

Expected: name-match tests fail.

- [ ] **Step 3: Implement name normalization and matching**

Add to `scripts/lib/status-classifier.js`:

```javascript
function normalizeName(name) {
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|corp|corporation|ltd|limited)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function extractCompanyFromSender({ sender, senderName, subject }) {
  // Prefer senderName display (strip "via Lever" / "Talent Acquisition" / etc.)
  if (senderName) {
    const cleaned = senderName
      .replace(/\s+via\s+(lever|greenhouse|ashby)/i, '')
      .replace(/\s+(talent acquisition|recruiting|careers|talent team)\s*$/i, '')
      .trim();
    if (cleaned) return cleaned;
  }
  // Greenhouse pattern: {company}@greenhouse-mail.io
  if (sender) {
    const m = sender.match(/^([^@]+)@greenhouse-mail\.io$/i);
    if (m && m[1] !== 'no-reply') return m[1];
  }
  // Subject pattern: "Your application to {company}"
  if (subject) {
    const m = subject.match(/application to (.+?)(?:\s*[-—]|\s*$)/i);
    if (m) return m[1];
  }
  return null;
}

function matchByName({ sender, senderName, subject }, applicationsData) {
  const rawName = extractCompanyFromSender({ sender, senderName, subject });
  if (!rawName) return null;
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  for (const entry of allEntries(applicationsData)) {
    if (normalizeName(entry.company) === normalized) return entry;
  }
  return null;
}
```

Update `classifyStatusEmail` to fall back to name matching after URL miss:

```javascript
function classifyStatusEmail(input) {
  const { sender, senderName, subject, body, msgId, applicationsData } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  const sig = extractSignal({ subject, body });
  const data = applicationsData || { active: [], closed: [], flagged: [] };

  const urlMatch = matchByUrl(body, data);
  const nameMatch = urlMatch ? null : matchByName({ sender, senderName, subject }, data);

  let tier = 'LOW';
  let matchMethod = 'none';
  let matchedEntry = null;

  if (urlMatch) {
    matchMethod = 'url';
    matchedEntry = urlMatch;
    if (sig) tier = 'HIGH';
  } else if (nameMatch) {
    matchMethod = 'name';
    matchedEntry = nameMatch;
    if (sig) tier = 'MEDIUM';
  }

  return {
    tier,
    status: sig ? sig.status : null,
    matchMethod,
    signal: sig ? sig.signal : null,
    atsSender,
    matchedEntry,
    msgId,
  };
}
```

Add exports: `normalizeName`, `extractCompanyFromSender`, `matchByName`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun test tests/status-classifier.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/status-classifier.js tests/status-classifier.test.js
git commit -m "feat(scan-email): classifier name-based slug resolution"
```

---

### Task 6: Classifier CLI wrapper (TDD)

**Files:**
- Create: `scripts/classify-status-email.js`
- Create: `tests/classify-status-email-cli.test.js`

- [ ] **Step 1: Write failing CLI test**

Create `tests/classify-status-email-cli.test.js`:

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CLI = path.join(__dirname, '..', 'scripts', 'classify-status-email.js');
const FIXTURES = path.join(__dirname, 'fixtures', 'status-emails');

let tmpDir;

function run(args) {
  return execSync(`bun ${CLI} ${args}`, { encoding: 'utf8', timeout: 10000 }).trim();
}

describe('classify-status-email.js CLI', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classify-test-'));
    fs.copyFileSync(
      path.join(FIXTURES, 'applications.md'),
      path.join(tmpDir, '2026-04-13-applications.md')
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for non-ATS sender', () => {
    const emailPath = path.join(FIXTURES, 'non-ats-sender.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    assert.equal(out, 'null');
  });

  it('returns HIGH tier JSON for URL-matched rejection', () => {
    const emailPath = path.join(FIXTURES, 'atlassian-rejection-greenhouse.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    const result = JSON.parse(out);
    assert.equal(result.tier, 'HIGH');
    assert.equal(result.status, 'Rejected');
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Atlassian');
  });

  it('returns MEDIUM tier JSON for name-matched rejection', () => {
    const emailPath = path.join(FIXTURES, 'discord-rejection-greenhouse.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    const result = JSON.parse(out);
    assert.equal(result.tier, 'MEDIUM');
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Discord');
  });

  it('returns LOW tier JSON for unknown company', () => {
    const emailPath = path.join(FIXTURES, 'unknown-company-greenhouse.json');
    const out = run(`--email ${emailPath} --applications-dir ${tmpDir}`);
    const result = JSON.parse(out);
    assert.equal(result.tier, 'LOW');
    assert.equal(result.matchMethod, 'none');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/classify-status-email-cli.test.js
```

Expected: FAIL (module not found / missing script).

- [ ] **Step 3: Implement the CLI wrapper**

Create `scripts/classify-status-email.js`:

```javascript
#!/usr/bin/env bun
const fs = require('fs');
const path = require('path');
const { classifyStatusEmail } = require('./lib/status-classifier');
const { parseApplicationsFile } = require('./lib/applications');
const { resolveStateFile } = require('./lib/util');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--email') args.email = argv[++i];
    else if (key === '--applications-dir') args.applicationsDir = argv[++i];
  }
  return args;
}

function main() {
  const { email, applicationsDir } = parseArgs(process.argv);
  if (!email || !applicationsDir) {
    console.error('Usage: classify-status-email.js --email <file.json> --applications-dir <dir>');
    process.exit(2);
  }

  const emailData = JSON.parse(fs.readFileSync(email, 'utf8'));

  const applicationsFile = resolveStateFile(applicationsDir, 'applications');
  const applicationsData = applicationsFile
    ? parseApplicationsFile(applicationsFile)
    : { active: [], closed: [], flagged: [] };

  const result = classifyStatusEmail({ ...emailData, applicationsData });
  console.log(JSON.stringify(result));
}

main();
```

- [ ] **Step 4: Run test to verify pass**

```bash
bun test tests/classify-status-email-cli.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/classify-status-email.js tests/classify-status-email-cli.test.js
git commit -m "feat(scan-email): classify-status-email CLI wrapper"
```

---

### Task 7: applications.js — parse Flagged for Review section (TDD)

**Files:**
- Modify: `scripts/lib/applications.js`
- Modify: `tests/applications.test.js`

- [ ] **Step 1: Write failing parser test**

Append to `tests/applications.test.js`:

```javascript
describe('parseApplicationsContent — flagged for review', () => {
  it('returns empty flagged array when no section present', () => {
    const content = `---
format_version: 1
---
# Application Pipeline

## Active Applications

## Closed Applications
`;
    const result = parseApplicationsContent(content);
    assert.deepEqual(result.flagged, []);
  });

  it('parses a single flagged entry', () => {
    const content = `---
format_version: 1
---
# Application Pipeline

## Active Applications

## Closed Applications

## Flagged for Review

### Acme Corp — Unknown role — 2026-04-13

- **Detected signal**: "unfortunately" → Rejected
- **Sender**: no-reply@greenhouse-mail.io
- **Match method**: none
- **Message-ID**: <fixture-unknown-001@mail.gmail.com>
- **Action**: Resolve manually
`;
    const result = parseApplicationsContent(content);
    assert.equal(result.flagged.length, 1);
    const entry = result.flagged[0];
    assert.equal(entry.company, 'Acme Corp');
    assert.equal(entry.title, 'Unknown role');
    assert.equal(entry.detectedAt, '2026-04-13');
    assert.equal(entry.status, 'Rejected');
    assert.equal(entry.sender, 'no-reply@greenhouse-mail.io');
    assert.equal(entry.matchMethod, 'none');
    assert.equal(entry.msgId, '<fixture-unknown-001@mail.gmail.com>');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
bun test tests/applications.test.js
```

Expected: tests fail (`flagged` undefined or entry not parsed).

- [ ] **Step 3: Extend the parser**

Modify `scripts/lib/applications.js`:

1. Update the section regex to recognize the new section:

```javascript
const SECTION_RE = /^## (Active Applications|Closed Applications|Flagged for Review)$/;
```

2. Update the heading regex to allow a trailing date for flagged entries:

```javascript
const FLAGGED_HEADING_RE = /^### (.+?) — (.+?) — (\d{4}-\d{2}-\d{2})$/;
```

3. In `parseApplicationsContent`, add flagged state and handling. Initialize `result.flagged = []`; extend `currentSection` to accept `'flagged'`; when in that section, use `FLAGGED_HEADING_RE` and parse the five key-value lines into a flagged-entry shape:

```javascript
function makeFlaggedEntry(overrides) {
  return {
    company: null,
    title: null,
    detectedAt: null,
    signal: null,
    status: null,
    sender: null,
    matchMethod: null,
    msgId: null,
    action: null,
    ...overrides,
  };
}
```

Add the section branch inside the main loop (before or alongside the existing `HEADING_RE` block):

```javascript
if (currentSection === 'flagged') {
  const fh = trimmed.match(FLAGGED_HEADING_RE);
  if (fh) {
    finalizeEntry();
    currentEntry = makeFlaggedEntry({
      company: fh[1].trim(),
      title: fh[2].trim(),
      detectedAt: fh[3].trim(),
    });
    continue;
  }

  if (!currentEntry) continue;
  if (trimmed === '---') continue;

  const kv = trimmed.match(KEY_VALUE_RE);
  if (kv) {
    const key = kv[1].trim().toLowerCase().replace(/\s+/g, '');
    const value = kv[2].trim();
    switch (key) {
      case 'detectedsignal': {
        const sigMatch = value.match(/^"(.+)"\s*→\s*(.+)$/);
        if (sigMatch) {
          currentEntry.signal = sigMatch[1];
          currentEntry.status = sigMatch[2].trim();
        } else {
          currentEntry.signal = value;
        }
        break;
      }
      case 'sender':
        currentEntry.sender = value || null;
        break;
      case 'matchmethod':
        // value may include parenthetical detail; keep the first token
        currentEntry.matchMethod = (value.split(/\s+/)[0] || value).toLowerCase() || null;
        break;
      case 'message-id':
      case 'messageid':
        currentEntry.msgId = value || null;
        break;
      case 'action':
        currentEntry.action = value || null;
        break;
    }
  }
  continue;
}
```

Update `finalizeEntry` to push flagged entries to `result.flagged`:

```javascript
function finalizeEntry() {
  if (!currentEntry) return;

  if (currentSection === 'closed' && currentEntry.stage) {
    const m = currentEntry.stage.match(CLOSED_STAGE_RE);
    currentEntry.closed = {
      date: closedDate,
      reason: m ? m[1] : null,
      summary: closedSummary,
    };
  }

  if (currentSection === 'flagged') {
    result.flagged.push(currentEntry);
  } else {
    result[currentSection].push(currentEntry);
  }
  currentEntry = null;
  inHistory = false;
  closedDate = null;
  closedSummary = null;
}
```

And initialize `result.flagged = []` at the top of the function, and `flagged: []` in the empty-content early return.

4. Map section name to internal key:

```javascript
const sectionMatch = trimmed.match(SECTION_RE);
if (sectionMatch) {
  finalizeEntry();
  const name = sectionMatch[1];
  currentSection = name === 'Active Applications'
    ? 'active'
    : name === 'Closed Applications'
    ? 'closed'
    : 'flagged';
  continue;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
bun test tests/applications.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(applications): parse Flagged for Review section"
```

---

### Task 8: applications.js — format Flagged for Review section + frontmatter (TDD)

**Files:**
- Modify: `scripts/lib/applications.js`
- Modify: `tests/applications.test.js`

- [ ] **Step 1: Write failing round-trip test**

Append to `tests/applications.test.js`:

```javascript
describe('formatApplicationsFile — flagged for review round-trip', () => {
  it('writes flagged section and flagged_count frontmatter', () => {
    const data = {
      active: [],
      closed: [],
      flagged: [{
        company: 'Acme Corp',
        title: 'Unknown role',
        detectedAt: '2026-04-13',
        signal: 'unfortunately',
        status: 'Rejected',
        sender: 'no-reply@greenhouse-mail.io',
        matchMethod: 'none',
        msgId: '<fixture-unknown-001@mail.gmail.com>',
        action: 'Resolve manually — confirm which application this refers to, or dismiss if unrelated',
      }],
    };

    const output = formatApplicationsFile(data);
    assert.match(output, /flagged_count:\s*1/);
    assert.match(output, /## Flagged for Review/);
    assert.match(output, /### Acme Corp — Unknown role — 2026-04-13/);
    assert.match(output, /\*\*Detected signal\*\*: "unfortunately" → Rejected/);
    assert.match(output, /\*\*Message-ID\*\*: <fixture-unknown-001@mail\.gmail\.com>/);

    // Round-trip: parse the output, get back the same flagged entry
    const reparsed = parseApplicationsContent(output);
    assert.equal(reparsed.flagged.length, 1);
    assert.equal(reparsed.flagged[0].company, 'Acme Corp');
    assert.equal(reparsed.flagged[0].msgId, '<fixture-unknown-001@mail.gmail.com>');
  });

  it('omits flagged section when empty (but includes flagged_count: 0)', () => {
    const data = { active: [], closed: [], flagged: [] };
    const output = formatApplicationsFile(data);
    assert.match(output, /flagged_count:\s*0/);
    assert.doesNotMatch(output, /## Flagged for Review/);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
bun test tests/applications.test.js
```

Expected: tests fail.

- [ ] **Step 3: Implement the formatter**

Modify `scripts/lib/applications.js`:

Add a `formatFlagged` helper:

```javascript
function formatFlagged(entry) {
  const lines = [];
  lines.push(`### ${entry.company} — ${entry.title || 'Unknown role'} — ${entry.detectedAt}`);
  lines.push('');
  const sigText = entry.signal && entry.status
    ? `"${entry.signal}" → ${entry.status}`
    : (entry.signal || '');
  lines.push(`- **Detected signal**: ${sigText}`);
  lines.push(`- **Sender**: ${entry.sender || ''}`);
  lines.push(`- **Match method**: ${entry.matchMethod || 'none'}`);
  lines.push(`- **Message-ID**: ${entry.msgId || ''}`);
  lines.push(`- **Action**: ${entry.action || 'Resolve manually — confirm which application this refers to, or dismiss if unrelated'}`);
  return lines.join('\n');
}
```

Update `formatApplicationsFile` to include the flagged section and frontmatter count:

```javascript
function formatApplicationsFile({ active, closed, flagged }) {
  const today = new Date().toISOString().slice(0, 10);
  const flaggedList = flagged || [];
  const parts = [];

  parts.push(`# Application Pipeline\n\nLast updated: ${today}\n`);

  parts.push('## Active Applications\n');
  if (active.length > 0) {
    parts.push(active.map(formatApplication).join('\n\n---\n\n'));
    parts.push('\n');
  }

  parts.push('\n## Closed Applications\n');
  if (closed.length > 0) {
    parts.push(closed.map(formatApplication).join('\n\n---\n\n'));
    parts.push('\n');
  }

  if (flaggedList.length > 0) {
    parts.push('\n## Flagged for Review\n');
    parts.push(flaggedList.map(formatFlagged).join('\n\n---\n\n'));
    parts.push('\n');
  }

  const body = parts.join('\n') + '\n';
  const meta = {
    format_version: 1,
    last_updated: today,
    active_count: active.length,
    closed_count: closed.length,
    flagged_count: flaggedList.length,
  };
  return serializeFrontmatter(meta, body);
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
bun test tests/applications.test.js
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(applications): format Flagged for Review + flagged_count"
```

---

### Task 9: applications.js — `flagForReview()` and `markStatusChanged()` (TDD)

**Files:**
- Modify: `scripts/lib/applications.js`
- Modify: `tests/applications.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/applications.test.js`:

```javascript
describe('flagForReview / markStatusChanged', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-status-'));
    // Seed with fixture
    const content = fs.readFileSync(path.join(__dirname, 'fixtures', 'status-emails', 'applications.md'), 'utf8');
    fs.writeFileSync(path.join(dir, '2026-04-13-applications.md'), content);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('flagForReview appends to Flagged section and bumps flagged_count', () => {
    const { flagForReview, parseApplications } = require('../scripts/lib/applications');
    flagForReview(dir, {
      company: 'Acme Corp',
      title: 'Unknown role',
      signal: 'unfortunately',
      status: 'Rejected',
      sender: 'no-reply@greenhouse-mail.io',
      matchMethod: 'none',
      msgId: '<fixture-unknown-001@mail.gmail.com>',
      detectedAt: '2026-04-13',
    });
    const data = parseApplications(dir);
    assert.equal(data.flagged.length, 1);
    assert.equal(data.flagged[0].company, 'Acme Corp');

    const raw = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
    assert.match(raw, /flagged_count:\s*1/);
  });

  it('markStatusChanged(Rejected) moves entry to Closed and appends history with msg-id', () => {
    const { markStatusChanged, parseApplications } = require('../scripts/lib/applications');
    const result = markStatusChanged(dir, {
      msgId: '<fixture-atlassian-001@mail.gmail.com>',
      matchedCompany: 'Atlassian',
      newStatus: 'Rejected',
      signal: "we've decided not to move forward",
      atsSender: 'greenhouse',
      detectedAt: '2026-04-13',
    });
    assert.equal(result.skipped, false);

    const data = parseApplications(dir);
    assert.equal(data.active.find(e => e.company === 'Atlassian'), undefined);
    const closed = data.closed.find(e => e.company === 'Atlassian');
    assert.notEqual(closed, undefined);
    assert.match(closed.stage, /Closed \(rejected\)/);

    const raw = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
    assert.match(raw, /msg-id: <fixture-atlassian-001@mail\.gmail\.com>/);
  });

  it('markStatusChanged is idempotent by msg-id', () => {
    const { markStatusChanged, parseApplications } = require('../scripts/lib/applications');
    markStatusChanged(dir, {
      msgId: '<fixture-atlassian-001@mail.gmail.com>',
      matchedCompany: 'Atlassian',
      newStatus: 'Rejected',
      signal: 'unfortunately',
      atsSender: 'greenhouse',
      detectedAt: '2026-04-13',
    });
    const second = markStatusChanged(dir, {
      msgId: '<fixture-atlassian-001@mail.gmail.com>',
      matchedCompany: 'Atlassian',
      newStatus: 'Rejected',
      signal: 'unfortunately',
      atsSender: 'greenhouse',
      detectedAt: '2026-04-13',
    });
    assert.equal(second.skipped, true);

    const data = parseApplications(dir);
    const closed = data.closed.filter(e => e.company === 'Atlassian');
    assert.equal(closed.length, 1);
  });

  it('markStatusChanged(Interview) updates stage on Active entry with msg-id history', () => {
    const { markStatusChanged, parseApplications } = require('../scripts/lib/applications');
    markStatusChanged(dir, {
      msgId: '<fixture-realtor-001@mail.gmail.com>',
      matchedCompany: 'Realtor.com',
      newStatus: 'Interview',
      signal: 'next steps',
      atsSender: 'greenhouse',
      detectedAt: '2026-04-13',
    });
    const data = parseApplications(dir);
    const entry = data.active.find(e => e.company === 'Realtor.com');
    assert.equal(entry.stage, 'Interview');
    const last = entry.history[entry.history.length - 1];
    assert.match(last.detail, /msg-id: <fixture-realtor-001@mail\.gmail\.com>/);
  });
});
```

Ensure the top of `tests/applications.test.js` has the `parseApplications` import listed alongside the other exports.

- [ ] **Step 2: Run tests to confirm failure**

```bash
bun test tests/applications.test.js
```

Expected: tests fail (functions not exported).

- [ ] **Step 3: Implement `flagForReview` and `markStatusChanged`**

Add to `scripts/lib/applications.js`:

```javascript
function hasMsgIdInHistory(filePath, msgId) {
  if (!msgId) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(`msg-id: ${msgId}`);
}

function flagForReview(dir, opts) {
  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  if (hasMsgIdInHistory(filePath, opts.msgId)) {
    // Check flagged section too via parse
    const existing = parseApplicationsFile(filePath);
    const dup = (existing.flagged || []).find(e => e.msgId === opts.msgId);
    if (dup) return { skipped: true };
  }

  const data = parseApplicationsFile(filePath);
  data.flagged = data.flagged || [];
  data.flagged.push({
    company: opts.company || 'Unknown',
    title: opts.title || 'Unknown role',
    detectedAt: opts.detectedAt || new Date().toISOString().slice(0, 10),
    signal: opts.signal || null,
    status: opts.status || null,
    sender: opts.sender || null,
    matchMethod: opts.matchMethod || 'none',
    msgId: opts.msgId || null,
    action: opts.action || null,
  });

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
  return { skipped: false };
}

function markStatusChanged(dir, opts) {
  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  if (hasMsgIdInHistory(filePath, opts.msgId)) {
    return { skipped: true };
  }

  const data = parseApplicationsFile(filePath);
  const query = opts.matchedCompany.toLowerCase();
  const detectedAt = opts.detectedAt || new Date().toISOString().slice(0, 10);
  const detail = `scan-email detected ${opts.atsSender} ${opts.newStatus.toLowerCase()} (msg-id: ${opts.msgId})`;

  if (opts.newStatus === 'Rejected') {
    const idx = data.active.findIndex(e => e.company.toLowerCase() === query);
    if (idx === -1) throw new Error(`No active application matching "${opts.matchedCompany}"`);
    const entry = data.active[idx];
    data.active.splice(idx, 1);

    entry.stage = 'Closed (rejected)';
    entry.closed = {
      date: detectedAt,
      reason: 'rejected',
      summary: `scan-email detected ${opts.atsSender} rejection: "${opts.signal}"`,
    };
    entry.lastActivity = { date: detectedAt, detail: `Closed (rejected) — ${opts.signal}` };
    entry.history.push({ date: detectedAt, stage: 'Closed (rejected)', detail });
    data.closed.push(entry);
  } else {
    const entry = data.active.find(e => e.company.toLowerCase() === query);
    if (!entry) throw new Error(`No active application matching "${opts.matchedCompany}"`);
    entry.stage = opts.newStatus;
    entry.lastActivity = { date: detectedAt, detail: `${opts.newStatus} — ${opts.signal}` };
    entry.history.push({ date: detectedAt, stage: opts.newStatus, detail });
  }

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
  return { skipped: false };
}
```

Add `flagForReview` and `markStatusChanged` to `module.exports`.

- [ ] **Step 4: Run test to verify pass**

```bash
bun test tests/applications.test.js
```

Expected: tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/applications.js tests/applications.test.js
git commit -m "feat(applications): flagForReview and markStatusChanged with msg-id idempotency"
```

---

### Task 10: Migrate existing applications.md frontmatter

**Files:**
- Modify: `output/2026-04-09-applications.md`

- [ ] **Step 1: Add `flagged_count: 0` to frontmatter**

Open `output/2026-04-09-applications.md` and add the `flagged_count: 0` line directly after `closed_count:` in the frontmatter:

```yaml
---
format_version: 1
last_updated: 2026-04-12
active_count: 2
closed_count: 1
flagged_count: 0
---
```

- [ ] **Step 2: Verify the file still parses cleanly**

```bash
bun -e "const {parseApplicationsFile} = require('./scripts/lib/applications'); const d = parseApplicationsFile('output/2026-04-09-applications.md'); console.log('active:', d.active.length, 'closed:', d.closed.length, 'flagged:', (d.flagged||[]).length);"
```

Expected: `active: 2 closed: 1 flagged: 0`.

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add output/2026-04-09-applications.md
git commit -m "chore(state): add flagged_count to applications.md frontmatter"
```

---

### Task 11: Promote status section in references/email-patterns.md

**Files:**
- Modify: `references/email-patterns.md`

- [ ] **Step 1: Remove the "Future" marker from the Application Status Patterns section**

Replace the section heading `## Future: Application Status Patterns (v2)` with `## Application Status Patterns`. Remove the `> Not implemented in v1. Documented for future enhancement.` quote line immediately following.

- [ ] **Step 2: Expand the signal table with priority column**

Replace the existing Status Signals table with:

```markdown
### Status Signals (subject or body)

Higher priority signals win when multiple match. Signal extraction is case-insensitive.

| Priority | Phrases | Status |
|---|---|---|
| 1 | "offer", "we're excited to extend" | Offer |
| 2 | "interview scheduled", "schedule your interview" | Interview |
| 3 | "we'd like to", "move forward with you", "next steps" | Interview |
| 4 | "unfortunately", "we've decided", "not moving forward", "will not be moving forward", "other candidates" | Rejected |
| 5 | "application received", "thank you for applying", "received your application" | Applied |
```

- [ ] **Step 3: Add a note that these patterns are now active**

Append a short paragraph right after the signal table:

```markdown
These patterns drive the Status Change Path in `skills/scan-email/classification-rules.md`. The deterministic classifier lives at `scripts/lib/status-classifier.js`; any edits to the patterns above should be mirrored in `SIGNAL_RULES` in that file, and both changes should be covered by a fixture in `tests/fixtures/status-emails/`.
```

- [ ] **Step 4: Commit**

```bash
git add references/email-patterns.md
git commit -m "docs(email-patterns): promote application status patterns to active"
```

---

### Task 12: Add Status Change Path to classification-rules.md

**Files:**
- Modify: `skills/scan-email/classification-rules.md`

- [ ] **Step 1: Reorganize the file with two explicit paths**

After the existing introduction, restructure so there are two top-level sections: **Job Alert Path** (wrapping the existing 4 steps) and **Status Change Path** (new).

Add the Status Change Path section:

```markdown
## Status Change Path

Runs in parallel to the Job Alert Path. A message either matches this path (ATS status email) or the Job Alert Path (job posting alert) — never both, because the sender sets are disjoint.

### Step 1: ATS Sender Match

Check the sender domain against ATS Notification Senders in `references/email-patterns.md` → Application Status Patterns. Currently recognized:

- `@greenhouse.io`, `@greenhouse-mail.io`, `no-reply@greenhouse.io`
- `@lever.co`, `notifications@lever.co`
- `@ashbyhq.com`

No match → skip (may still be classified by the Job Alert Path).

### Step 2: Invoke the Classifier Script

For each ATS-sender match, run:

```bash
bun scripts/classify-status-email.js --email {email.json} --applications-dir {plugin_root}/output
```

The script returns one JSON object per call:

```json
{
  "tier": "HIGH" | "MEDIUM" | "LOW",
  "status": "Applied" | "Screen/Interview" | "Interview" | "Rejected" | "Offer" | null,
  "matchMethod": "url" | "name" | "none",
  "signal": "...",
  "atsSender": "greenhouse",
  "matchedEntry": { "company": "...", "title": "...", "url": "...", "stage": "..." } | null,
  "msgId": "<...>"
}
```

Or `null` if the sender did not match an ATS domain (should not happen after Step 1, but the CLI is defensive).

### Step 3: Persist Candidate Records

Tag each classified record with `type: status-change` and the full JSON result. These records flow into Phase 5 Gate 2 (HIGH/MEDIUM) or Phase 6 Flagged for Review append (LOW).

Candidates from the Status Change Path are NOT subject to the same early-stop rule as job alerts — process all ATS matches in the batch.
```

- [ ] **Step 2: Add a note near the top of the file about the two paths**

Add a sentence early in the file:

```markdown
Each message is evaluated against both paths; the two are disjoint by sender so a single message can only match one.
```

- [ ] **Step 3: Commit**

```bash
git add skills/scan-email/classification-rules.md
git commit -m "docs(scan-email): add Status Change Path to classification rules"
```

---

### Task 13: Wire Phase 2/2G dispatch and Gmail query in SKILL.md

**Files:**
- Modify: `skills/scan-email/SKILL.md`

- [ ] **Step 1: Expand the Gmail search query**

In `Phase 2G — Gmail Metadata Scan`, the existing sentence reads:

> Build search queries from sender domains in `references/email-patterns.md`.

Replace with an explicit note:

```markdown
Build search queries from sender domains in `references/email-patterns.md`:

- Job Alert Senders table → job alert query
- Application Status Patterns → ATS Notification Senders → status query

The two sets of senders are disjoint. Combine them into a single Gmail search:

```
from:(indeed.com OR indeedmail.com OR linkedin.com OR e.linkedin.com OR glassdoor.com OR mail.glassdoor.com OR remotehunter.com OR wellfound.com OR angel.co OR google.com OR otta.com OR ziprecruiter.com OR builtin.com OR hired.com OR greenhouse.io OR greenhouse-mail.io OR lever.co OR ashbyhq.com) newer_than:{lookback_days}d
```
```

- [ ] **Step 2: Update Phase 2 and 2G classification dispatch**

In both Phase 2 (Apple Mail) and Phase 2G (Gmail), update the line that reads "Read `skills/scan-email/classification-rules.md` and execute for each record/result." to:

```markdown
Read `skills/scan-email/classification-rules.md` and execute BOTH paths for each record:

1. **Job Alert Path**: the existing 4-step flow. If it classifies as a candidate, tag with `type: job-alert` and continue to body fetch.
2. **Status Change Path**: if the sender matches an ATS notification domain, run `bun scripts/classify-status-email.js` and tag the result with `type: status-change`. Status emails are always body-fetched (the classifier needs the body to extract URLs and signals).

A single message matches at most one path because the sender sets are disjoint. Skip messages that match neither.
```

- [ ] **Step 3: Extend phase-cache payload documentation**

Under the existing `#### Cache Body Fetch Results` block, add:

```markdown
The cached payload must include a `type` field per entry (`"job-alert"` or `"status-change"`) so resumption after interruption does not need to re-classify.
```

- [ ] **Step 4: Commit**

```bash
git add skills/scan-email/SKILL.md
git commit -m "docs(scan-email): wire Status Change Path dispatch in Phase 2/2G"
```

---

### Task 14: Phase 5 — Gate 2 status-change confirmation UX

**Files:**
- Modify: `skills/scan-email/SKILL.md`

- [ ] **Step 1: Restructure Phase 5 into two sequential gates**

Replace the existing `## Phase 5 — Present Results` section with:

```markdown
## Phase 5 — Present Results

Two sequential gates. Gate 2 only appears if there are any status-change candidates.

### Gate 1 — Role adds (unchanged)

Show the confirmation table for job-alert candidates:

| # | Company | Role | Source | Location | Comp | Link | Status |
|---|---------|------|--------|----------|------|------|--------|
| 1 | TrueML | VP of Software Engineering | Indeed (Gmail) | Remote | $225K-$325K | [View](url) | Verified ✓ |

Source column: `(Mail)`, `(Gmail)`, or `(both)`.

Show skipped counts, errors, sources scanned, then ask:

> Add these N roles to seen-postings? [y/N/edit]

### Gate 2 — Status changes (only if any HIGH or MEDIUM classifications exist)

Partition status-change candidates by tier. LOW tier never appears in this gate — those go directly to Flagged for Review in Phase 6.

Render the gate:

```
⚠️  STATUS CHANGES DETECTED — review each carefully before accepting

[1] HIGH  ✓
    Atlassian — VP Engineering
    Current:   {entry.stage} ({entry.applied}, {days-since} days ago)
    Detected:  {classifier.status}
    Signal:    "{classifier.signal}"
    Sender:    {email.sender}
    Match:     URL ({matched-url})
    Message:   {classifier.msgId}

[2] MEDIUM ⚠  name-only match — verify before accepting
    Discord — Director of Engineering
    Current:   Applied (2026-04-05, 8 days ago)
    Detected:  Rejected
    Signal:    "unfortunately"
    Sender:    no-reply@greenhouse-mail.io
    Match:     name
    Message:   <fixture-discord-001@mail.gmail.com>

Apply status changes?
  HIGH tier ([1]): accept all high-confidence? [y/N]
  MEDIUM tier ([2]): select by number or N to skip all: _
```

**Rules for Gate 2:**

1. HIGH and MEDIUM are always prompted as **two separate questions**. Never combine them.
2. HIGH tier accepts via `y/N` — a single keystroke accepts all HIGH entries.
3. MEDIUM tier requires typing a number or comma-separated list (`1,3`) or `N` to skip all. There is no "accept all" for MEDIUM.
4. If the user cancels Gate 2 (Ctrl-C or `N` to both), nothing is written. Since message-IDs are not yet in applications.md history, the next scan will re-detect these same emails.
5. Gate 2 runs AFTER Gate 1 so the user processes the less-risky operation (appending roles) before the more-risky one (mutating pipeline state).
```

- [ ] **Step 2: Commit**

```bash
git add skills/scan-email/SKILL.md
git commit -m "docs(scan-email): add Gate 2 status-change confirmation UX"
```

---

### Task 15: Phase 6 — status-change writes, flagged append, cleanup suggestions

**Files:**
- Modify: `skills/scan-email/SKILL.md`

- [ ] **Step 1: Add the status-change write block to Phase 6**

Insert after the existing `### Apple Notes sync (optional)` block and before the `### Trash Apple Mail alerts` block:

```markdown
### Write status changes (from Gate 2 confirmations)

For each accepted HIGH or MEDIUM status-change classification, call:

```bash
bun -e "
const { markStatusChanged } = require('./scripts/lib/applications');
const r = markStatusChanged('{plugin_root}/output', {
  msgId: '<classifier.msgId>',
  matchedCompany: '<classifier.matchedEntry.company>',
  newStatus: '<classifier.status>',
  signal: '<classifier.signal>',
  atsSender: '<classifier.atsSender>',
  detectedAt: '{today}',
});
console.log(JSON.stringify(r));
"
```

Expected output: `{"skipped": false}` on success. `{"skipped": true}` means the msg-id was already in applications.md history — a silent no-op, which is correct.

### Write Flagged for Review entries (LOW tier)

For each LOW tier status-change classification (from Phase 5 partitioning), call:

```bash
bun -e "
const { flagForReview } = require('./scripts/lib/applications');
const r = flagForReview('{plugin_root}/output', {
  company: '<classifier.matchedEntry?.company || extract-from-sender>',
  title: '<classifier.matchedEntry?.title || \"Unknown role\">',
  signal: '<classifier.signal>',
  status: '<classifier.status>',
  sender: '<email.sender>',
  matchMethod: '<classifier.matchMethod>',
  msgId: '<classifier.msgId>',
  detectedAt: '{today}',
});
console.log(JSON.stringify(r));
"
```

LOW entries do not require user confirmation because they only append to the Flagged for Review section — they never mutate an existing Active/Closed entry. After all LOW writes, print a one-line informational summary:

> 📋 Flagged for review: N entries appended to applications.md. See `## Flagged for Review` section to resolve.

### Cleanup suggestions (Rejected path only)

For each status-change whose `newStatus` was `Rejected` AND was accepted in Gate 2, after the applications.md write completes:

1. Derive the output directory slug from the entry's company name: lowercase, replace non-alphanumeric runs with `-`, strip leading/trailing `-`. Example: `The New York Times` → `the-new-york-times`.
2. Check if `{plugin_root}/output/{slug}/` exists and count files.
3. Accumulate a cleanup-suggestion block and print it once at the very end of the scan run:

```
💡  Cleanup suggestions (copy and run if desired — scan-email will NOT delete these):

  rm -rf output/atlassian/        # 14 files
  rm -rf output/discord/          # 8 files
```

If the slug cannot be resolved to an existing directory, print:

> 💡 Could not auto-suggest cleanup for {company} — no matching output/ directory

The skill MUST NOT run these `rm -rf` commands. The user executes them manually.
```

- [ ] **Step 2: Update the "Future Enhancements" section of SKILL.md**

Remove the `- Application status detection (Greenhouse/Lever/Ashby status change emails)` line from the Future Enhancements list, since it is now implemented.

- [ ] **Step 3: Commit**

```bash
git add skills/scan-email/SKILL.md
git commit -m "docs(scan-email): Phase 6 status writes, flagged appends, cleanup suggestions"
```

---

### Task 16: End-to-end verification

**Files:**
- None modified (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
bun test
```

Expected: all tests pass, including existing suites (`cache-cli`, `gmail-cli`, `applications`, `seen-postings*`, etc.) plus the new `status-classifier` and `classify-status-email-cli` suites. No failures.

- [ ] **Step 2: Run the classifier against the live applications.md**

```bash
bun scripts/classify-status-email.js \
  --email tests/fixtures/status-emails/atlassian-rejection-greenhouse.json \
  --applications-dir output
```

Expected: JSON output. Since the real `output/2026-04-09-applications.md` does not contain an Atlassian entry, expect `tier: "LOW"`, `matchMethod: "none"`.

If the user has added an Atlassian entry, expect `tier: "HIGH"` or `"MEDIUM"` depending on whether the entry has a URL.

- [ ] **Step 3: Dry-run end-to-end scan**

Run `scan-email` via the normal skill flow. Confirm visually:

1. Phase 2/2G executes both classification paths.
2. Gate 1 (role adds) still shows as before.
3. Gate 2 appears only if there are status-change candidates; does not appear if there are none.
4. If any LOW entries were detected, applications.md grows a `## Flagged for Review` section and the frontmatter `flagged_count` reflects the new total.
5. If any Rejected HIGH/MEDIUM were accepted, the entry moves to `## Closed Applications`, history has a `msg-id:` suffix, and a cleanup-suggestion block prints at the end.
6. Re-running the same scan without any new emails produces zero status-change writes (message-ID idempotency).

- [ ] **Step 4: Final commit marker**

If any manual fixes were needed during verification, commit them. Otherwise:

```bash
git log --oneline -20
```

Confirm the commit history contains the full sequence of feature commits from Tasks 2–15.

---

## Self-Review

### Spec coverage

- **Gmail query expansion**: Task 13 ✓
- **Status Change Path in classification-rules.md**: Task 12 ✓
- **ATS sender matching**: Task 2 ✓
- **Signal extraction with priority**: Task 3 ✓
- **URL-based slug resolution (HIGH)**: Task 4 ✓
- **Name-based slug resolution (MEDIUM)**: Task 5 ✓
- **LOW tier fallback (signal + no match, or no signal)**: Tasks 3–5 covered via fallthrough ✓
- **CLI wrapper**: Task 6 ✓
- **Flagged for Review parser**: Task 7 ✓
- **Flagged for Review formatter + frontmatter `flagged_count`**: Task 8 ✓
- **`flagForReview()` + `markStatusChanged()` with msg-id idempotency**: Task 9 ✓
- **Migrate existing applications.md frontmatter**: Task 10 ✓
- **Promote email-patterns.md section**: Task 11 ✓
- **Phase 2/2G dispatch**: Task 13 ✓
- **Phase 5 Gate 2 UX**: Task 14 ✓
- **Phase 6 status writes + flagged appends + cleanup suggestions**: Task 15 ✓
- **End-to-end verification**: Task 16 ✓
- **Fixtures for all six tier paths**: Task 1 ✓
- **Rejection cleanup is print-only, never executed**: Task 15 explicit ✓

### Placeholder scan

No "TBD", "TODO", or "implement later" markers. Every code step contains complete code. Every test step contains the actual assertions.

### Type consistency

- `classifyStatusEmail` input/output shape is defined in the interfaces section and used consistently across Tasks 2–6.
- `applicationsData` has `{ active, closed, flagged }` throughout (Task 4 initializes `flagged: []` in fallback; Task 7 formally adds the field).
- `markStatusChanged` signature matches between Task 9 definition and Task 15 caller: `{ msgId, matchedCompany, newStatus, signal, atsSender, detectedAt }`.
- `flagForReview` signature matches between Task 9 definition and Task 15 caller: `{ company, title, signal, status, sender, matchMethod, msgId, detectedAt }`.
- Entry fields on `matchedEntry` (`company`, `title`, `url`, `stage`) match what `parseApplicationsContent` produces in `scripts/lib/applications.js`.
- `ATS_SENDERS` keys (`greenhouse`, `lever`, `ashby`) match the `atsSender` values referenced in Task 14 and Task 15.

No inconsistencies found.
