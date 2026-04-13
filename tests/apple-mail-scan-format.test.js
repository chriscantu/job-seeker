"use strict";

// Contract test for the apple_mail_scan.applescript output format.
//
// AppleScript can't run in CI (macOS-only, requires real Mail.app), so this
// test pins the format that downstream skill logic depends on. If a future
// edit to apple_mail_scan.applescript drops, reorders, or renames the 5
// |||-delimited fields, this test will catch it.
//
// The 5th field (message_id) is load-bearing: scan-email Phase 6 trash
// passes it to apple_mail_trash.applescript --by-id. Without it, trash
// falls back to index-based lookup, which is the silent-wrong-message bug
// PR #56 fixes. So the format isn't decorative — it is the contract that
// makes the trash race fix possible.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const FIXTURE_PATH = path.resolve(__dirname, "fixtures/apple_mail_scan_sample.txt");

function parseScanLine(line) {
  const fields = line.split("|||");
  return {
    subject: fields[0],
    sender: fields[1],
    date: fields[2],
    index: fields[3],
    messageId: fields[4],
    fieldCount: fields.length,
  };
}

test("scan format: every record splits into exactly 5 |||-delimited fields", () => {
  const fixture = fs.readFileSync(FIXTURE_PATH, "utf8").trim();
  const lines = fixture.split("\n");
  assert.ok(lines.length >= 3, "fixture should contain multiple records");

  for (const line of lines) {
    const record = parseScanLine(line);
    assert.equal(
      record.fieldCount,
      5,
      `Expected 5 fields, got ${record.fieldCount} in line: ${line}`
    );
  }
});

test("scan format: index field is a positive integer", () => {
  const fixture = fs.readFileSync(FIXTURE_PATH, "utf8").trim();
  for (const line of fixture.split("\n")) {
    const { index } = parseScanLine(line);
    const n = Number(index);
    assert.ok(
      Number.isInteger(n) && n > 0,
      `Index must be a positive integer, got: ${index}`
    );
  }
});

test("scan format: message_id is non-empty (sentinel MSGID_UNAVAILABLE for unreadable)", () => {
  // Empty 5th field would mean a downstream --by-id "" call, which the trash
  // script must reject (PR #56 fix). The scan script must always emit either
  // a real Message-ID or the literal sentinel "MSGID_UNAVAILABLE".
  const fixture = fs.readFileSync(FIXTURE_PATH, "utf8").trim();
  for (const line of fixture.split("\n")) {
    const { messageId } = parseScanLine(line);
    assert.ok(
      messageId && messageId.length > 0,
      `message_id field must never be empty — use MSGID_UNAVAILABLE sentinel. Got empty in: ${line}`
    );
  }
});

test("scan format: unreadable rows preserve the diagnostic shape", () => {
  // Per the script header: unreadable messages emit
  //   "(unreadable: errMsg)|||unknown|||unknown|||{i}|||MSGID_UNAVAILABLE"
  // This contract lets downstream classifiers skip unreadable rows
  // gracefully without misinterpreting them as legitimate alerts.
  const fixture = fs.readFileSync(FIXTURE_PATH, "utf8").trim();
  const unreadable = fixture
    .split("\n")
    .filter((line) => line.startsWith("(unreadable:"));
  assert.ok(unreadable.length > 0, "fixture should include at least one unreadable row");

  for (const line of unreadable) {
    const record = parseScanLine(line);
    assert.equal(record.sender, "unknown", "unreadable row sender must be 'unknown'");
    assert.equal(record.date, "unknown", "unreadable row date must be 'unknown'");
    assert.equal(
      record.messageId,
      "MSGID_UNAVAILABLE",
      "unreadable row message_id must be MSGID_UNAVAILABLE"
    );
  }
});

test("scan format: regular records have non-unknown sender and date", () => {
  const fixture = fs.readFileSync(FIXTURE_PATH, "utf8").trim();
  const regular = fixture
    .split("\n")
    .filter((line) => !line.startsWith("(unreadable:"));
  assert.ok(regular.length >= 2, "fixture should include at least two regular records");

  for (const line of regular) {
    const { sender, date } = parseScanLine(line);
    assert.notEqual(sender, "unknown", `Regular record should have a real sender: ${line}`);
    assert.notEqual(date, "unknown", `Regular record should have a real date: ${line}`);
  }
});
