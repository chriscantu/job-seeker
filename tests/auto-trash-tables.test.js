"use strict";

// Contract test for the auto-trash tables in config/search.md.
//
// scan-email Phase 6 Step 1 reads sender substrings from three tables and
// concatenates them into a single trash-by-sender call. The tables are the
// only machine-readable surface for "who gets auto-trashed after a scan" —
// if the schema drifts, LinkedIn job alerts (and any other listed senders)
// silently start accumulating in the inbox.
//
// Issue #86: LinkedIn job alerts that hit pre-body-fetch filters (title
// classifier, already-seen dedup, age filter) were never trashed because
// Phase 6 Step 2 only trashes body-fetched candidates. The fix adds a third
// "Job Alert Senders to Auto-Trash After Scan" table so those senders get
// swept unconditionally in Phase 6 Step 1. This test pins that table's
// presence and required contents.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// config/search.md is gitignored (personal). The committed surface is
// config/search.md.example — it's what new users copy from and the only
// file CI can see. Test it instead.
const SEARCH_MD = path.resolve(__dirname, "..", "config", "search.md.example");

function extractTableSubstrings(markdown, headingText) {
  // Find the section heading, then the first markdown table after it.
  const headingIdx = markdown.indexOf(`## ${headingText}`);
  if (headingIdx === -1) {
    throw new Error(`Heading not found: ## ${headingText}`);
  }
  const afterHeading = markdown.slice(headingIdx);
  const nextHeadingIdx = afterHeading.indexOf("\n## ", 1);
  const section =
    nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  // Parse rows with `| ... | substring |` pattern. Skip the header and
  // the `|---|---|` separator.
  const rows = section
    .split("\n")
    .filter((line) => line.trim().startsWith("|") && !line.includes("---"));
  // Drop the header row (first remaining).
  const dataRows = rows.slice(1);
  return dataRows
    .map((row) => {
      const cells = row
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      // Substring is always the LAST cell in all three tables.
      return cells[cells.length - 1];
    })
    .filter((s) => s && s.length > 0);
}

test("auto-trash: all three trash tables are present in config/search.md", () => {
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  assert.ok(
    md.includes("## Staffing/Aggregator Company Exclusions"),
    "missing aggregator table"
  );
  assert.ok(
    md.includes("## Marketing / Non-Job-Search Senders to Auto-Trash"),
    "missing marketing table"
  );
  assert.ok(
    md.includes("## Job Alert Senders to Auto-Trash After Scan"),
    "missing job-alert auto-trash table (issue #86 regression)"
  );
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

test("auto-trash: no substring contains a comma (trash script splits on comma)", () => {
  // apple_mail_trash_by_sender.applescript splits its input on commas to
  // build the pattern list. A substring containing a literal comma would
  // be silently split into two bogus patterns. Pin this across all three
  // tables so a future edit can't regress it.
  const md = fs.readFileSync(SEARCH_MD, "utf8");
  const tables = [
    "Staffing/Aggregator Company Exclusions",
    "Marketing / Non-Job-Search Senders to Auto-Trash",
    "Job Alert Senders to Auto-Trash After Scan",
  ];
  for (const heading of tables) {
    const substrings = extractTableSubstrings(md, heading);
    assert.ok(substrings.length > 0, `${heading} has no substrings`);
    for (const s of substrings) {
      assert.ok(
        !s.includes(","),
        `substring "${s}" in "${heading}" contains a comma — would break trash-by-sender concat`
      );
    }
  }
});
