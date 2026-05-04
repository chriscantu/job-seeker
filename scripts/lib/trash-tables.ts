// scripts/lib/trash-tables.ts
//
// Parser for the three "auto-trash" tables in config/search.md that
// scan-email Phase 6 Step 1 reads to build its sender-pattern list.

import * as fs from 'fs';

export const TABLE_HEADINGS = [
  'Staffing/Aggregator Company Exclusions',
  'Marketing / Non-Job-Search Senders to Auto-Trash',
  'Job Alert Senders to Auto-Trash After Scan',
];

export interface TrashTableEntry {
  name: string;
  pattern: string;
}

// Extract the "Trash Sender Substring" column (always the last cell of
// each data row) from the first markdown table that follows the given
// heading. Returns an array of substrings in document order.
export function extractTableSubstrings(markdown: string, headingText: string): string[] {
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
    .filter((s): s is string => Boolean(s) && s.length > 0);
}

// Derive iCloud "Hide My Email" relay variants for sender patterns.
// iCloud rewrites `user@domain.com` to `user_at_domain_com_{random}@icloud.com`,
// turning every `.` into `_` and every `@` into `_at_`. A configured pattern
// like `topresume.com` won't match the relay address `topresume_com_xxx@icloud.com`
// unless we also search for `topresume_com`.
export function deriveRelayVariants(substrings: string[]): string[] {
  const variants: string[] = [];
  const seen = new Set(substrings);
  for (const s of substrings) {
    let variant: string | null = null;
    if (s.includes('@') && s.includes('.')) {
      variant = s.replace(/@/g, '_at_').replace(/\./g, '_');
    } else if (s.includes('.')) {
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
// Throws if any heading is missing OR if any named table has zero data rows.
export function extractAllTrashSubstrings(markdown: string): string[] {
  const result: string[] = [];
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
export function findSubstringWithComma(substrings: string[]): string | null {
  for (const s of substrings) {
    if (s.includes(',')) return s;
  }
  return null;
}

// Append new rows to a specific auto-trash table in search.md.
// WARNING: mutates the file at filePath in-place.
export function appendToTrashTable(filePath: string, headingText: string, entries: TrashTableEntry[]): void {
  if (!entries || entries.length === 0) return;
  for (const e of entries) {
    if (!e.name || !e.pattern) {
      throw new Error(
        `appendToTrashTable: entry missing name or pattern: ${JSON.stringify(e)}`
      );
    }
    if (e.pattern.includes(',')) {
      throw new Error(
        `appendToTrashTable: pattern "${e.pattern}" contains a comma — ` +
          `this would silently split into two bogus patterns in the trash script`
      );
    }
    if (e.pattern.includes('|')) {
      throw new Error(
        `appendToTrashTable: pattern "${e.pattern}" contains a pipe — ` +
          `this would corrupt the markdown table structure`
      );
    }
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const headingMarker = `## ${headingText}`;
  const headingIdx = content.indexOf(headingMarker);
  if (headingIdx === -1) {
    throw new Error(`Heading not found: ${headingMarker}`);
  }
  const afterHeading = content.slice(headingIdx);
  const nextHeadingMatch = afterHeading.match(/\n## (?!$)/m);
  const sectionEnd = nextHeadingMatch && nextHeadingMatch.index !== undefined
    ? headingIdx + nextHeadingMatch.index
    : content.length;

  // Find the last data row.
  const section = content.slice(headingIdx, sectionEnd);
  const lines = section.split('\n');
  let lastTableLineOffset = -1;
  let offset = headingIdx;
  let headerSkipped = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|') && !lines[i].includes('---')) {
      if (!headerSkipped) {
        headerSkipped = true;
      } else {
        lastTableLineOffset = offset + lines[i].length;
      }
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
