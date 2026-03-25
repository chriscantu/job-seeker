#!/usr/bin/env node
// hooks/scripts/pii-guard.js
// PreToolUse hook — blocks Write/Edit calls that would put PII into committed files.
// Reads the tool call JSON from stdin. Exit 0 = allow, exit 2 = block.
// No external dependencies — stdlib only.

const ALLOWED_PATH_PATTERNS = [
  /\/output\//,           // gitignored — generated materials, expected to contain PII
  /\/references\//,       // gitignored — resume, writing samples, voice guide
  /\/config\/candidate\.md/, // gitignored — personal profile
  /\/config\/search\.md/,    // gitignored — search preferences
  /\/\.claude\//,         // gitignored — Claude session/memory data
  /^\/tmp\//,             // ephemeral
  /^\/private\/tmp\//,    // macOS /tmp symlink target
];

// Each pattern has a label for the warning message and a regex.
// Patterns are designed to minimize false positives:
//   - Phone: requires separator or space boundary, excludes port-like numbers
//   - Email: requires @ with valid domain structure
//   - SSN: requires dashes in XXX-XX-XXXX format specifically
//   - Address: requires house number + street type keyword
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
    // Matches: 123-45-6789 (strict format with dashes)
    // Requires word boundaries to avoid matching inside longer numbers
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
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
  } catch {
    // Can't parse input — fail open (allow the write)
    process.exit(0);
  }

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path || '';

  // No file path — allow
  if (!filePath) {
    process.exit(0);
  }

  // Allow writes to gitignored / ephemeral paths
  if (ALLOWED_PATH_PATTERNS.some((p) => p.test(filePath))) {
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
      `   File: ${filePath}\n` +
      `   This file is not gitignored. Move PII to output/ or references/ instead.\n`
    );
    process.exit(2);
  }

  // All checks passed
  process.exit(0);
}

main();
