"use strict";

// Integration tests for scripts/auto_trash_gmail.js — the deterministic
// Phase 6 Step 1G Gmail-side sweep that mirrors auto_trash_inbox.js.
//
// Tests exercise the full orchestrator pipeline: config reading, table
// extraction, no-comma validation, argv construction, subprocess
// shell-out, and exit code classification. Tests MUST NOT invoke the
// real Gmail API — CI has no credentials.
//
// The stub at tests/fixtures/gmail-stub.js stands in for scripts/gmail.js
// via the JOB_SEEKER_GMAIL_BIN env override. It reads GMAIL_STUB_STDOUT /
// GMAIL_STUB_STDERR / GMAIL_STUB_EXIT and echoes them — enough to
// exercise every branch of classifyGmailResult.

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "..", "scripts", "auto_trash_gmail.js");
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
  return {
    JOB_SEEKER_GMAIL_BIN: GMAIL_STUB,
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
        stdout: "trashed: lensa.com=2/2 topresume.com=0/0 glassdoor.com=3/3",
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

  it("exits EXIT_PARTIAL (5) when stub reports moved < matched", () => {
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
    // gmail.js exits 1 on partial failure (moved < matched), and the
    // orchestrator should classify that as EXIT_GMAIL_API — NOT
    // EXIT_PARTIAL — because a non-zero child status takes precedence.
    // To exercise the EXIT_PARTIAL path specifically, the stub must
    // exit 0 with partial-failure stdout (simulates a future gmail.js
    // that prints partials but exits 0 for some reason). Classifier
    // slot 5 is still the correct answer from the parser.
    const { exitCode, stdout } = runExpectError(
      "",
      stubEnv({
        stdout:
          "trashed: lensa.com=1/3 topresume.com=0/0 glassdoor.com=2/2 (errors: lensa.com=a:503|b:503)",
        exit: 0,
      })
    );
    assert.equal(exitCode, 5);
    assert.match(stdout, /lensa\.com=1\/3/);
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
        stdout: "trashed: lensa.com=1/1 topresume.com=0/0",
        exit: 0,
      })
    );
    assert.equal(exitCode, 4);
  });
});
