#!/usr/bin/env bun
// tests/fixtures/gmail-search-stub.js
//
// Test double for `gmail.js search`, used by audit_trash_patterns.js
// integration tests via JOB_SEEKER_GMAIL_BIN. Unlike gmail-stub.js
// (which stubs trash-by-sender), this stub reads GMAIL_SEARCH_STDOUT /
// GMAIL_SEARCH_STDERR / GMAIL_SEARCH_EXIT and echoes them.
//
// The stub checks that process.argv[2] === "search" (argv[0] is the
// runtime, argv[1] is the script) to confirm the audit CLI is calling
// the right subcommand, then echoes the canned response.

const cmd = process.argv[2];
if (cmd !== 'search') {
  process.stderr.write(`gmail-search-stub: unexpected command "${cmd}" (expected "search")\n`);
  process.exit(1);
}

const stdout = process.env.GMAIL_SEARCH_STDOUT || '[]';
const stderr = process.env.GMAIL_SEARCH_STDERR || '';
const exit = parseInt(process.env.GMAIL_SEARCH_EXIT || '0', 10);

if (stdout) process.stdout.write(stdout + '\n');
if (stderr) process.stderr.write(stderr + '\n');
process.exit(exit);
