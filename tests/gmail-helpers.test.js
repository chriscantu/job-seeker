"use strict";

// Unit tests for the pure helpers exported from scripts/gmail.js's
// trash-by-sender subcommand. CLI-level tests (tests/gmail-cli.test.js)
// cover arg-validation error paths; integration tests
// (tests/auto-trash-gmail-cli.test.js) exercise the full orchestrator
// pipeline via a stub. This file closes the gap the PR #92 review
// surfaced: formatTrashBySenderOutput, parseTrashBySenderArgs,
// listMatchingIds, processSender, and resolveMaxMatches were only
// transitively covered, so a regression in the formatter (which is
// regex-coupled to detectPartialFailure) or the per-message trash
// loop (which is load-bearing for partial-failure classification)
// could slip through.
//
// listMatchingIds and processSender take an injectable `gmail` client,
// so tests pass a tiny fake that produces canned responses without a
// real API call.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  encodeRfc822,
  parseTrashBySenderArgs,
  formatTrashBySenderOutput,
  listMatchingIds,
  processSender,
  resolveMaxMatches,
  DEFAULT_MAX_MATCHES_PER_PATTERN,
} = require("../scripts/gmail.js");

describe("encodeRfc822", () => {
  it("includes To header when recipient is provided", () => {
    const raw = encodeRfc822("jane@acme.com", "Hello", "body text");
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    assert.ok(decoded.includes("To: jane@acme.com"), "expected To header");
    assert.ok(decoded.includes("Subject: Hello"), "expected Subject header");
    assert.ok(decoded.includes("body text"), "expected body");
  });

  it("omits To header when recipient is undefined", () => {
    const raw = encodeRfc822(undefined, "Draft", "draft body");
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    assert.ok(!decoded.includes("To:"), "expected no To header");
    assert.ok(decoded.includes("Subject: Draft"), "expected Subject header");
    assert.ok(decoded.includes("draft body"), "expected body");
  });

  it("omits To header when recipient is empty string", () => {
    const raw = encodeRfc822("", "Draft", "draft body");
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    assert.ok(!decoded.includes("To:"), "expected no To header");
  });
});

describe("parseTrashBySenderArgs", () => {
  it("collects multiple --sender flags in order", () => {
    const r = parseTrashBySenderArgs([
      "--sender",
      "lensa.com",
      "--sender",
      "ladders.com",
      "--sender",
      "topresume.com",
    ]);
    assert.deepEqual(r.senders, ["lensa.com", "ladders.com", "topresume.com"]);
  });

  it("defaults newerThan to 30d and dryRun to false", () => {
    const r = parseTrashBySenderArgs(["--sender", "lensa.com"]);
    assert.equal(r.newerThan, "30d");
    assert.equal(r.dryRun, false);
  });

  it("accepts --newer-than with a value", () => {
    const r = parseTrashBySenderArgs([
      "--sender",
      "lensa.com",
      "--newer-than",
      "7d",
    ]);
    assert.equal(r.newerThan, "7d");
  });

  it("accepts --dry-run", () => {
    const r = parseTrashBySenderArgs([
      "--sender",
      "lensa.com",
      "--dry-run",
    ]);
    assert.equal(r.dryRun, true);
  });

  it("accepts --sender=VALUE form (lets substrings starting with '--' be expressed)", () => {
    // The space form rejects `--`-prefixed values as a typo guard.
    // The `=` form is the escape hatch for the (rare) legitimate case
    // of a sender substring that happens to start with `--`.
    const r = parseTrashBySenderArgs([
      "--sender=--weird-sender",
      "--sender",
      "lensa.com",
    ]);
    assert.deepEqual(r.senders, ["--weird-sender", "lensa.com"]);
  });

  it("accepts --newer-than=VALUE form", () => {
    const r = parseTrashBySenderArgs([
      "--sender",
      "lensa.com",
      "--newer-than=1y",
    ]);
    assert.equal(r.newerThan, "1y");
  });

  it("throws when --sender is followed by another flag (typo guard)", () => {
    assert.throws(
      () => parseTrashBySenderArgs(["--sender", "--dry-run"]),
      /--sender requires a value/
    );
  });

  it("throws when --newer-than is followed by another flag", () => {
    assert.throws(
      () =>
        parseTrashBySenderArgs([
          "--sender",
          "lensa.com",
          "--newer-than",
          "--dry-run",
        ]),
      /--newer-than requires a value/
    );
  });

  it("throws on unknown flags", () => {
    assert.throws(
      () =>
        parseTrashBySenderArgs([
          "--sender",
          "lensa.com",
          "--frobnicate",
        ]),
      /unknown flag: --frobnicate/
    );
  });

  it("returns empty senders array when none provided (caller's responsibility to reject)", () => {
    const r = parseTrashBySenderArgs([]);
    assert.deepEqual(r.senders, []);
  });
});

