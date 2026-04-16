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
  deriveRelayVariants,
  appendToTrashTable,
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

test("auto-trash: extractAllTrashSubstrings throws when any table has zero data rows (issue #90 finding 2)", () => {
  // Hostile fixture: all three headings present, all three header rows
  // present, but the Job Alert Senders table has NO data rows. Before
  // the finding-2 fix, extractAllTrashSubstrings silently returned the
  // concatenation of the first two tables and the CLI happily shipped
  // fewer patterns to osascript with EXIT_OK — re-creating issue #88
  // at the config layer.
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
  assert.throws(
    () => extractAllTrashSubstrings(md),
    /Job Alert Senders.*(empty|zero|no data)/i,
    "empty-table silent drop must throw ConfigError-equivalent"
  );
});

test("auto-trash: extractAllTrashSubstrings throws when the first table is empty (issue #90 finding 2)", () => {
  // Symmetry check — first table empty, other two populated. The error
  // must still fire; we should not rely on the last table being the
  // canary.
  const md = `## Staffing/Aggregator Company Exclusions

| Name | Trash Sender Substring |
|------|------------------------|

## Marketing / Non-Job-Search Senders to Auto-Trash

| Sender | Trash Sender Substring |
|--------|------------------------|
| TopResume | topresume.com |

## Job Alert Senders to Auto-Trash After Scan

| Sender | Trash Sender Substring |
|--------|------------------------|
| LinkedIn | jobalerts-noreply@linkedin.com |
`;
  assert.throws(
    () => extractAllTrashSubstrings(md),
    /Staffing.*Aggregator.*(empty|zero|no data)/i,
    "empty first table must throw"
  );
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

test("appendToTrashTable: throws on missing heading", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-missing-heading-")),
    "search.md"
  );
  fs.copyFileSync(SEARCH_MD, tmpFile);

  assert.throws(
    () =>
      appendToTrashTable(tmpFile, "Nonexistent Heading", [
        { name: "Test", pattern: "test.com" },
      ]),
    /Heading not found/,
    "missing heading must throw"
  );

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

test("appendToTrashTable: throws on heading with no data rows", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-no-rows-")),
    "search.md"
  );
  const md = `## Test Table

Some text but no table rows at all.

## Next Section
`;
  fs.writeFileSync(tmpFile, md);

  assert.throws(
    () =>
      appendToTrashTable(tmpFile, "Test Table", [
        { name: "Test", pattern: "test.com" },
      ]),
    /No table rows found/,
    "heading with no table rows must throw"
  );

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

test("appendToTrashTable: throws on pattern containing comma", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-comma-")),
    "search.md"
  );
  fs.copyFileSync(SEARCH_MD, tmpFile);

  assert.throws(
    () =>
      appendToTrashTable(tmpFile, "Job Alert Senders to Auto-Trash After Scan", [
        { name: "Bad", pattern: "lensa,com" },
      ]),
    /comma/,
    "pattern with comma must throw"
  );

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

test("appendToTrashTable: throws on pattern containing pipe", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-pipe-")),
    "search.md"
  );
  fs.copyFileSync(SEARCH_MD, tmpFile);

  assert.throws(
    () =>
      appendToTrashTable(tmpFile, "Job Alert Senders to Auto-Trash After Scan", [
        { name: "Bad", pattern: "lens|a.com" },
      ]),
    /pipe/,
    "pattern with pipe must throw"
  );

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});

test("appendToTrashTable: throws on entry missing pattern", () => {
  const tmpDir = require("os").tmpdir();
  const tmpFile = path.join(
    fs.mkdtempSync(path.join(tmpDir, "append-missing-")),
    "search.md"
  );
  fs.copyFileSync(SEARCH_MD, tmpFile);

  assert.throws(
    () =>
      appendToTrashTable(tmpFile, "Job Alert Senders to Auto-Trash After Scan", [
        { name: "Test" },
      ]),
    /missing name or pattern/,
    "entry without pattern must throw"
  );

  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
});
