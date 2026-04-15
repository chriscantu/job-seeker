"use strict";

// Unit tests for detectPartialFailure + classifyOsascriptResult,
// extracted pure functions from scripts/auto_trash_inbox.js.
//
// Issue #90 findings 1 and 3: before these fixes, partial-failure detection
// and osascript result classification were buried inside main() and
// untested. Four silent-failure paths were documented in the issue:
//   - Finding 1: detectPartialFailure regex can match error-suffix tokens
//     as phantom pattern entries; empty body falls through to success;
//     function was unexported.
//   - Finding 3: stderr non-empty with status 0 was treated as success.
//
// These tests pin the contract on both functions.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  detectPartialFailure,
  classifyOsascriptResult,
  EXIT_OK,
  EXIT_OSASCRIPT,
  EXIT_PARTIAL,
} = require("../scripts/auto_trash_inbox.js");

describe("detectPartialFailure", () => {
  it("returns not-partial for a clean full-match line", () => {
    const r = detectPartialFailure("trashed: lensa.com=3/3 ladders.com=2/2", 2);
    assert.equal(r.isPartial, false);
    assert.deepEqual(r.failures, []);
    assert.equal(r.isAnomaly, false);
  });

  it("detects a partial failure when moved < matched", () => {
    const r = detectPartialFailure("trashed: lensa.com=3/3 ladders.com=1/5", 2);
    assert.equal(r.isPartial, true);
    assert.equal(r.failures.length, 1);
    assert.equal(r.failures[0].pattern, "ladders.com");
    assert.equal(r.failures[0].moved, 1);
    assert.equal(r.failures[0].matched, 5);
  });

  it("handles 0/0 entries (pattern matched nothing) as clean", () => {
    const r = detectPartialFailure("trashed: lensa.com=0/0", 1);
    assert.equal(r.isPartial, false);
    assert.deepEqual(r.failures, []);
  });

  it("treats empty stdout as not-partial and not an anomaly", () => {
    // Empty stdout shouldn't claim partial failure — but the CALLER is
    // responsible for refusing to count empty as success. detectPartialFailure
    // itself just returns false.
    const r = detectPartialFailure("", 0);
    assert.equal(r.isPartial, false);
    assert.deepEqual(r.failures, []);
  });

  it("treats non-trashed: prefix as not-partial", () => {
    const r = detectPartialFailure("error: MAILBOX_NOT_FOUND", 1);
    assert.equal(r.isPartial, false);
    assert.deepEqual(r.failures, []);
  });

  it("does not false-positive error-suffix tokens as phantom pattern entries", () => {
    // `bar=1/2` appears inside `(errors: ...)` but is NOT a real pattern
    // entry — it's Mail's error metadata for the `foo=2/5` pattern. The
    // hardened regex must stop at `(errors:` and must not produce
    // `{pattern: 'bar', moved: 1, matched: 2}`.
    const r = detectPartialFailure(
      "trashed: foo=2/5 (errors: bar=1/2 baz)",
      1
    );
    assert.equal(r.isPartial, true);
    assert.equal(r.failures.length, 1);
    assert.equal(r.failures[0].pattern, "foo");
    assert.equal(r.failures[0].moved, 2);
    assert.equal(r.failures[0].matched, 5);
    // The phantom `bar=1/2` must not appear in failures.
    for (const f of r.failures) {
      assert.notEqual(f.pattern, "bar");
    }
  });

  it("flags an anomaly when stdout starts with trashed: but parses zero entries", () => {
    // Malformed AppleScript output: "trashed:" prefix with garbage body.
    // Before finding-1 fix, this fell through to isPartial=false and the
    // caller returned EXIT_OK — a silent success.
    const r = detectPartialFailure("trashed: <garbage body>", 3);
    assert.equal(r.isAnomaly, true);
    assert.match(r.anomalyReason, /zero entries|parsed/i);
  });

  it("flags an anomaly when parsed entry count ≠ expected pattern count", () => {
    // Expected 3 patterns, only 2 showed up in the output — the third was
    // silently dropped somewhere. Before finding-1 fix, this went undetected.
    const r = detectPartialFailure(
      "trashed: lensa.com=1/1 ladders.com=2/2",
      3
    );
    assert.equal(r.isAnomaly, true);
    assert.match(r.anomalyReason, /expected 3.*got 2|count mismatch/i);
  });
});

describe("classifyOsascriptResult", () => {
  it("returns EXIT_OK for clean success", () => {
    const exit = classifyOsascriptResult({
      stdout: "trashed: lensa.com=3/3 ladders.com=2/2",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OK);
  });

  it("returns EXIT_OSASCRIPT when status is non-zero", () => {
    const exit = classifyOsascriptResult({
      stdout: "",
      stderr: "some error",
      status: 1,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });

  it("returns EXIT_OSASCRIPT on ACCOUNT_NOT_FOUND sentinel", () => {
    const exit = classifyOsascriptResult({
      stdout: "ACCOUNT_NOT_FOUND: iCloud",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });

  it("returns EXIT_OSASCRIPT on MAILBOX_NOT_FOUND sentinel", () => {
    const exit = classifyOsascriptResult({
      stdout: "MAILBOX_NOT_FOUND: INBOX",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });

  it("returns EXIT_OSASCRIPT on TRASH_NOT_FOUND sentinel", () => {
    const exit = classifyOsascriptResult({
      stdout: "TRASH_NOT_FOUND",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });

  it("returns EXIT_OSASCRIPT when stdout starts with error:", () => {
    const exit = classifyOsascriptResult({
      stdout: "error: some unexpected failure",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });

  it("returns EXIT_OSASCRIPT when stderr is non-empty with status 0 (issue #90 finding 3)", () => {
    // osascript exited 0 but wrote to stderr. Could be an AppleEvent
    // timeout warning, a System Events permission prompt, or any number
    // of "soft" issues. Treating this as success is how silent failures
    // creep back in.
    const exit = classifyOsascriptResult({
      stdout: "trashed: lensa.com=3/3",
      stderr: "System Events got an error: AppleEvent timed out.",
      status: 0,
      expectedPatternCount: 1,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });

  it("returns EXIT_PARTIAL on partial failure (moved < matched)", () => {
    const exit = classifyOsascriptResult({
      stdout: "trashed: lensa.com=1/5",
      stderr: "",
      status: 0,
      expectedPatternCount: 1,
    });
    assert.equal(exit, EXIT_PARTIAL);
  });

  it("returns EXIT_OSASCRIPT on detectPartialFailure anomaly", () => {
    // "trashed:" prefix but zero parsed entries — before finding-1 this
    // returned EXIT_OK.
    const exit = classifyOsascriptResult({
      stdout: "trashed: <garbage>",
      stderr: "",
      status: 0,
      expectedPatternCount: 3,
    });
    assert.equal(exit, EXIT_OSASCRIPT);
  });
});
