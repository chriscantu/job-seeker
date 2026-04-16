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