describe("formatTrashBySenderOutput", () => {
  it("formats a clean full-match run", () => {
    const out = formatTrashBySenderOutput([
      { pattern: "lensa.com", moved: 3, matched: 3, errors: [], capHit: false },
      {
        pattern: "ladders.com",
        moved: 2,
        matched: 2,
        errors: [],
        capHit: false,
      },
    ]);
    assert.equal(out, "trashed: lensa.com=3/3 ladders.com=2/2");
  });

  it("preserves 0/0 rows so typos surface in the summary", () => {
    const out = formatTrashBySenderOutput([
      { pattern: "typo.com", moved: 0, matched: 0, errors: [], capHit: false },
      { pattern: "lensa.com", moved: 1, matched: 1, errors: [], capHit: false },
    ]);
    assert.match(out, /typo\.com=0\/0/);
  });

  it("appends (errors: ...) suffix when per-pattern errors are present", () => {
    const out = formatTrashBySenderOutput([
      {
        pattern: "lensa.com",
        moved: 1,
        matched: 3,
        errors: ["a:503", "b:503"],
        capHit: false,
      },
    ]);
    assert.match(out, /trashed: lensa\.com=1\/3 \(errors: lensa\.com=a:503\|b:503\)/);
  });

  it("appends (cap-hit: ...) suffix on stdout, never stderr (review finding C1)", () => {
    // Cap-hit is communicated in the summary line so that the
    // Phase 6 orchestrator does NOT misclassify a capped-but-successful
    // run via the stderr-non-empty-with-status-0 rule.
    const out = formatTrashBySenderOutput([
      {
        pattern: "lensa.com",
        moved: 500,
        matched: 500,
        errors: [],
        capHit: true,
      },
    ]);
    assert.match(out, /\(cap-hit: lensa\.com=500\)/);
    assert.ok(!out.includes("(errors:"), "no errors suffix expected");
  });

  it("chains (errors: ...) and (cap-hit: ...) suffixes in that order", () => {
    const out = formatTrashBySenderOutput([
      {
        pattern: "lensa.com",
        moved: 499,
        matched: 500,
        errors: ["x:500"],
        capHit: true,
      },
      { pattern: "topresume.com", moved: 1, matched: 1, errors: [], capHit: false },
    ]);
    const errIdx = out.indexOf("(errors:");
    const capIdx = out.indexOf("(cap-hit:");
    assert.ok(errIdx > 0, "expected errors suffix");
    assert.ok(capIdx > errIdx, "cap-hit suffix must follow errors suffix");
  });
});

describe("resolveMaxMatches", () => {
  it("returns the default when env var is unset", () => {
    assert.equal(resolveMaxMatches({}), DEFAULT_MAX_MATCHES_PER_PATTERN);
  });

  it("returns the parsed env value when valid", () => {
    assert.equal(
      resolveMaxMatches({ JOB_SEEKER_GMAIL_TRASH_MAX: "1000" }),
      1000
    );
  });

  it("throws on non-numeric env value", () => {
    assert.throws(
      () => resolveMaxMatches({ JOB_SEEKER_GMAIL_TRASH_MAX: "lots" }),
      /positive integer/
    );
  });

  it("throws on zero or negative env value", () => {
    assert.throws(
      () => resolveMaxMatches({ JOB_SEEKER_GMAIL_TRASH_MAX: "0" }),
      /positive integer/
    );
    assert.throws(
      () => resolveMaxMatches({ JOB_SEEKER_GMAIL_TRASH_MAX: "-5" }),
      /positive integer/
    );
  });
});

// ---- fake gmail client for listMatchingIds / processSender ----

function makeFakeGmail({ pages = [], trashBehavior = {} } = {}) {
  // pages: array of page responses the fake returns in order, each
  // shaped like `{messages: [{id}], nextPageToken?}`.
  // trashBehavior: {[id]: 'ok' | {throw: {code}}}
  let pageIdx = 0;
  const trashedIds = [];
  return {
    users: {
      messages: {
        list: async () => {
          const page = pages[pageIdx] || { messages: [] };
          pageIdx++;
          return { data: page };
        },
        trash: async ({ id }) => {
          const b = trashBehavior[id] || "ok";
          if (b === "ok") {
            trashedIds.push(id);
            return {};
          }
          const err = new Error(b.message || "fake error");
          err.code = b.throw?.code;
          throw err;
        },
      },
    },
    _trashedIds: () => trashedIds,
  };
}

