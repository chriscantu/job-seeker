#!/usr/bin/env node
// scripts/test-pii-guard.js
// Automated tests for hooks/scripts/pii-guard.js
// Run: node scripts/test-pii-guard.js
// Exit 0 = all pass. Exit 1 = failures found.

const { execFileSync } = require('child_process');
const path = require('path');

const GUARD = path.join(__dirname, '..', 'hooks', 'scripts', 'pii-guard.js');

let passed = 0;
let failed = 0;

function run(label, input, expectedExit) {
  // If input is a string, send raw (for malformed JSON tests). Otherwise stringify.
  const stdin = typeof input === 'string' ? input : JSON.stringify(input);
  let actualExit;
  try {
    execFileSync('node', [GUARD], { input: stdin, stdio: ['pipe', 'pipe', 'pipe'] });
    actualExit = 0;
  } catch (err) {
    actualExit = err.status;
  }

  if (actualExit === expectedExit) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} — expected exit ${expectedExit}, got ${actualExit}`);
    failed++;
  }
}

// Helper to build tool_input for Write calls
function writeCall(filePath, content) {
  return { tool_input: { file_path: filePath, content } };
}

// Helper to build tool_input for Edit calls
function editCall(filePath, newString) {
  return { tool_input: { file_path: filePath, new_string: newString } };
}

// ─── Allowed paths ───────────────────────────────────────────────

console.log('\nAllowed paths (should exit 0 even with PII):');

run('output/ directory is allowed',
  writeCall('/Users/me/repos/job-seeker/output/test.md', '512-555-1234'),
  0);

run('references/ directory is allowed',
  writeCall('/Users/me/repos/job-seeker/references/resume.md', 'chris@gmail.com'),
  0);

run('config/candidate.md is allowed',
  writeCall('/Users/me/repos/job-seeker/config/candidate.md', '123 Main St'),
  0);

run('config/search.md is allowed',
  writeCall('/Users/me/repos/job-seeker/config/search.md', '512-555-1234'),
  0);

run('.claude/ directory is allowed',
  writeCall('/Users/me/repos/job-seeker/.claude/memory.md', '078-05-1120'),
  0);

run('/tmp/ is allowed',
  writeCall('/tmp/draft.md', 'chris@icloud.com'),
  0);

run('/private/tmp/ is allowed (macOS)',
  writeCall('/private/tmp/draft.md', '512-555-1234'),
  0);

// ─── Path traversal prevention ───────────────────────────────────

console.log('\nPath traversal prevention:');

run('output/../secret.md is blocked (traversal bypass)',
  writeCall('/Users/me/repos/job-seeker/output/../secret.md', '512-555-1234'),
  2);

// ─── PII detection — phone numbers ──────────────────────────────

console.log('\nPhone number detection:');

run('dashed phone: 512-555-1234',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Call me at 512-555-1234'),
  2);

run('parenthesized phone: (512) 555-1234',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Call (512) 555-1234'),
  2);

run('dotted phone: 512.555.1234',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Call 512.555.1234'),
  2);

run('international phone: +1 512-555-1234',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Call +1 512-555-1234'),
  2);

// ─── PII detection — email addresses ────────────────────────────

console.log('\nEmail detection:');

run('gmail address blocked',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Email: chris@gmail.com'),
  2);

run('icloud address blocked',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Email: chris@icloud.com'),
  2);

run('work email allowed (not personal domain)',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Email: chris@company.com'),
  0);

run('noreply email allowed',
  writeCall('/Users/me/repos/job-seeker/README.md', 'noreply@anthropic.com'),
  0);

// ─── PII detection — SSN ────────────────────────────────────────

console.log('\nSSN detection:');

run('valid SSN: 078-05-1120',
  writeCall('/Users/me/repos/job-seeker/README.md', 'SSN: 078-05-1120'),
  2);

run('invalid SSA area 000 not flagged',
  writeCall('/Users/me/repos/job-seeker/README.md', '000-12-3456'),
  0);

run('invalid SSA area 666 not flagged',
  writeCall('/Users/me/repos/job-seeker/README.md', '666-12-3456'),
  0);

run('invalid SSA area 9xx not flagged',
  writeCall('/Users/me/repos/job-seeker/README.md', '900-12-3456'),
  0);

run('invalid SSA group 00 not flagged',
  writeCall('/Users/me/repos/job-seeker/README.md', '123-00-4567'),
  0);

run('invalid SSA serial 0000 not flagged',
  writeCall('/Users/me/repos/job-seeker/README.md', '123-45-0000'),
  0);

// ─── PII detection — street addresses ───────────────────────────

console.log('\nStreet address detection:');

run('basic street address: 123 Main St',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Office at 123 Main St'),
  2);

run('full street address: 456 N Oak Avenue',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Located at 456 N Oak Avenue'),
  2);

run('directional address: 7890 SE Elm Blvd',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Visit 7890 SE Elm Blvd'),
  2);

// ─── Clean content (no PII) ─────────────────────────────────────

console.log('\nClean content (should exit 0):');

run('normal markdown with no PII',
  writeCall('/Users/me/repos/job-seeker/README.md', '# Job Seeker Plugin\n\nA tool for job searching.'),
  0);

run('code with port numbers (not phone)',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Server running on localhost:8080'),
  0);

run('version strings (not SSN)',
  writeCall('/Users/me/repos/job-seeker/README.md', 'Version 1.2.3'),
  0);

run('Edit tool uses new_string field',
  editCall('/Users/me/repos/job-seeker/README.md', '# Updated heading'),
  0);

run('Edit tool with PII in new_string is blocked',
  editCall('/Users/me/repos/job-seeker/README.md', 'Call 512-555-1234'),
  2);

// ─── Fail-closed behavior ───────────────────────────────────────

console.log('\nFail-closed behavior:');

run('malformed JSON blocks write',
  'not valid json',  // raw string, not an object — will fail JSON.parse
  2);

run('empty tool_input allows write (no file path)',
  { tool_input: {} },
  0);

run('no content allows write (nothing to scan)',
  writeCall('/Users/me/repos/job-seeker/README.md', ''),
  0);

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
