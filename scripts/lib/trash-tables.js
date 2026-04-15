// scripts/lib/trash-tables.js
//
// Parser for the three "auto-trash" tables in config/search.md that
// scan-email Phase 6 Step 1 reads to build its sender-pattern list.
//
// Shared between scripts/auto_trash_inbox.js (the runtime CLI) and
// tests/auto-trash-tables.test.js (the schema contract test). A single
// parser means a schema regression blows up in tests before it can
// silently drop senders at runtime.
//
// Issue context:
//   - #86 / #87: LinkedIn job alerts were leaking because Phase 6 Step 2
//     (body-fetch trash-by-id) only caught body-fetched candidates. Fixed
//     by adding the "Job Alert Senders to Auto-Trash After Scan" table.
//   - #88: Ladders + Lensa + LinkedIn connection invites were accumulating
//     in the inbox because Phase 6 Step 1 was an LLM-driven "read these
//     markdown tables, concatenate, shell out" sequence that could be
//     silently skipped or mis-executed. Fixed by making this lib + the
//     auto_trash_inbox.js CLI the single deterministic path.

const TABLE_HEADINGS = [
  'Staffing/Aggregator Company Exclusions',
  'Marketing / Non-Job-Search Senders to Auto-Trash',
  'Job Alert Senders to Auto-Trash After Scan',
];

// Extract the "Trash Sender Substring" column (always the last cell of
// each data row) from the first markdown table that follows the given
// heading. Returns an array of substrings in document order.
function extractTableSubstrings(markdown, headingText) {
  const headingIdx = markdown.indexOf(`## ${headingText}`);
  if (headingIdx === -1) {
    throw new Error(`Heading not found: ## ${headingText}`);
  }
  const afterHeading = markdown.slice(headingIdx);
  const nextHeadingIdx = afterHeading.indexOf('\n## ', 1);
  const section =
    nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  const rows = section
    .split('\n')
    .filter((line) => line.trim().startsWith('|') && !line.includes('---'));
  // Drop the header row.
  const dataRows = rows.slice(1);
  return dataRows
    .map((row) => {
      const cells = row
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      return cells[cells.length - 1];
    })
    .filter((s) => s && s.length > 0);
}

// Extract all substrings from all three auto-trash tables, in table order.
// Throws if any heading is missing — this is a hard contract, not a warning,
// because Phase 6 Step 1 silently dropping a whole table is exactly the
// failure mode issue #88 was about.
function extractAllTrashSubstrings(markdown) {
  const result = [];
  for (const heading of TABLE_HEADINGS) {
    const substrings = extractTableSubstrings(markdown, heading);
    for (const s of substrings) {
      result.push(s);
    }
  }
  return result;
}

// Validate the no-comma invariant. apple_mail_trash_by_sender.applescript
// splits its input on commas, so a substring containing a literal comma
// would be silently split into two bogus patterns. Returns the offending
// substring or null if the list is clean.
function findSubstringWithComma(substrings) {
  for (const s of substrings) {
    if (s.includes(',')) return s;
  }
  return null;
}

module.exports = {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
};
