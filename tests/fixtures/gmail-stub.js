#!/usr/bin/env bun
// tests/fixtures/gmail-stub.js
//
// Test double for scripts/gmail.js, used by auto-trash-gmail integration
// tests via JOB_SEEKER_GMAIL_BIN. Reads three env vars and produces the
// requested canned output + exit code, no Gmail API calls.
//
// Env:
//   GMAIL_STUB_STDOUT    text printed to stdout
//   GMAIL_STUB_STDERR    text printed to stderr
//   GMAIL_STUB_EXIT      exit code (string, parsed as int; default 0)
//
// The stub ignores its argv — auto_trash_gmail.js passes real
// `trash-by-sender --sender foo --sender bar ...` args but the stub
// only needs to echo pre-configured output to exercise
// classifyGmailResult's branches.

const stdout = process.env.GMAIL_STUB_STDOUT || '';
const stderr = process.env.GMAIL_STUB_STDERR || '';
const exit = parseInt(process.env.GMAIL_STUB_EXIT || '0', 10);

if (stdout) process.stdout.write(stdout + '\n');
if (stderr) process.stderr.write(stderr + '\n');
process.exit(exit);
