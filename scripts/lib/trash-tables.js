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

const fs = require('fs');

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

// Derive iCloud "Hide My Email" relay variants for sender patterns.
// iCloud rewrites `user@domain.com` to `user_at_domain_com_{random}@icloud.com`,
// turning every `.` into `_` and every `@` into `_at_`. A configured pattern
// like `topresume.com` won't match the relay address `topresume_com_xxx@icloud.com`
// unless we also search for `topresume_com`.
//
// Returns the input array followed by any new variants, deduplicated.
// Originals always appear before derived variants to preserve table order.
function deriveRelayVariants(substrings) {
  const variants = [];
  const seen = new Set(substrings);
  for (const s of substrings) {
    let variant = null;
    if (s.includes('@') && s.includes('.')) {
      // invitations@linkedin.com → invitations_at_linkedin_com
      variant = s.replace(/@/g, '_at_').replace(/\./g, '_');
    } else if (s.includes('.')) {
      // topresume.com → topresume_com
      variant = s.replace(/\./g, '_');
    }
    if (variant !== null && !seen.has(variant)) {
      variants.push(variant);
      seen.add(variant);
    }
  }
  return [...substrings, ...variants];
}

// Extract all substrings from all three auto-trash tables, in table order.
// Throws if any heading is missing OR if any named table has zero data rows
// — both are hard contracts, not warnings, because Phase 6 Step 1 silently
// dropping a whole table is exactly the failure mode issue #88 was about,
// and an emptied data section is issue #88 at the config layer (see #90
// finding 2).
function extractAllTrashSubstrings(markdown) {
  const result = [];
  for (const heading of TABLE_HEADINGS) {
    const substrings = extractTableSubstrings(markdown, heading);
    if (substrings.length === 0) {
      throw new Error(
        `Trash table "${heading}" has zero data rows. ` +
          `An empty table silently drops a whole category of senders ` +
          `from Phase 6 Step 1 — restore at least one row, or delete the ` +
          `heading entirely if you mean to remove the category.`
      );
    }
    for (const s of substrings) {
      result.push(s);
    }
  }
  return deriveRelayVariants(result);
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

// Append new rows to a specific auto-trash table in search.md.
// Each entry is { name: string, pattern: string }.
// Finds the table by heading, locates the last data row, and inserts
// new rows after it (before the next heading or EOF).
function appendToTrashTable(filePath, headingText, entries) {
  if (!entries || entries.length === 0) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const headingMarker = `## ${headingText}`;
  const headingIdx = content.indexOf(headingMarker);
  if (headingIdx === -1) {
    throw new Error(`Heading not found: ${headingMarker}`);
  }
  const afterHeading = content.slice(headingIdx);
  const nextHeadingMatch = afterHeading.match(/\n## (?!$)/m);
  const sectionEnd = nextHeadingMatch
    ? headingIdx + nextHeadingMatch.index
    : content.length;

  // Find the last table row (line starting with |) in this section
  const section = content.slice(headingIdx, sectionEnd);
  const lines = section.split('\n');
  let lastTableLineOffset = -1;
  let offset = headingIdx;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|') && !lines[i].includes('---')) {
      lastTableLineOffset = offset + lines[i].length;
    }
    offset += lines[i].length + 1; // +1 for \n
  }

  if (lastTableLineOffset === -1) {
    throw new Error(`No table rows found under ${headingMarker}`);
  }

  const newRows = entries
    .map((e) => `| ${e.name} | ${e.pattern} |`)
    .join('\n');

  const updated =
    content.slice(0, lastTableLineOffset) +
    '\n' +
    newRows +
    content.slice(lastTableLineOffset);

  fs.writeFileSync(filePath, updated);
}

module.exports = {
  TABLE_HEADINGS,
  extractTableSubstrings,
  extractAllTrashSubstrings,
  findSubstringWithComma,
  deriveRelayVariants,
  appendToTrashTable,
};
