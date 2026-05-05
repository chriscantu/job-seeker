// Unit tests for scripts/lib/trash-output.ts — specifically the
// Gmail-side classifier classifyGmailResult. The Apple-Mail-side
// detectPartialFailure and classifyOsascriptResult already have
// coverage in tests/auto-trash-classify.test.js; that file imports
// them via the auto_trash_inbox.ts re-export, which exercises the
// relocation path.
//
// classifyGmailResult shares detectPartialFailure but has its own
// sentinel list (AUTH_REQUIRED, GMAIL_ERROR) and exit code slot (4,
// meaning "Gmail API error"). These tests pin each branch so a
// future refactor can't silently collapse them.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  classifyGmailResult,
  detectPartialFailure,
  EXIT_OK,
  EXIT_GMAIL_API,
  EXIT_PARTIAL,
} from "../scripts/lib/trash-output";

describe("classifyGmailResult", () => {
  it("returns EXIT_OK for clean success", () => {
    const exit = classifyGmailResult({
      stdout: "trashed: glassdoor.com=3/3 mail.remotehunter.com=2/2",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OK);
  });

  it("returns EXIT_OK on all-zero rows (nothing matched) with matching count", () => {
    const exit = classifyGmailResult({
      stdout: "trashed: glassdoor.com=0/0 mail.remotehunter.com=0/0",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_OK);
  });

  it("returns EXIT_GMAIL_API when child exit status is non-zero", () => {
    const exit = classifyGmailResult({
      stdout: "",
      stderr: "GMAIL_ERROR: list failed",
      status: 1,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });

  it("returns EXIT_GMAIL_API on AUTH_REQUIRED sentinel in stdout", () => {
    // gmail.js prints AUTH_REQUIRED on 401/403 before exiting 1. Even if a
    // future change made it exit 0 by mistake, the sentinel must still
    // force the classifier to slot 4.
    const exit = classifyGmailResult({
      stdout: "AUTH_REQUIRED: token expired",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });

  it("returns EXIT_GMAIL_API on GMAIL_ERROR sentinel in stdout", () => {
    const exit = classifyGmailResult({
      stdout: "GMAIL_ERROR: list failed for \"lensa.com\" [500] Internal error",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });

  it("returns EXIT_GMAIL_API when stdout starts with error:", () => {
    const exit = classifyGmailResult({
      stdout: "error: unexpected failure",
      stderr: "",
      status: 0,
      expectedPatternCount: 2,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });

  it("returns EXIT_GMAIL_API when stderr is non-empty with status 0 (parallels finding 3)", () => {
    // Same defensive rule as classifyOsascriptResult: stderr non-empty
    // with status 0 is a silent-failure vector. Gmail's googleapis client
    // can print deprecation warnings or refresh-token notices to stderr;
    // we fail loud rather than trusting stdout alone.
    const exit = classifyGmailResult({
      stdout: "trashed: glassdoor.com=3/3",
      stderr: "Warning: refresh token rotated mid-run",
      status: 0,
      expectedPatternCount: 1,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });

  it("returns EXIT_PARTIAL on partial failure (moved < matched)", () => {
    const exit = classifyGmailResult({
      stdout: "trashed: glassdoor.com=1/5 (errors: glassdoor.com=msgA:503|msgB:503)",
      stderr: "",
      status: 0,
      expectedPatternCount: 1,
    });
    assert.equal(exit, EXIT_PARTIAL);
  });

  it("returns EXIT_GMAIL_API on detectPartialFailure anomaly (zero entries)", () => {
    // "trashed:" prefix but garbage body — before hardening this fell
    // through to success.
    const exit = classifyGmailResult({
      stdout: "trashed: <garbage>",
      stderr: "",
      status: 0,
      expectedPatternCount: 3,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });

  it("returns EXIT_GMAIL_API on detectPartialFailure anomaly (count mismatch)", () => {
    // Expected 3 patterns, only 2 parsed. One was silently dropped
    // somewhere between auto_trash_gmail and gmail.js.
    const exit = classifyGmailResult({
      stdout: "trashed: glassdoor.com=1/1 mail.remotehunter.com=2/2",
      stderr: "",
      status: 0,
      expectedPatternCount: 3,
    });
    assert.equal(exit, EXIT_GMAIL_API);
  });
});

describe("detectPartialFailure (shared with Gmail path)", () => {
  // Gmail-specific smoke tests. Full Apple-Mail coverage lives in
  // tests/auto-trash-classify.test.js. The parser hardening at
  // scripts/lib/trash-output.js strips EVERY trailing parenthesized
  // suffix — not just `(errors: ...)` — so future suffixes like
  // `(cap-hit: ...)` can be added without parser changes.

  it("parses Gmail-style (errors: pat=id:code|id:code) suffix correctly", () => {
    const r = detectPartialFailure(
      "trashed: glassdoor.com=1/3 mail.remotehunter.com=2/2 (errors: glassdoor.com=abc:503|def:503)",
      2
    );
    assert.equal(r.isPartial, true);
    assert.equal(r.entryCount, 2);
    assert.equal(r.failures.length, 1);
    assert.equal(r.failures[0].pattern, "glassdoor.com");
    assert.equal(r.failures[0].moved, 1);
    assert.equal(r.failures[0].matched, 3);
    // The error-suffix tokens must NOT appear in failures.
    for (const f of r.failures) {
      assert.notEqual(f.pattern, "abc");
      assert.notEqual(f.pattern, "def");
    }
  });

  it("strips (cap-hit: ...) suffix so cap-hit tokens do not become phantom patterns", () => {
    // Review finding C1 root cause at the parser level. If the parser
    // didn't strip `(cap-hit: ...)`, the token `lensa.com=500` inside
    // the suffix wouldn't match `/=(\d+)\/(\d+)/` anyway (no slash),
    // but a future suffix format might — so strip defensively.
    const r = detectPartialFailure(
      "trashed: lensa.com=500/500 topresume.com=1/1 (cap-hit: lensa.com=500)",
      2
    );
    assert.equal(r.isPartial, false);
    assert.equal(r.entryCount, 2);
    assert.equal(r.isAnomaly, false);
  });

  it("strips chained (errors: ...) (cap-hit: ...) suffixes", () => {
    const r = detectPartialFailure(
      "trashed: lensa.com=499/500 topresume.com=1/1 (errors: lensa.com=a:500) (cap-hit: lensa.com=500)",
      2
    );
    assert.equal(r.isPartial, true);
    assert.equal(r.entryCount, 2);
    assert.equal(r.failures.length, 1);
    assert.equal(r.failures[0].pattern, "lensa.com");
  });
});
