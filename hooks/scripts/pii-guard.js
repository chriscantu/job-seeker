#!/usr/bin/env node
// hooks/scripts/pii-guard.js
// PreToolUse hook — blocks Write/Edit calls that would put PII into committed files.
// Reads the tool call JSON from stdin. Exit 0 = allow, exit 2 = block.
// Fails CLOSED — if input is unparseable, the write is blocked as a precaution.
// No external dependencies — stdlib only. Requires Node >= 10 (async iteration on stdin).

const path = require('path');

// Paths where PII is expected and allowed. These are either gitignored
// (output/, references/, config personal files, .claude/) or ephemeral (/tmp/).
// Checked against the resolved (normalized) file path to prevent traversal bypass.
const ALLOWED_PATH_PATTERNS = [
  /\/output\//,              // gitignored — generated materials, expected to contain PII
  /\/references\//,          // gitignored — resume, writing samples, voice guide
  /\/config\/candidate\.md/, // gitignored — personal profile
  /\/config\/search\.md/,    // gitignored — search preferences
  /\/\.claude\//,            // gitignored — Claude session/memory data
  /^\/tmp\//,                // ephemeral — system temp
  /^\/private\/tmp\//,       // macOS /tmp symlink target
];

// Each pattern has a label for the warning message and a regex.
// Patterns are designed to minimize false positives:
//   - Phone: requires separator and valid area code prefix, excludes port-like numbers
//   - Email: requires @ with known personal email domain
//   - SSN: requires dashes, constrained to valid SSA ranges (not 000, 666, 9xx)
//   - Address: requires house number + recognized street type keyword
//
// Known limitations (acceptable trade-offs for a pre-commit guard):
//   - Phone: contiguous 10-digit numbers (5125551234) are not caught
//   - SSN: space-separated (078 05 1120) or no-separator formats not caught
//   - Address: PO Boxes and international formats not caught
const PII_PATTERNS = [
  {
    label: 'phone number',
    // Matches: 512-555-1234, (512) 555-1234, 512.555.1234, +1 512-555-1234
    // Avoids: port numbers (8080), version strings (1.2.3), dates
    pattern: /(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s][2-9]\d{2}[-.\s]\d{4}\b/,
  },
  {
    label: 'personal email address',
    // Matches: chris.cantu@icloud.com, user@gmail.com, etc.
    // Only flags common personal email domains — not work/generic domains
    pattern: /\b[\w.+-]+@(?:icloud|gmail|yahoo|hotmail|outlook|protonmail|me|mac|aol|live)\.com\b/i,
  },
  {
    label: 'SSN',
    // Matches: 123-45-6789 (strict dashed format with valid SSA ranges)
    // Area: 001-899 excluding 666. Group: 01-99. Serial: 0001-9999.
    // Avoids: 000-xx-xxxx, 666-xx-xxxx, 9xx-xx-xxxx, xxx-00-xxxx, xxx-xx-0000
    pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/,
  },
  {
    label: 'street address',
    // Matches: 123 Main St, 456 N Oak Avenue, 7890 SE Elm Blvd
    // Requires a house number followed by a recognized street type suffix
    pattern: /\b\d{1,6}\s+(?:N\.?|S\.?|E\.?|W\.?|North|South|East|West|NE|NW|SE|SW)?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Ln|Lane|Rd|Road|Ct|Court|Way|Pl(?:ace)?|Pkwy|Parkway|Cir(?:cle)?|Ter(?:race)?)\b/i,
  },
];

async function main() {
  // Read tool call JSON from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch (err) {
    // Fail CLOSED — if we can't parse the input, block the write as a precaution.
    // A false positive here is a 5-second annoyance. A false negative leaks PII
    // into git history and requires git filter-repo to fix.
    process.stderr.write(
      `⚠️  PII guard: could not parse tool input from stdin — blocking write as a precaution.\n` +
        `   Error: ${err.message}\n` +
        `   If this is a false alarm, move the file to output/ or references/.\n`
    );
    process.exit(2);
  }

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path || '';

  // No file path — allow (not a Write/Edit we can check)
  if (!filePath) {
    process.exit(0);
  }

  // Normalize the path to prevent traversal bypasses like output/../secret.md
  const normalizedPath = path.resolve(filePath);

  // Allow writes to allowlisted paths (gitignored or ephemeral)
  if (ALLOWED_PATH_PATTERNS.some((p) => p.test(normalizedPath))) {
    process.exit(0);
  }

  // Extract content: Write uses "content", Edit uses "new_string"
  const content = toolInput.content || toolInput.new_string || '';

  // No content to scan — allow
  if (!content) {
    process.exit(0);
  }

  // Scan for PII
  const violations = [];
  for (const { label, pattern } of PII_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(label);
    }
  }

  if (violations.length > 0) {
    const types = violations.join(', ');
    process.stderr.write(
      `⚠️  PII guard: content appears to contain ${types}.\n` +
        `   File: ${normalizedPath}\n` +
        `   This file is not allowlisted. Move PII to output/ or references/ instead.\n`
    );
    process.exit(2);
  }

  // All checks passed
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(
    `⚠️  PII guard: unexpected error — blocking write as a precaution.\n` +
      `   Error: ${err.message}\n`
  );
  process.exit(2);
});
