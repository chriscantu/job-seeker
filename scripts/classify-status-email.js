#!/usr/bin/env bun
const fs = require('fs');
const { classifyStatusEmail } = require('./lib/status-classifier');
const { parseApplicationsFile } = require('./lib/applications');
const { resolveStateFile } = require('./lib/util');

// Exit codes:
//   0  success (classification JSON or `null` on stdout)
//   2  usage error (missing/malformed args)
//   3  input error (email file missing or unreadable)
//   4  state error (applications file unreadable)
//   5  classifier error (unexpected exception in the classifier itself)
const EXIT_USAGE = 2;
const EXIT_INPUT = 3;
const EXIT_STATE = 4;
const EXIT_CLASSIFIER = 5;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    const nextLooksLikeFlag = typeof next !== 'string' || next.startsWith('--');

    if (key === '--email') {
      if (nextLooksLikeFlag) return { error: 'missing value for --email' };
      args.email = next;
      i++;
    } else if (key === '--applications-dir') {
      if (nextLooksLikeFlag) return { error: 'missing value for --applications-dir' };
      args.applicationsDir = next;
      i++;
    }
  }
  return args;
}

function usageError(detail) {
  console.error(`Usage: classify-status-email.js --email <file.json> --applications-dir <dir>${detail ? `\n  ${detail}` : ''}`);
  process.exit(EXIT_USAGE);
}

function structuredError(code, error, extra = {}) {
  console.error(JSON.stringify({ error, ...extra }));
  process.exit(code);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.error) usageError(args.error);
  const { email, applicationsDir } = args;
  if (!email || !applicationsDir) usageError();

  let emailData;
  try {
    const raw = fs.readFileSync(email, 'utf8');
    emailData = JSON.parse(raw);
  } catch (err) {
    structuredError(EXIT_INPUT, 'email_read_failed', { file: email, detail: err.message });
  }

  let applicationsData;
  try {
    const applicationsFile = resolveStateFile(applicationsDir, 'applications');
    if (!applicationsFile) {
      console.error(`warning: no applications file found in ${applicationsDir}; classifying against empty pipeline`);
      applicationsData = { active: [], closed: [], flagged: [] };
    } else {
      applicationsData = parseApplicationsFile(applicationsFile);
    }
  } catch (err) {
    structuredError(EXIT_STATE, 'applications_read_failed', { dir: applicationsDir, detail: err.message });
  }

  let result;
  try {
    result = classifyStatusEmail({ ...emailData, applicationsData });
  } catch (err) {
    structuredError(EXIT_CLASSIFIER, 'classifier_failed', { detail: err.message });
  }

  console.log(JSON.stringify(result));
}

main();