describe("listMatchingIds", () => {
  it("returns ids and capHit=false when under the cap", () => {
    return (async () => {
      const gmail = makeFakeGmail({
        pages: [{ messages: [{ id: "a" }, { id: "b" }] }],
      });
      const r = await listMatchingIds(gmail, "lensa.com", "30d", 500);
      assert.deepEqual(r.ids, ["a", "b"]);
      assert.equal(r.capHit, false);
    })();
  });

  it("pages through nextPageToken until no more pages", () => {
    return (async () => {
      const gmail = makeFakeGmail({
        pages: [
          { messages: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" },
          { messages: [{ id: "c" }] },
        ],
      });
      const r = await listMatchingIds(gmail, "lensa.com", "30d", 500);
      assert.deepEqual(r.ids, ["a", "b", "c"]);
      assert.equal(r.capHit, false);
    })();
  });

  it("truncates at maxMatches and returns capHit=true", () => {
    return (async () => {
      // Simulate a huge result: 3 pages of 100 ids each, cap at 150.
      const pages = [];
      for (let p = 0; p < 3; p++) {
        const msgs = [];
        for (let i = 0; i < 100; i++) msgs.push({ id: `p${p}_i${i}` });
        pages.push({
          messages: msgs,
          nextPageToken: p < 2 ? `p${p + 1}` : undefined,
        });
      }
      const gmail = makeFakeGmail({ pages });
      const r = await listMatchingIds(gmail, "lensa.com", "30d", 150);
      assert.equal(r.ids.length, 150);
      assert.equal(r.capHit, true);
    })();
  });

  it("handles an empty result set cleanly", () => {
    return (async () => {
      const gmail = makeFakeGmail({ pages: [{ messages: [] }] });
      const r = await listMatchingIds(gmail, "never-matches.com", "30d", 500);
      assert.deepEqual(r.ids, []);
      assert.equal(r.capHit, false);
    })();
  });
});

describe("processSender", () => {
  it("returns moved=matched on a clean run and trashes all ids", () => {
    return (async () => {
      const gmail = makeFakeGmail({
        pages: [{ messages: [{ id: "a" }, { id: "b" }, { id: "c" }] }],
      });
      const r = await processSender(gmail, "lensa.com", {
        newerThan: "30d",
        maxMatches: 500,
        dryRun: false,
      });
      assert.equal(r.moved, 3);
      assert.equal(r.matched, 3);
      assert.deepEqual(r.errors, []);
      assert.equal(r.capHit, false);
      assert.deepEqual(gmail._trashedIds(), ["a", "b", "c"]);
    })();
  });

  it("records per-message non-auth errors without aborting the pattern", () => {
    return (async () => {
      const gmail = makeFakeGmail({
        pages: [{ messages: [{ id: "a" }, { id: "b" }, { id: "c" }] }],
        trashBehavior: {
          b: { throw: { code: 503 }, message: "service unavailable" },
        },
      });
      const r = await processSender(gmail, "lensa.com", {
        newerThan: "30d",
        maxMatches: 500,
        dryRun: false,
      });
      assert.equal(r.moved, 2);
      assert.equal(r.matched, 3);
      assert.equal(r.errors.length, 1);
      assert.match(r.errors[0], /b:503/);
      // a and c still trashed, just not b.
      assert.deepEqual(gmail._trashedIds(), ["a", "c"]);
    })();
  });

  it("propagates auth errors (401/403) so the caller can stop the run", () => {
    return (async () => {
      const gmail = makeFakeGmail({
        pages: [{ messages: [{ id: "a" }, { id: "b" }] }],
        trashBehavior: {
          b: { throw: { code: 401 }, message: "token expired" },
        },
      });
      await assert.rejects(
        processSender(gmail, "lensa.com", {
          newerThan: "30d",
          maxMatches: 500,
          dryRun: false,
        }),
        (err) => err.code === 401
      );
    })();
  });

  it("dry-run returns ids without trashing anything", () => {
    return (async () => {
      const gmail = makeFakeGmail({
        pages: [{ messages: [{ id: "a" }, { id: "b" }] }],
      });
      const r = await processSender(gmail, "lensa.com", {
        newerThan: "30d",
        maxMatches: 500,
        dryRun: true,
      });
      assert.equal(r.moved, 2);
      assert.equal(r.matched, 2);
      assert.deepEqual(r.ids, ["a", "b"]);
      assert.deepEqual(gmail._trashedIds(), []);
    })();
  });

  it("sets capHit=true when the cap is hit", () => {
    return (async () => {
      const msgs = [];
      for (let i = 0; i < 100; i++) msgs.push({ id: `id${i}` });
      const gmail = makeFakeGmail({
        pages: [
          { messages: msgs, nextPageToken: "p2" },
          { messages: msgs },
        ],
      });
      const r = await processSender(gmail, "lensa.com", {
        newerThan: "30d",
        maxMatches: 150,
        dryRun: true,
      });
      assert.equal(r.capHit, true);
      assert.equal(r.matched, 150);
    })();
  });
});
