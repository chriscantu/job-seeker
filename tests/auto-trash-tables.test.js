"use strict";

// Contract test for the auto-trash tables in config/search.md.
//
// scan-email Phase 6 Step 1 reads sender substrings from three tables and
// concatenates them into a single trash-by-sender call. The tables are the
// only machine-readable surface for "who gets auto-trashed after a scan" —
// if the schema drifts, listed senders silently start accumulating in the
// inbox.
//
// Parser lives in scripts/lib/trash-tables.js and is shared with
// scripts/auto_trash_inbox.js so a schema regression blows up in tests
// before it can silently drop senders at runtime.
//
// Issue history:
//   #86 / #87 — LinkedIn job alerts leaked because the "Job Alert Senders
//               to Auto-Trash After Scan" table didn't exist yet.
//   #88       — Ladders + Lensa + LinkedIn connection invites accumulated
//               because Phase 6 Step 1 was LLM-driven and could be skipped.
//               Fix: the parser + auto_trash_inbox.js CLI replaced the
//               LLM text-processing step with a deterministic pipeline.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
} = require("../scripts/lib/trash-tables");

// config/search.md is gitignored (personal). The committed surface is
// config/search.md.example — it's what new users copy from and the only
// file CI can see. Test it instead.
const SEARCH_MD = path.resolve(__dirname, "..", "config", "search.md.example");

test("auto-trash: all three trash tables are present in config/search.md", () => {
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  for (const heading of TABLE_HEADINGS) {
    assert.ok(
      md.includes(`## ${heading}`),
      `missing trash table heading: ## ${heading}`
    );
  }
});

test("auto-trash: LinkedIn job alert senders are in the after-scan table", () => {
  // Regression test for issue #86. These three LinkedIn local-parts are the
  // observed job-alert senders from the 2026-04-14 cleanup. If any drops out
  // of the table, LinkedIn alerts start accumulating in the iCloud inbox
  // again whenever pre-body-fetch filters reject them.
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  const substrings = extractTableSubstrings(
    md,
    "Job Alert Senders to Auto-Trash After Scan"
  );
  const required = [
    "jobalerts-noreply@linkedin.com",
    "jobs-noreply@linkedin.com",
    "jobs-listings@linkedin.com",
  ];
  for (const needle of required) {
    assert.ok(
      substrings.includes(needle),
      `missing required sender substring "${needle}" — issue #86 regression`
    );
  }
});

test("auto-trash: Ladders senders are in the aggregator table", () => {
  // Regression test for issue #88. Observed Ladders From: header was
  // `Ladders <jobs@my.theladders.com>` — both `ladders.com` and
  // `theladders.com` match it via AppleScript's case-insensitive substring
  // query. The match is NOT the bug (that was confirmed empirically);
  // the bug was Phase 6 Step 1 not running deterministically. Pin both
  // substrings here so neither can silently drop out of the aggregator
  // table without a test failure.
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  const substrings = extractTableSubstrings(
    md,
    "Staffing/Aggregator Company Exclusions"
  );
  assert.ok(
    substrings.includes("ladders.com"),
    "missing `ladders.com` — issue #88 regression"
  );
});

test("auto-trash: no substring contains a comma (trash script splits on comma)", () => {
  // apple_mail_trash_by_sender.applescript splits its input on commas to
  // build the pattern list. A substring containing a literal comma would
  // be silently split into two bogus patterns. Pin this across all three
  // tables so a future edit can't regress it.
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  for (const heading of TABLE_HEADINGS) {
    const substrings = extractTableSubstrings(md, heading);
    assert.ok(substrings.length > 0, `${heading} has no substrings`);
    const offender = findSubstringWithComma(substrings);
    assert.equal(
      offender,
      null,
      `substring "${offender}" in "${heading}" contains a comma — would break trash-by-sender concat`
    );
  }
});

test("auto-trash: extractAllTrashSubstrings returns all three tables concatenated", () => {
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  const all = extractAllTrashSubstrings(md);
  // Must include representative substrings from each table to prove
  // nothing was silently skipped.
  assert.ok(all.includes("lensa.com"), "missing aggregator-table substring");
  assert.ok(all.includes("topresume.com"), "missing marketing-table substring");
  assert.ok(
    all.includes("jobalerts-noreply@linkedin.com"),
    "missing job-alert-table substring"
  );
  // Also prove the no-comma invariant holds on the concatenated list.
  assert.equal(findSubstringWithComma(all), null);
});
