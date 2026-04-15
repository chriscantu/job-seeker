# Auto-Trash Relay Variant Derivation + Pattern Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-derive iCloud relay variants for trash patterns at runtime and add a Gmail inbox audit CLI that discovers uncovered senders with heuristic classification.

**Architecture:** Phase 1 adds a pure `deriveRelayVariants()` function to the shared `trash-tables.js` lib, called by `extractAllTrashSubstrings()` before returning. Phase 2 adds a new `audit_trash_patterns.js` CLI that shells out to `gmail.js search`, a `sender-classifier.js` heuristic module, and a `appendToTrashTable()` config writer in `trash-tables.js`. All new code is tested with the existing node:test + assert/strict stack.

**Tech Stack:** Node.js (bun runtime), node:test, assert/strict, `gmail.js search` (JSON output)

---

## File Map

### Modified
- `scripts/lib/trash-tables.js` — add `deriveRelayVariants()`, `appendToTrashTable()`, wire relay derivation into `extractAllTrashSubstrings()`
- `tests/auto-trash-tables.test.js` — new tests for relay variants, dedup, config writer; update count expectations
- `tests/auto-trash-gmail-cli.test.js` — update expected pattern counts in stubbed tests (relay expansion changes the count)
- `tests/auto-trash-inbox-cli.test.js` — update expected pattern counts (same reason)
- `config/search.md.example` — fix `inmail-hit-reply@linkedin.com` → `hit-reply@linkedin.com` per issue #93 findings

### New
- `scripts/lib/sender-classifier.js` — heuristic sender domain classifier
- `scripts/audit_trash_patterns.js` — audit CLI
- `tests/sender-classifier.test.js` — classifier unit tests
- `tests/audit-trash-patterns.test.js` — audit CLI integration tests
- `tests/fixtures/gmail-search-stub.js` — stub for `gmail.js search` (distinct from existing `gmail-stub.js` which stubs `trash-by-sender`)

---

## Task 1: `deriveRelayVariants()` — failing tests

**Files:**
- Test: `tests/auto-trash-tables.test.js`

- [ ] **Step 1: Write failing tests for `deriveRelayVariants`**

Add these tests to the bottom of `tests/auto-trash-tables.test.js`:

```js
const {
  deriveRelayVariants,
} = require("../scripts/lib/trash-tables");

test("deriveRelayVariants: dot-only pattern gets underscore variant", () => {
  const result = deriveRelayVariants(["topresume.com"]);
  assert.deepStrictEqual(result, ["topresume.com", "topresume_com"]);
});

test("deriveRelayVariants: @-containing pattern gets _at_ variant", () => {
  const result = deriveRelayVariants(["invitations@linkedin.com"]);
  assert.deepStrictEqual(result, [
    "invitations@linkedin.com",
    "invitations_at_linkedin_com",
  ]);
});

test("deriveRelayVariants: no-dot no-@ pattern unchanged", () => {
  const result = deriveRelayVariants(["hackajob"]);
  assert.deepStrictEqual(result, ["hackajob"]);
});

test("deriveRelayVariants: deduplicates when variant already in input", () => {
  const result = deriveRelayVariants(["topresume.com", "topresume_com"]);
  assert.deepStrictEqual(result, ["topresume.com", "topresume_com"]);
});

test("deriveRelayVariants: originals before variants, stable order", () => {
  const result = deriveRelayVariants(["lensa.com", "hackajob", "topresume.com"]);
  assert.deepStrictEqual(result, [
    "lensa.com",
    "hackajob",
    "topresume.com",
    "lensa_com",
    "topresume_com",
  ]);
});

test("deriveRelayVariants: multiple @ patterns", () => {
  const result = deriveRelayVariants([
    "invitations@linkedin.com",
    "hit-reply@linkedin.com",
  ]);
  assert.deepStrictEqual(result, [
    "invitations@linkedin.com",
    "hit-reply@linkedin.com",
    "invitations_at_linkedin_com",
    "hit-reply_at_linkedin_com",
  ]);
});

test("deriveRelayVariants: empty array returns empty", () => {
  const result = deriveRelayVariants([]);
  assert.deepStrictEqual(result, []);
});
```

Also update the import at the top of the file to include `deriveRelayVariants`:

```js
const {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
  deriveRelayVariants,
} = require("../scripts/lib/trash-tables");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/auto-trash-tables.test.js`
Expected: New tests FAIL with `deriveRelayVariants is not a function`

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/auto-trash-tables.test.js
git commit -m "test: add failing tests for deriveRelayVariants (#93)"
```

---

## Task 2: `deriveRelayVariants()` — implementation

**Files:**
- Modify: `scripts/lib/trash-tables.js`

- [ ] **Step 1: Implement `deriveRelayVariants` and wire into `extractAllTrashSubstrings`**

Add the function above `extractAllTrashSubstrings` in `scripts/lib/trash-tables.js`:

```js
// Derive iCloud "Hide My Email" relay variants for sender patterns.
// iCloud rewrites `user@domain.com` to `user_at_domain_com_{random}@icloud.com`,
// turning every `.` into `_` and every `@` into `_at_`. A configured pattern
// like `topresume.com` won't match the relay address `topresume_com_xxx@icloud.com`
// unless we also search for `topresume_com`.
//
// Returns the input array followed by any new variants, deduplicated.
// Originals always appear before derived variants to preserve table order.
function deriveRelayVariants(substrings) {
  const variants = [];
  const seen = new Set(substrings);
  for (const s of substrings) {
    let variant = null;
    if (s.includes('@') && s.includes('.')) {
      // invitations@linkedin.com → invitations_at_linkedin_com
      variant = s.replace(/@/g, '_at_').replace(/\./g, '_');
    } else if (s.includes('.')) {
      // topresume.com → topresume_com
      variant = s.replace(/\./g, '_');
    }
    if (variant !== null && !seen.has(variant)) {
      variants.push(variant);
      seen.add(variant);
    }
  }
  return [...substrings, ...variants];
}
```

Then update `extractAllTrashSubstrings` to call it before returning. Change the last line of `extractAllTrashSubstrings` from:

```js
  return result;
