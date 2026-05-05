"use strict";

// Integration tests for scripts/auto_trash_gmail.ts — the deterministic
// Phase 6 Step 1G Gmail-side sweep that mirrors auto_trash_inbox.ts.
//
// Tests exercise the full orchestrator pipeline: config reading, table
// extraction, no-comma validation, argv construction, subprocess
// shell-out, and exit code classification. Tests MUST NOT invoke the
// real Gmail API — CI has no credentials.
//
// The stub at tests/fixtures/gmail-stub.js stands in for scripts/gmail.ts
// via the JOB_SEEKER_GMAIL_BIN env override. It reads GMAIL_STUB_STDOUT /
// GMAIL_STUB_STDERR / GMAIL_STUB_EXIT and echoes them — enough to
// exercise every branch of classifyGmailResult.

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "..", "scripts", "auto_trash_gmail.ts");
const GMAIL_STUB = path.join(__dirname, "fixtures", "gmail-stub.js");
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
    timeout: 10000,
    env: {
      ...process.env,
      JOB_SEEKER_SEARCH_MD: searchMdPath,
      ...env,
    },
  });
}

function runExpectError(args = "", env = {}) {
  try {
    execSync(`bun ${CLI} ${args}`, {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        JOB_SEEKER_SEARCH_MD: searchMdPath,
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

function stubEnv({ stdout = "", stderr = "", exit = 0 } = {}) {
  // JOB_SEEKER_SKIP_CRED_CHECK is decoupled from JOB_SEEKER_GMAIL_BIN so
  // that a legitimate user binary override still validates credentials.
  // Tests opt out of the cred check explicitly.
  return {
    JOB_SEEKER_GMAIL_BIN: GMAIL_STUB,
    JOB_SEEKER_SKIP_CRED_CHECK: "1",
    GMAIL_STUB_STDOUT: stdout,
    GMAIL_STUB_STDERR: stderr,
    GMAIL_STUB_EXIT: String(exit),
  };
}

describe("auto_trash_gmail.js CLI", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-trash-gmail-test-"));
    searchMdPath = path.join(tmpDir, "search.md");
    fs.copyFileSync(EXAMPLE_SEARCH_MD, searchMdPath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--dry-run (no stub) prints plan summary and exits 0 without calling Gmail", () => {
    // Local dry-run path: no credential check, no subprocess.
    const out = run("--dry-run");
    assert.match(out, /pattern count:/);
    assert.match(out, /patterns:/);
    // Should include representative substrings from each of the three tables.
    assert.match(out, /lensa\.com/);
    assert.match(out, /topresume\.com/);
    assert.match(out, /jobalerts-noreply@linkedin\.com/);
  });

  it("exits EXIT_CONFIG (2) when search.md is missing", () => {
    fs.rmSync(searchMdPath);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.equal(exitCode, 2);
    assert.match(stderr, /search\.md/);
  });

  it("exits EXIT_COMMA (3) when a substring contains a comma", () => {
    const md = fs
      .readFileSync(EXAMPLE_SEARCH_MD, "utf8")
      .replace("| Lensa | lensa.com |", "| Lensa | lensa,com |");
    fs.writeFileSync(searchMdPath, md);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.equal(exitCode, 3);
    assert.match(stderr, /comma/i);
    assert.match(stderr, /lensa,com/);
  });

  it("exits EXIT_CONFIG (2) when a required trash-table has zero data rows", () => {
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
`;
    fs.writeFileSync(searchMdPath, md);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.equal(exitCode, 2);
    assert.match(stderr, /Job Alert Senders/);
  });

  it("exits EXIT_CONFIG (2) when a required trash-table heading is missing", () => {
    const md = fs
      .readFileSync(EXAMPLE_SEARCH_MD, "utf8")
      .replace(/## Job Alert Senders to Auto-Trash After Scan[\s\S]*$/, "");
    fs.writeFileSync(searchMdPath, md);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.equal(exitCode, 2);
    assert.match(stderr, /Job Alert Senders/);
  });

  it("exits EXIT_OK (0) when stub returns a clean success line", () => {
    // Stub must report exactly as many pattern entries as the orchestrator
    // ships, otherwise classifyGmailResult flags a count-mismatch anomaly
    // and returns EXIT_GMAIL_API.
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
| Glassdoor | glassdoor.com |
`;
    fs.writeFileSync(searchMdPath, md);
    const out = run(
      "",
      stubEnv({
        stdout: "trashed: lensa.com=2/2 topresume.com=0/0 glassdoor.com=3/3 lensa_com=0/0 topresume_com=0/0 glassdoor_com=0/0",
        exit: 0,
      })
    );
    assert.match(out, /trashed:/);
    assert.match(out, /lensa\.com=2\/2/);
    assert.match(out, /glassdoor\.com=3\/3/);
  });

  it("exits EXIT_GMAIL_API (4) when stub exits non-zero", () => {
    const { exitCode } = runExpectError(
      "",
      stubEnv({
        stdout: "",
        stderr: "GMAIL_ERROR: list failed",
        exit: 1,
      })
    );
    assert.equal(exitCode, 4);
  });

  it("exits EXIT_GMAIL_API (4) when stub prints AUTH_REQUIRED sentinel", () => {
    const { exitCode } = runExpectError(
      "",
      stubEnv({
        stdout: "AUTH_REQUIRED: token expired",
        exit: 1,
      })
    );
    assert.equal(exitCode, 4);
  });

  it("exits EXIT_PARTIAL (5) when gmail.js reports moved < matched (PR #92 review finding C2/M3)", () => {
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
| Glassdoor | glassdoor.com |
`;
    fs.writeFileSync(searchMdPath, md);
    // Production contract (fixed in PR #92 review round): gmail.js
    // trash-by-sender exits 0 on per-pattern partial failure and leaves
    // classification to the orchestrator's parser. Previously the child
    // exited 1, which forced classifyGmailResult into EXIT_GMAIL_API
    // before the partial-failure branch could run, making slot 5 dead.
    // This test pins the fix: stub exit 0 + partial stdout → EXIT_PARTIAL.
    const { exitCode, stdout } = runExpectError(
      "",
      stubEnv({
        stdout:
          "trashed: lensa.com=1/3 topresume.com=0/0 glassdoor.com=2/2 lensa_com=0/0 topresume_com=0/0 glassdoor_com=0/0 (errors: lensa.com=a:503|b:503)",
        exit: 0,
      })
    );
    assert.equal(exitCode, 5);
    assert.match(stdout, /lensa\.com=1\/3/);
  });

  it("exits EXIT_OK (0) when stub reports cap-hit suffix with full moved/matched (review finding C1)", () => {
    // Cap-hit is communicated via a `(cap-hit: ...)` stdout suffix, not
    // stderr. Before the fix, the cap warning went to stderr and
    // tripped the stderr-non-empty-with-status-0 rule, misclassifying
    // a successful capped run as EXIT_GMAIL_API.
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
| Glassdoor | glassdoor.com |
`;
    fs.writeFileSync(searchMdPath, md);
    const out = run(
      "",
      stubEnv({
        stdout:
          "trashed: lensa.com=500/500 topresume.com=0/0 glassdoor.com=3/3 lensa_com=0/0 topresume_com=0/0 glassdoor_com=0/0 (cap-hit: lensa.com=500)",
        exit: 0,
      })
    );
    assert.match(out, /cap-hit: lensa\.com=500/);
    assert.match(out, /lensa\.com=500\/500/);
  });

  it("ships both ladders.com and theladders.com when both are configured (issue #88 regression mirror)", () => {
    // Parity with tests/auto-trash-inbox-cli.test.js's ladders regression
    // case. The bug lived in extractAllTrashSubstrings (shared by both
    // CLIs), but pinning both sides guarantees a future divergence in
    // how auto_trash_gmail constructs `--sender` flags from the list
    // (e.g. accidental dedup, lowercasing, reordering) gets caught.
    const md = `## Staffing/Aggregator Company Exclusions

| Name | Trash Sender Substring |
|------|------------------------|
| Lensa | lensa.com |
| Ladders | ladders.com |
| TheLadders | theladders.com |

## Marketing / Non-Job-Search Senders to Auto-Trash

| Sender | Trash Sender Substring |
|--------|------------------------|
| TopResume | topresume.com |

## Job Alert Senders to Auto-Trash After Scan

| Sender | Trash Sender Substring |
|--------|------------------------|
| LinkedIn job alerts | jobalerts-noreply@linkedin.com |
`;
    fs.writeFileSync(searchMdPath, md);
    const out = run("--dry-run");
    assert.match(out, /ladders\.com/);
    assert.match(out, /theladders\.com/);
  });

  it("exits EXIT_CONFIG (2) when credentials are missing and no skip-flag is set", () => {
    // This is the first-time-user onboarding story: a fresh clone has
    // config/search.md but no credentials/gmail-tokens.json yet. The
    // orchestrator must fail loudly with a clear re-auth hint, not
    // silently skip or crash deeper in the subprocess.
    //
    // Deliberately does NOT set JOB_SEEKER_GMAIL_BIN or
    // JOB_SEEKER_SKIP_CRED_CHECK — this test exercises the real
    // credential-check path that the stub-based tests bypass.
    const emptyCredsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "auto-trash-gmail-empty-creds-")
    );
    try {
      const { exitCode, stderr } = runExpectError("", {
        JOB_SEEKER_GMAIL_CREDS: emptyCredsDir,
      });
      assert.equal(exitCode, 2);
      assert.match(stderr, /credentials missing/i);
      assert.match(stderr, /gmail\.ts auth/);
    } finally {
      fs.rmSync(emptyCredsDir, { recursive: true, force: true });
    }
  });

  it("JOB_SEEKER_GMAIL_BIN override alone does NOT bypass credential check", () => {
    // Decoupling regression test (review finding I3): setting
    // JOB_SEEKER_GMAIL_BIN to a user fork must NOT silently skip
    // credential validation. Only JOB_SEEKER_SKIP_CRED_CHECK opts out.
    const emptyCredsDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "auto-trash-gmail-empty-creds-")
    );
    try {
      const { exitCode, stderr } = runExpectError("", {
        JOB_SEEKER_GMAIL_BIN: GMAIL_STUB,
        JOB_SEEKER_GMAIL_CREDS: emptyCredsDir,
        // NOTE: no JOB_SEEKER_SKIP_CRED_CHECK
      });
      assert.equal(exitCode, 2);
      assert.match(stderr, /credentials missing/i);
    } finally {
      fs.rmSync(emptyCredsDir, { recursive: true, force: true });
    }
  });

  it("--dry-run shows the resolved newer-than from JOB_SEEKER_GMAIL_NEWER_THAN env", () => {
    const out = run("--dry-run", { JOB_SEEKER_GMAIL_NEWER_THAN: "7d" });
    assert.match(out, /newer-than:\s*7d/);
  });

  it("--dry-run shows the resolved newer-than from CLI flag (precedence over env)", () => {
    const out = run("--dry-run --newer-than 14d", {
      JOB_SEEKER_GMAIL_NEWER_THAN: "7d",
    });
    assert.match(out, /newer-than:\s*14d/);
  });

  it("exits non-zero when --newer-than is missing its value", () => {
    const { exitCode, stderr } = runExpectError("--newer-than --dry-run");
    assert.notEqual(exitCode, 0);
    assert.match(stderr, /--newer-than requires a value/);
  });

  it("exits EXIT_GMAIL_API (4) when stub reports count mismatch anomaly", () => {
    // Config has three patterns, stub reports only two — classifier must
    // flag anomaly and fail.
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
| Glassdoor | glassdoor.com |
`;
    fs.writeFileSync(searchMdPath, md);
    const { exitCode } = runExpectError(
      "",
      stubEnv({
        stdout: "trashed: lensa.com=1/1 topresume.com=0/0 lensa_com=0/0 topresume_com=0/0",
        exit: 0,
      })
    );
    assert.equal(exitCode, 4);
  });
});
