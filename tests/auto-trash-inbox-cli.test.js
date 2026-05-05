"use strict";

// CLI tests for scripts/auto_trash_inbox.ts — the deterministic replacement
// for the LLM-driven Phase 6 Step 1 of scan-email.
//
// Tests exercise the full pipeline up to (but not including) the osascript
// shell-out: config reading, table extraction, no-comma validation, argv
// construction. Tests MUST NOT invoke osascript — CI has no Apple Mail.
// `--dry-run` prints what would have been sent and exits 0 without calling
// osascript.
//
// Issue #88: the CLI exists specifically to replace an unreliable
// LLM-driven step. Tests pin the contract so it cannot silently regress.

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "..", "scripts", "auto_trash_inbox.ts");
const EXAMPLE_SEARCH_MD = path.resolve(
  __dirname,
  "..",
  "config",
  "search.md.example"
);

let tmpDir;
let searchMdPath;
let mailConfigPath;

function writeMailConfig(account, inbox) {
  const content = `# Apple Mail Configuration

## Settings

account_name: ${account}
inbox_name: ${inbox}
`;
  fs.writeFileSync(mailConfigPath, content);
}

function run(args = "", env = {}) {
  return execSync(`bun ${CLI} ${args}`, {
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      JOB_SEEKER_SEARCH_MD: searchMdPath,
      JOB_SEEKER_MAIL_CONFIG: mailConfigPath,
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
        JOB_SEEKER_MAIL_CONFIG: mailConfigPath,
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

describe("auto_trash_inbox.js CLI", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-trash-test-"));
    searchMdPath = path.join(tmpDir, "search.md");
    mailConfigPath = path.join(tmpDir, "mail-config.md");
    // Default setup: copy the committed example config and write a
    // plausible mail config. Individual tests override as needed.
    fs.copyFileSync(EXAMPLE_SEARCH_MD, searchMdPath);
    writeMailConfig("iCloud", "INBOX");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--dry-run prints the concatenated pattern list and exits 0", () => {
    const out = run("--dry-run");
    // Must include the account + inbox that will be passed to osascript.
    assert.match(out, /account:\s*iCloud/);
    assert.match(out, /inbox:\s*INBOX/);
    // Must include the full concatenated comma-separated pattern list.
    assert.match(out, /patterns:\s*[^\n]+/);
    // Must include representative substrings from each of the three tables.
    assert.match(out, /lensa\.com/);
    assert.match(out, /ladders\.com/);
    assert.match(out, /topresume\.com/);
    assert.match(out, /jobalerts-noreply@linkedin\.com/);
  });

  it("--dry-run includes both Ladders substrings when present in config (issue #88 regression)", () => {
    // Use a search.md that pins both ladders entries (the user's real
    // personal config has both; the example has only `ladders.com`).
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

  it("--dry-run concatenated list has no internal commas beyond table separators", () => {
    const out = run("--dry-run");
    const match = out.match(/patterns:\s*([^\n]+)/);
    assert.ok(match, "no patterns line in output");
    const patterns = match[1].split(",");
    // Every pattern must be non-empty and free of whitespace.
    for (const p of patterns) {
      assert.ok(p.length > 0, `empty pattern in list: ${match[1]}`);
      assert.equal(p.trim(), p, `whitespace in pattern: "${p}"`);
    }
  });

  it("exits non-zero with clear error when search.md is missing", () => {
    fs.rmSync(searchMdPath);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.notEqual(exitCode, 0);
    assert.match(stderr, /search\.md/);
  });

  it("exits non-zero with clear error when mail-config.md is missing", () => {
    fs.rmSync(mailConfigPath);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.notEqual(exitCode, 0);
    assert.match(stderr, /mail-config/);
  });

  it("exits non-zero when a substring contains a comma (invariant violated)", () => {
    // Inject a comma into the aggregator table. The CLI must refuse to
    // shell out, because apple_mail_trash_by_sender.applescript splits on
    // commas and would turn the comma-containing substring into two bogus
    // patterns.
    const md = fs.readFileSync(EXAMPLE_SEARCH_MD, "utf8").replace(
      "| Lensa | lensa.com |",
      "| Lensa | lensa,com |"
    );
    fs.writeFileSync(searchMdPath, md);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.notEqual(exitCode, 0);
    assert.match(stderr, /comma/i);
    assert.match(stderr, /lensa,com/);
  });

  it("exits EXIT_CONFIG when a required trash-table has zero data rows (issue #90 finding 2)", () => {
    // Hostile fixture: all three headings present but the Job Alert
    // Senders table is emptied. Before the finding-2 fix, the CLI would
    // silently ship fewer patterns to osascript and exit 0 — a whole
    // category of senders stops being trashed without any error.
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
    assert.equal(exitCode, 2, "empty table must exit EXIT_CONFIG (2)");
    assert.match(stderr, /Job Alert Senders/);
  });

  it("exits non-zero when a required trash-table heading is missing", () => {
    // Strip the job-alert table entirely — if scan-email silently tolerated
    // this, issue #86 would come right back.
    const md = fs
      .readFileSync(EXAMPLE_SEARCH_MD, "utf8")
      .replace(
        /## Job Alert Senders to Auto-Trash After Scan[\s\S]*$/,
        ""
      );
    fs.writeFileSync(searchMdPath, md);
    const { exitCode, stderr } = runExpectError("--dry-run");
    assert.notEqual(exitCode, 0);
    assert.match(stderr, /Job Alert Senders/);
  });
});