```

to:

```js
  return deriveRelayVariants(result);
```

Finally, export `deriveRelayVariants` by adding it to `module.exports`:

```js
module.exports = {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
  deriveRelayVariants,
};
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test tests/auto-trash-tables.test.js`
Expected: ALL tests pass, including the new `deriveRelayVariants` tests AND the existing tests.

Note: The existing `extractAllTrashSubstrings` concatenation test will now return 16 items instead of 8 (8 originals + 8 relay variants). That test checks for `includes("lensa.com")`, `includes("topresume.com")`, and `includes("jobalerts-noreply@linkedin.com")` — all three originals are still present, so the test should still pass as-is. Verify this.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/trash-tables.js
git commit -m "feat: add deriveRelayVariants for iCloud relay address matching (#93)"
```

---

## Task 3: Update CLI integration tests for expanded pattern counts

**Files:**
- Modify: `tests/auto-trash-gmail-cli.test.js`
- Modify: `tests/auto-trash-inbox-cli.test.js`

The relay expansion changes the pattern count that `expectedPatternCount` sees. Any test that uses a fixture with dot-containing patterns and checks for an exact pattern count via the `classifyGmailResult`/`classifyOsascriptResult` anomaly detector must account for the expanded count.

- [ ] **Step 1: Identify tests with count-sensitive fixtures**

In `tests/auto-trash-gmail-cli.test.js`, the tests at lines 156-189, 214-250, 252-286, and 382-412 use inline markdown fixtures with 3 raw patterns (`lensa.com`, `topresume.com`, `glassdoor.com`). After relay expansion, each gets a `_com` variant → 6 total patterns. The stub stdout must report 6 entries, not 3.

Update each of those tests' stub stdout strings. For example, in the test at line 156 ("exits EXIT_OK (0) when stub returns a clean success line"), change:

```js
stdout: "trashed: lensa.com=2/2 topresume.com=0/0 glassdoor.com=3/3",
```

to:

```js
stdout: "trashed: lensa.com=2/2 topresume.com=0/0 glassdoor.com=3/3 lensa_com=0/0 topresume_com=0/0 glassdoor_com=0/0",
```

Apply the same pattern to the partial-failure test (line 214), cap-hit test (line 252), and count-mismatch test (line 382).

For the count-mismatch test (line 382), the test is specifically checking that a count mismatch is detected. Update the fixture to have 3 raw patterns (→ 6 expanded) but the stub reports only 4 entries:

```js
stdout: "trashed: lensa.com=1/1 topresume.com=0/0 lensa_com=0/0 topresume_com=0/0",
```

This is still a mismatch (4 reported vs 6 expected), so the test assertion (`exitCode === 4`) still holds.

For the ladders regression test (line 288), the dry-run output just checks that `ladders.com` and `theladders.com` appear in the pattern list. The relay variants will also appear, but the assertions use `match(/ladders\.com/)` which still matches. No change needed.

- [ ] **Step 2: Verify `tests/auto-trash-inbox-cli.test.js` needs no changes**

The inbox CLI tests only use `--dry-run` (no osascript invocation, no stub output with pattern counts). The `patterns:` line assertion uses a regex match, not a count check. Run `bun test tests/auto-trash-inbox-cli.test.js` to confirm all tests pass without changes. If any fail, apply the same count-expansion pattern as the Gmail tests.

- [ ] **Step 3: Run the full test suite**

Run: `bun test tests/auto-trash-gmail-cli.test.js tests/auto-trash-inbox-cli.test.js tests/auto-trash-tables.test.js`
Expected: ALL tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/auto-trash-gmail-cli.test.js tests/auto-trash-inbox-cli.test.js
git commit -m "test: update CLI integration tests for relay-expanded pattern counts (#93)"
```

---

## Task 4: Fix `search.md.example` — `inmail-hit-reply` → `hit-reply`

**Files:**
- Modify: `config/search.md.example`

- [ ] **Step 1: Fix the known-wrong pattern**

In `config/search.md.example`, change:

```
| LinkedIn InMail / sales outreach | inmail-hit-reply@linkedin.com |
```

to:

```
| LinkedIn InMail / sales outreach | hit-reply@linkedin.com |
```

This was identified in issue #93: LinkedIn sends from `hit-reply@linkedin.com`, not `inmail-hit-reply@linkedin.com`. The longer pattern was a superstring that never matched.

- [ ] **Step 2: Run contract tests against the example**

Run: `bun test tests/auto-trash-tables.test.js`
Expected: ALL pass (no existing test pinned the exact `inmail-hit-reply` string).

- [ ] **Step 3: Commit**

```bash
git add config/search.md.example
git commit -m "fix: correct LinkedIn sender pattern inmail-hit-reply → hit-reply (#93)"
```

---

## Task 5: `sender-classifier.js` — failing tests

**Files:**
- Test: `tests/sender-classifier.test.js` (new)

- [ ] **Step 1: Create the test file**

Create `tests/sender-classifier.test.js`:

```js
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { classifySender } = require("../scripts/lib/sender-classifier");

// --- Known domain lists (high confidence) ---

test("classifier: glassdoor.com → job-alert / high", () => {
  const result = classifySender({
    domain: "glassdoor.com",
    fromAddresses: ["noreply@glassdoor.com"],
    messageCount: 6,
    subjects: ["6 new VP Engineering jobs in Austin"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});

test("classifier: indeed.com → job-alert / high", () => {
  const result = classifySender({
    domain: "indeed.com",
    fromAddresses: ["alert@indeed.com"],
    messageCount: 3,
    subjects: ["New jobs for VP Engineering"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});

test("classifier: wellfound.com → job-alert / high", () => {
  const result = classifySender({
    domain: "wellfound.com",
    fromAddresses: ["team@hi.wellfound.com"],
    messageCount: 4,
    subjects: ["Your weekly job digest"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});

test("classifier: lensa.com → staffing / high", () => {
  const result = classifySender({
    domain: "lensa.com",
    fromAddresses: ["jobs@lensa.com"],
    messageCount: 2,
    subjects: ["New matches for you"],
  });
  assert.equal(result.suggestedCategory, "staffing");
  assert.equal(result.confidence, "high");
});

test("classifier: topresume.com → marketing / high", () => {
  const result = classifySender({
    domain: "topresume.com",
    fromAddresses: ["andrew@topresume.com"],
    messageCount: 5,
    subjects: ["Your resume review is ready"],
  });
  assert.equal(result.suggestedCategory, "marketing");
  assert.equal(result.confidence, "high");
});

// --- Heuristic signals (medium confidence) ---

test("classifier: noreply@ from unknown domain with high count → medium", () => {
  const result = classifySender({
    domain: "unknownplatform.io",
    fromAddresses: ["noreply@unknownplatform.io"],
    messageCount: 8,
    subjects: ["Your weekly update", "Your weekly update", "Your weekly update"],
  });
  assert.equal(result.confidence, "medium");
  // Category could be any of the three — just verify it's not "unknown"
  assert.notEqual(result.suggestedCategory, "unknown");
});

test("classifier: notifications@ from unknown domain with 5+ messages → medium", () => {
  const result = classifySender({
    domain: "someservice.com",
    fromAddresses: ["notifications@someservice.com"],
    messageCount: 5,
    subjects: ["Update 1", "Update 2", "Update 3", "Update 4", "Update 5"],
  });
  assert.equal(result.confidence, "medium");
});

// --- Fallback (low confidence) ---

test("classifier: unknown domain, low count, no signals → unknown / low", () => {
  const result = classifySender({
    domain: "randomcompany.com",
    fromAddresses: ["jane@randomcompany.com"],
    messageCount: 1,
    subjects: ["Following up on our conversation"],
  });
  assert.equal(result.suggestedCategory, "unknown");
  assert.equal(result.confidence, "low");
});

// --- Edge cases ---

test("classifier: subdomain of known domain does NOT match (notglassdoor.com)", () => {
  const result = classifySender({
    domain: "notglassdoor.com",
    fromAddresses: ["hi@notglassdoor.com"],
    messageCount: 1,
    subjects: ["Hello"],
  });
  // Must not be classified as job-alert just because it contains "glassdoor"
  assert.notEqual(result.confidence, "high");
});

test("classifier: mail subdomain of known domain DOES match (mail.glassdoor.com)", () => {
  const result = classifySender({
    domain: "mail.glassdoor.com",
    fromAddresses: ["noreply@mail.glassdoor.com"],
    messageCount: 3,
    subjects: ["New jobs"],
  });
  assert.equal(result.suggestedCategory, "job-alert");
  assert.equal(result.confidence, "high");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/sender-classifier.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/sender-classifier'`

- [ ] **Step 3: Commit**

```bash
git add tests/sender-classifier.test.js
git commit -m "test: add failing tests for sender-classifier heuristics (#93)"
```

---

## Task 6: `sender-classifier.js` — implementation

**Files:**
- Create: `scripts/lib/sender-classifier.js`

- [ ] **Step 1: Implement the classifier**

Create `scripts/lib/sender-classifier.js`:

```js
// scripts/lib/sender-classifier.js
//
// Heuristic classifier for sender domains discovered by the audit CLI.
// Takes a sender domain + sample data and suggests which auto-trash table
// it belongs in, with a confidence level.
//
// Classification is ordered by specificity:
//   1. Known domain lists → high confidence
//   2. Heuristic signals (noreply@, high count, templated subjects) → medium
//   3. Fallback → unknown / low

// Known domains grouped by category. Entries match the domain itself or
// any subdomain (mail.glassdoor.com matches glassdoor.com). This is
// intentionally conservative — only well-known, unambiguous domains.
const KNOWN_DOMAINS = {
  'job-alert': [
    'glassdoor.com',
    'indeed.com',
    'ziprecruiter.com',
    'wellfound.com',
    'remotehunter.com',
    'builtin.com',
    'otta.com',
    'dice.com',
    'monster.com',
    'careerbuilder.com',
    'linkedin.com',
  ],
  staffing: [
    'lensa.com',
    'hackajob.co',
    'jobgether.com',
    'echojobs.io',
    'jobera.com',
    'simplyhired.com',
    'remoterocketship.com',
    'ladders.com',
    'theladders.com',
  ],
  marketing: [
    'topresume.com',
    'resumegenius.com',
    'zety.com',
    'resume.io',
    'novoresume.com',
  ],
};

// Automated sender local-part prefixes — signals that the sender is a
// system, not a person.
const AUTOMATED_LOCAL_PARTS = [
  'noreply',
  'no-reply',
  'notifications',
  'alerts',
  'jobalerts',
  'jobs-noreply',
  'jobs-listings',
  'team',
  'updates',
  'digest',
  'mailer',
];

// Check if `domain` matches or is a subdomain of any entry in `domainList`.
// "mail.glassdoor.com" matches "glassdoor.com".
// "notglassdoor.com" does NOT match "glassdoor.com".
function matchesDomainList(domain, domainList) {
  const lower = domain.toLowerCase();
  for (const known of domainList) {
    if (lower === known || lower.endsWith('.' + known)) {
      return true;
    }
  }
  return false;
}

// Check if any fromAddress has an automated local-part prefix.
function hasAutomatedLocalPart(fromAddresses) {
  for (const addr of fromAddresses) {
    const local = addr.split('@')[0].toLowerCase();
    for (const prefix of AUTOMATED_LOCAL_PARTS) {
      if (local === prefix || local.startsWith(prefix + '-') || local.startsWith(prefix + '+')) {
        return true;
      }
    }
  }
  return false;
}

// Check if subjects are templated (many similar subjects).
function hasTemplatedSubjects(subjects) {
  if (subjects.length < 3) return false;
  // If 50%+ of subjects share the same first 10 characters, likely templated.
  const prefixes = subjects.map((s) => s.slice(0, 10).toLowerCase());
  const counts = {};
  for (const p of prefixes) {
    counts[p] = (counts[p] || 0) + 1;
  }
  const maxCount = Math.max(...Object.values(counts));
  return maxCount / subjects.length >= 0.5;
}

function classifySender({ domain, fromAddresses, messageCount, subjects }) {
  // 1. Known domain lists — high confidence
  for (const [category, domainList] of Object.entries(KNOWN_DOMAINS)) {
    if (matchesDomainList(domain, domainList)) {
      return { suggestedCategory: category, confidence: 'high' };
    }
  }

  // 2. Heuristic signals — medium confidence
  const isAutomated = hasAutomatedLocalPart(fromAddresses);
  const isHighVolume = messageCount >= 5;
  const isTemplated = hasTemplatedSubjects(subjects);

  if (isAutomated && isHighVolume) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }
  if (isAutomated && isTemplated) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }
  if (isHighVolume && isTemplated) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }
  // Single strong signal with supporting evidence
  if (isAutomated && messageCount >= 3) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }

  // 3. Fallback — unknown / low
  return { suggestedCategory: 'unknown', confidence: 'low' };
}

module.exports = {
  classifySender,
  matchesDomainList,
  hasAutomatedLocalPart,
  hasTemplatedSubjects,
  KNOWN_DOMAINS,
  AUTOMATED_LOCAL_PARTS,
};
```

- [ ] **Step 2: Run tests**

Run: `bun test tests/sender-classifier.test.js`
Expected: ALL pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/sender-classifier.js
git commit -m "feat: add sender-classifier heuristic module (#93)"
```

---

## Task 7: `appendToTrashTable()` — failing tests

**Files:**
- Test: `tests/auto-trash-tables.test.js`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `tests/auto-trash-tables.test.js`. Also add `appendToTrashTable` to the require at the top.

Update the import:

```js
const {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
  deriveRelayVariants,
  appendToTrashTable,
} = require("../scripts/lib/trash-tables");
```

Add tests:

```js
test("appendToTrashTable: appends to the correct table", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-test-")),
    "search.md"
  );
  fs.copyFileSync(SEARCH_MD, tmpFile);

  appendToTrashTable(tmpFile, "Job Alert Senders to Auto-Trash After Scan", [
    { name: "Glassdoor alerts", pattern: "noreply@glassdoor.com" },
  ]);

  const updated = fs.readFileSync(tmpFile, "utf8");
  const subs = extractTableSubstrings(
    updated,
    "Job Alert Senders to Auto-Trash After Scan"
  );
  assert.ok(
    subs.includes("noreply@glassdoor.com"),
    "appended pattern should be in the table"
  );

  // Other tables should be unchanged
  const staffing = extractTableSubstrings(
    updated,
    "Staffing/Aggregator Company Exclusions"
  );
  assert.ok(staffing.includes("lensa.com"), "staffing table should be unchanged");

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

test("appendToTrashTable: appends to last table (EOF edge case)", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-eof-test-")),
    "search.md"
  );
  // Minimal fixture where Job Alert is the last section before EOF
  const md = `## Staffing/Aggregator Company Exclusions

| Name | Trash Sender Substring |
|------|------------------------|
| Lensa | lensa.com |

## Marketing / Non-Job-Search Senders to Auto-Trash

| Sender | Trash Sender Substring |
|--------|------------------------|
| TopResume | topresume.com |

## Job Alert Senders to Auto-Trash After Scan

| Sender | Trash Sender Substring |
|--------|------------------------|
| LinkedIn | jobalerts-noreply@linkedin.com |
`;
  fs.writeFileSync(tmpFile, md);

  appendToTrashTable(tmpFile, "Job Alert Senders to Auto-Trash After Scan", [
    { name: "Glassdoor", pattern: "glassdoor.com" },
  ]);

  const updated = fs.readFileSync(tmpFile, "utf8");
  const subs = extractTableSubstrings(
    updated,
    "Job Alert Senders to Auto-Trash After Scan"
  );
  assert.ok(subs.includes("glassdoor.com"), "should append to last table");
  assert.ok(
    subs.includes("jobalerts-noreply@linkedin.com"),
    "existing rows preserved"
  );

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

test("appendToTrashTable: appends multiple entries at once", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-multi-test-")),
    "search.md"
  );
  fs.copyFileSync(SEARCH_MD, tmpFile);

  appendToTrashTable(tmpFile, "Marketing / Non-Job-Search Senders to Auto-Trash", [
    { name: "ResumeGenius", pattern: "resumegenius.com" },
    { name: "Zety", pattern: "zety.com" },
  ]);

  const updated = fs.readFileSync(tmpFile, "utf8");
  const subs = extractTableSubstrings(
    updated,
    "Marketing / Non-Job-Search Senders to Auto-Trash"
  );
  assert.ok(subs.includes("resumegenius.com"));
  assert.ok(subs.includes("zety.com"));

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/auto-trash-tables.test.js`
Expected: New `appendToTrashTable` tests FAIL — `appendToTrashTable is not a function`

- [ ] **Step 3: Commit**

```bash
git add tests/auto-trash-tables.test.js
git commit -m "test: add failing tests for appendToTrashTable config writer (#93)"
```

---

## Task 8: `appendToTrashTable()` — implementation

**Files:**
- Modify: `scripts/lib/trash-tables.js`

- [ ] **Step 1: Implement `appendToTrashTable`**

Add this function to `scripts/lib/trash-tables.js` before `module.exports`:

```js
// Append new rows to a specific auto-trash table in search.md.
// Each entry is { name: string, pattern: string }.
// Finds the table by heading, locates the last data row, and inserts
// new rows after it (before the next heading or EOF).
function appendToTrashTable(filePath, headingText, entries) {
  if (!entries || entries.length === 0) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const headingMarker = `## ${headingText}`;
  const headingIdx = content.indexOf(headingMarker);
  if (headingIdx === -1) {
    throw new Error(`Heading not found: ${headingMarker}`);
  }
  const afterHeading = content.slice(headingIdx);
  const nextHeadingMatch = afterHeading.match(/\n## (?!$)/m);
  // nextHeadingOffset is relative to headingIdx
  const sectionEnd = nextHeadingMatch
    ? headingIdx + nextHeadingMatch.index
    : content.length;

  // Find the last table row (line starting with |) in this section
  const section = content.slice(headingIdx, sectionEnd);
  const lines = section.split('\n');
  let lastTableLineOffset = -1;
  let offset = headingIdx;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|') && !lines[i].includes('---')) {
      lastTableLineOffset = offset + lines[i].length;
    }
    offset += lines[i].length + 1; // +1 for \n
  }

  if (lastTableLineOffset === -1) {
    throw new Error(`No table rows found under ${headingMarker}`);
  }

  const newRows = entries
    .map((e) => `| ${e.name} | ${e.pattern} |`)
    .join('\n');

  const updated =
    content.slice(0, lastTableLineOffset) +
    '\n' +
    newRows +
    content.slice(lastTableLineOffset);

  fs.writeFileSync(filePath, updated);
}
```

Add `fs` require at the top of the file (it's not currently imported):

```js
const fs = require('fs');
```

Add `appendToTrashTable` to `module.exports`:

```js
module.exports = {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
  deriveRelayVariants,
  appendToTrashTable,
};
```

- [ ] **Step 2: Run tests**

Run: `bun test tests/auto-trash-tables.test.js`
Expected: ALL pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/trash-tables.js
git commit -m "feat: add appendToTrashTable config writer (#93)"
```

---

## Task 9: Gmail search stub fixture

**Files:**
- Create: `tests/fixtures/gmail-search-stub.js`

- [ ] **Step 1: Create the stub**

Create `tests/fixtures/gmail-search-stub.js`:

```js
#!/usr/bin/env bun
// tests/fixtures/gmail-search-stub.js
//
// Test double for `gmail.js search`, used by audit_trash_patterns.js
// integration tests via JOB_SEEKER_GMAIL_BIN. Unlike gmail-stub.js
// (which stubs trash-by-sender), this stub reads GMAIL_SEARCH_STDOUT /
// GMAIL_SEARCH_STDERR / GMAIL_SEARCH_EXIT and echoes them.
//
// The stub checks that argv[1] === "search" to confirm the audit CLI
// is calling the right subcommand, then echoes the canned response.

const cmd = process.argv[2];
if (cmd !== 'search') {
  process.stderr.write(`gmail-search-stub: unexpected command "${cmd}" (expected "search")\n`);
  process.exit(1);
}

const stdout = process.env.GMAIL_SEARCH_STDOUT || '[]';
const stderr = process.env.GMAIL_SEARCH_STDERR || '';
const exit = parseInt(process.env.GMAIL_SEARCH_EXIT || '0', 10);

if (stdout) process.stdout.write(stdout + '\n');
if (stderr) process.stderr.write(stderr + '\n');
process.exit(exit);
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures/gmail-search-stub.js
git commit -m "test: add gmail-search-stub fixture for audit CLI tests (#93)"
```

---

## Task 10: `audit_trash_patterns.js` — failing tests

**Files:**
- Test: `tests/audit-trash-patterns.test.js` (new)

- [ ] **Step 1: Create the test file**

Create `tests/audit-trash-patterns.test.js`:

```js
"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "..", "scripts", "audit_trash_patterns.js");
const GMAIL_SEARCH_STUB = path.join(
  __dirname,
  "fixtures",
  "gmail-search-stub.js"
);
const EXAMPLE_SEARCH_MD = path.resolve(
  __dirname,
  "..",
  "config",
  "search.md.example"
);

let tmpDir;
let searchMdPath;

function run(args = "", env = {}) {
  return execSync(`bun ${CLI} ${args}`, {
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      JOB_SEEKER_SEARCH_MD: searchMdPath,
      JOB_SEEKER_GMAIL_BIN: GMAIL_SEARCH_STUB,
      JOB_SEEKER_SKIP_CRED_CHECK: "1",
      ...env,
    },
  });
}

function runExpectError(args = "", env = {}) {
  try {
    execSync(`bun ${CLI} ${args}`, {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        JOB_SEEKER_SEARCH_MD: searchMdPath,
        JOB_SEEKER_GMAIL_BIN: GMAIL_SEARCH_STUB,
        JOB_SEEKER_SKIP_CRED_CHECK: "1",
        ...env,
      },
    });
    return { exitCode: 0, stdout: "", stderr: "" };
  } catch (err) {
    return {
      exitCode: err.status,
      stdout: (err.stdout || "").toString(),
      stderr: (err.stderr || "").toString(),
    };
  }
}

function makeSearchResults(messages) {
  return JSON.stringify(
    messages.map((m, i) => ({
      id: `msg-${i}`,
      threadId: `thread-${i}`,
      from: m.from,
      to: "me@example.com",
      subject: m.subject || "Test subject",
      date: "2026-04-15",
      snippet: "",
    }))
  );
}

describe("audit_trash_patterns.js CLI", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-trash-test-"));
    searchMdPath = path.join(tmpDir, "search.md");
    fs.copyFileSync(EXAMPLE_SEARCH_MD, searchMdPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("outputs valid JSON with coveredCount and uncoveredSenders", () => {
    const searchResults = makeSearchResults([
      { from: "noreply@glassdoor.com", subject: "6 new VP jobs" },
      { from: "noreply@glassdoor.com", subject: "5 new VP jobs" },
      { from: "jobs@lensa.com", subject: "New matches" },
      { from: "jobalerts-noreply@linkedin.com", subject: "Job alert" },
    ]);
    const out = run("", { GMAIL_SEARCH_STDOUT: searchResults });
    const result = JSON.parse(out);
    assert.ok(typeof result.coveredCount === "number");
    assert.ok(Array.isArray(result.uncoveredSenders));
    assert.ok(Array.isArray(result.coveredSenders));
  });

  it("detects uncovered senders", () => {
    const searchResults = makeSearchResults([
      { from: "noreply@glassdoor.com", subject: "6 new VP jobs" },
      { from: "noreply@glassdoor.com", subject: "5 new VP jobs" },
    ]);
    const out = run("", { GMAIL_SEARCH_STDOUT: searchResults });
    const result = JSON.parse(out);
    const uncovered = result.uncoveredSenders.find(
      (s) => s.domain === "glassdoor.com"
    );
    assert.ok(uncovered, "glassdoor.com should be uncovered");
    assert.equal(uncovered.messageCount, 2);
    assert.ok(uncovered.fromAddresses.includes("noreply@glassdoor.com"));
  });

  it("identifies covered senders correctly", () => {
    const searchResults = makeSearchResults([
      { from: "jobs@lensa.com", subject: "New matches" },
    ]);
    const out = run("", { GMAIL_SEARCH_STDOUT: searchResults });
    const result = JSON.parse(out);
    const covered = result.coveredSenders.find(
      (s) => s.domain === "lensa.com"
    );
    assert.ok(covered, "lensa.com should be covered");
  });

  it("includes classifier output for uncovered senders", () => {
    const searchResults = makeSearchResults([
      { from: "noreply@glassdoor.com", subject: "New jobs" },
    ]);
    const out = run("", { GMAIL_SEARCH_STDOUT: searchResults });
    const result = JSON.parse(out);
    const uncovered = result.uncoveredSenders[0];
    assert.ok(uncovered.suggestedCategory, "should have suggestedCategory");
    assert.ok(uncovered.confidence, "should have confidence");
    assert.ok(uncovered.suggestedPattern, "should have suggestedPattern");
  });

  it("--uncovered-only omits coveredSenders from output", () => {
    const searchResults = makeSearchResults([
      { from: "jobs@lensa.com", subject: "Matches" },
      { from: "noreply@glassdoor.com", subject: "New jobs" },
    ]);
    const out = run("--uncovered-only", { GMAIL_SEARCH_STDOUT: searchResults });
    const result = JSON.parse(out);
    assert.ok(!result.coveredSenders, "coveredSenders should be absent");
    assert.ok(Array.isArray(result.uncoveredSenders));
  });

  it("exits EXIT_CONFIG (2) when search.md is missing", () => {
    fs.rmSync(searchMdPath);
    const { exitCode, stderr } = runExpectError("", {
      GMAIL_SEARCH_STDOUT: "[]",
    });
    assert.equal(exitCode, 2);
    assert.match(stderr, /search\.md/);
  });

  it("exits EXIT_GMAIL_API (4) when gmail search stub exits non-zero", () => {
    const { exitCode } = runExpectError("", {
      GMAIL_SEARCH_STDOUT: "",
      GMAIL_SEARCH_STDERR: "auth error",
      GMAIL_SEARCH_EXIT: "1",
    });
    assert.equal(exitCode, 4);
  });

  it("handles empty inbox gracefully", () => {
    const out = run("", { GMAIL_SEARCH_STDOUT: "[]" });
    const result = JSON.parse(out);
    assert.equal(result.coveredCount, 0);
    assert.deepStrictEqual(result.uncoveredSenders, []);
  });

  it("collects sample subjects in uncovered senders", () => {
    const searchResults = makeSearchResults([
      { from: "noreply@glassdoor.com", subject: "6 new VP Engineering jobs" },
      { from: "noreply@glassdoor.com", subject: "Your daily job alert" },
    ]);
    const out = run("", { GMAIL_SEARCH_STDOUT: searchResults });
    const result = JSON.parse(out);
    const uncovered = result.uncoveredSenders.find(
      (s) => s.domain === "glassdoor.com"
    );
    assert.ok(uncovered.sampleSubjects.length > 0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun test tests/audit-trash-patterns.test.js`
Expected: FAIL — `Cannot find module '../scripts/audit_trash_patterns.js'`

- [ ] **Step 3: Commit**

```bash
git add tests/audit-trash-patterns.test.js
git commit -m "test: add failing tests for audit_trash_patterns CLI (#93)"
```

---

## Task 11: `audit_trash_patterns.js` — implementation

**Files:**
- Create: `scripts/audit_trash_patterns.js`

- [ ] **Step 1: Implement the audit CLI**

Create `scripts/audit_trash_patterns.js`:

```js
#!/usr/bin/env bun
// scripts/audit_trash_patterns.js
//
// Discovers Gmail inbox senders not covered by any configured auto-trash
// pattern. Outputs structured JSON for the scan-email skill to present
// interactively for human review.
//
// Usage:
//   bun scripts/audit_trash_patterns.js                    # Full audit
//   bun scripts/audit_trash_patterns.js --newer-than 7d    # Narrow window
//   bun scripts/audit_trash_patterns.js --uncovered-only   # Skip covered
//
// Exit codes:
//   0  success
//   2  config error (missing search.md, missing credentials)
//   4  Gmail API error (search subprocess failed)
//
// Env overrides (intended for tests):
//   JOB_SEEKER_SEARCH_MD           override path to search.md
//   JOB_SEEKER_GMAIL_BIN           override path to gmail.js
//   JOB_SEEKER_GMAIL_CREDS         override path to credentials/ dir
//   JOB_SEEKER_SKIP_CRED_CHECK     skip credential existence check

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { extractAllTrashSubstrings } = require('./lib/trash-tables');
const { classifySender } = require('./lib/sender-classifier');

const EXIT_OK = 0;
const EXIT_CONFIG = 2;
const EXIT_GMAIL_API = 4;

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SEARCH_MD = path.join(REPO_ROOT, 'config', 'search.md');
const DEFAULT_GMAIL_BIN = path.join(REPO_ROOT, 'scripts', 'gmail.js');
const DEFAULT_CREDS_DIR = path.join(REPO_ROOT, 'credentials');

class ConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ConfigError';
  }
}

function parseArgs(argv) {
  const args = { newerThan: '30d', uncoveredOnly: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--uncovered-only') {
      args.uncoveredOnly = true;
    } else if (a.startsWith('--newer-than=')) {
      args.newerThan = a.slice('--newer-than='.length);
    } else if (a === '--newer-than') {
      const v = rest[i + 1];
      if (v === undefined || v.startsWith('--')) {
        throw new Error('--newer-than requires a value');
      }
      args.newerThan = v;
      i++;
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    'Usage: bun scripts/audit_trash_patterns.js [--newer-than WINDOW] [--uncovered-only]\n' +
      '\n' +
      'Discovers Gmail inbox senders not covered by auto-trash patterns.\n' +
      'Outputs structured JSON.\n'
  );
}

function readSearchMd(searchPath) {
  if (!fs.existsSync(searchPath)) {
    throw new ConfigError(
      `search.md not found at ${searchPath}. ` +
        `Copy config/search.md.example to config/search.md and customize.`
    );
  }
  return fs.readFileSync(searchPath, 'utf8');
}

function checkCredentials(credsDir) {
  const clientSecret = path.join(credsDir, 'gmail-client-secret.json');
  const tokens = path.join(credsDir, 'gmail-tokens.json');
  if (!fs.existsSync(clientSecret) || !fs.existsSync(tokens)) {
    throw new ConfigError(
      `Gmail credentials missing in ${credsDir}. ` +
        `Expected gmail-client-secret.json and gmail-tokens.json. ` +
        `Run: bun scripts/gmail.js auth`
    );
  }
}

// Extract email address from a From header like "Name <email@domain.com>"
// or bare "email@domain.com".
function parseEmailAddress(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  // Bare email
  return fromHeader.trim().toLowerCase();
}

// Extract domain from an email address.
function extractDomain(email) {
  const at = email.lastIndexOf('@');
  if (at === -1) return email;
  return email.slice(at + 1);
}

// Check if a sender email or domain is covered by any configured pattern.
function isCovered(email, domain, patterns) {
  for (const p of patterns) {
    if (email.includes(p) || domain.includes(p)) {
      return p;
    }
  }
  return null;
}

function runGmailSearch(gmailBin, newerThan) {
  const query = `in:inbox newer_than:${newerThan}`;
  const result = spawnSync('bun', [gmailBin, 'search', query, '--max', '500'], {
    encoding: 'utf8',
    timeout: 60000,
  });
  if (result.error) {
    throw new Error(`gmail.js search failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const msg = (result.stderr || '').trim() || 'unknown error';
    throw new Error(`gmail.js search exited ${result.status}: ${msg}`);
  }
  const stdout = (result.stdout || '').trim();
  if (!stdout) return [];
  return JSON.parse(stdout);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    printHelp();
    return EXIT_CONFIG;
  }
  if (args.help) {
    printHelp();
    return EXIT_OK;
  }

  const searchPath = process.env.JOB_SEEKER_SEARCH_MD || DEFAULT_SEARCH_MD;
  const gmailBin = process.env.JOB_SEEKER_GMAIL_BIN || DEFAULT_GMAIL_BIN;
  const credsDir = process.env.JOB_SEEKER_GMAIL_CREDS || DEFAULT_CREDS_DIR;
  const skipCredCheck = Boolean(process.env.JOB_SEEKER_SKIP_CRED_CHECK);

  // Read config
  let patterns;
  try {
    const md = readSearchMd(searchPath);
    patterns = extractAllTrashSubstrings(md);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_CONFIG;
    }
    process.stderr.write(`error: ${err.message}\n`);
    return EXIT_CONFIG;
  }

  // Check credentials
  if (!skipCredCheck) {
    try {
      checkCredentials(credsDir);
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT_CONFIG;
    }
  }

  // Search Gmail
  let messages;
  try {
    messages = runGmailSearch(gmailBin, args.newerThan);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return EXIT_GMAIL_API;
  }

  // Group by sender domain
  const domainMap = new Map(); // domain → { fromAddresses: Set, subjects: [], count: number }
  for (const msg of messages) {
    if (!msg.from) continue;
    const email = parseEmailAddress(msg.from);
    const domain = extractDomain(email);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        fromAddresses: new Set(),
        subjects: [],
        count: 0,
      });
    }
    const entry = domainMap.get(domain);
    entry.fromAddresses.add(email);
    if (msg.subject) entry.subjects.push(msg.subject);
    entry.count++;
  }

  // Classify each domain
  const uncoveredSenders = [];
  const coveredSenders = [];
  let coveredCount = 0;

  for (const [domain, data] of domainMap) {
    const fromAddresses = [...data.fromAddresses];
    // Check if ANY address from this domain is covered
    let matchedPattern = null;
    for (const addr of fromAddresses) {
      matchedPattern = isCovered(addr, domain, patterns);
      if (matchedPattern) break;
    }

    if (matchedPattern) {
      coveredCount += data.count;
      coveredSenders.push({
        domain,
        messageCount: data.count,
        matchedPatterns: [matchedPattern],
      });
    } else {
      const classification = classifySender({
        domain,
        fromAddresses,
        messageCount: data.count,
        subjects: data.subjects,
      });
      uncoveredSenders.push({
        domain,
        fromAddresses,
        messageCount: data.count,
        suggestedCategory: classification.suggestedCategory,
        suggestedPattern: domain,
        sampleSubjects: data.subjects.slice(0, 5),
        confidence: classification.confidence,
      });
    }
  }

  // Sort uncovered by message count descending (noisiest first)
  uncoveredSenders.sort((a, b) => b.messageCount - a.messageCount);

  const output = { coveredCount, uncoveredSenders };
  if (!args.uncoveredOnly) {
    output.coveredSenders = coveredSenders;
  }

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  return EXIT_OK;
}

module.exports = { EXIT_OK, EXIT_CONFIG, EXIT_GMAIL_API };

if (require.main === module) {
  process.exit(main());
}
```

- [ ] **Step 2: Run tests**

Run: `bun test tests/audit-trash-patterns.test.js`
Expected: ALL pass.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit_trash_patterns.js
git commit -m "feat: add audit_trash_patterns CLI for Gmail sender discovery (#93)"
```

---

## Task 12: Run the full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `bun test`
Expected: ALL tests pass across all test files.

- [ ] **Step 2: If any failures, diagnose and fix**

The most likely failure point is `expectedPatternCount` mismatches in the existing CLI integration tests (Task 3). If the full-suite run reveals failures not caught in Task 3, update the fixture counts and re-run.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test failures from full suite run (#93)"
```

(Skip this step if no fixes were needed.)

---

## Task 13: Final verification + summary commit

- [ ] **Step 1: Run full test suite one more time**

Run: `bun test`
Expected: ALL pass.

- [ ] **Step 2: Review the branch diff**

Run: `git log --oneline main..HEAD`
Verify commits are clean and tell a coherent story.

- [ ] **Step 3: Summary**

The branch should have:
- `deriveRelayVariants()` in `trash-tables.js` with full test coverage
- `appendToTrashTable()` config writer with tests
- `sender-classifier.js` heuristic module with tests
- `audit_trash_patterns.js` CLI with integration tests
- `gmail-search-stub.js` test fixture
- Fixed `inmail-hit-reply` → `hit-reply` in example config
- Updated CLI integration test counts for relay expansion
