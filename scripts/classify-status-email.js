#!/usr/bin/env bun
const fs = require('fs');
const path = require('path');
const { classifyStatusEmail } = require('./lib/status-classifier');
const { parseApplicationsFile } = require('./lib/applications');
const { resolveStateFile } = require('./lib/util');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--email') args.email = argv[++i];
    else if (key === '--applications-dir') args.applicationsDir = argv[++i];
  }
  return args;
}

function main() {
  const { email, applicationsDir } = parseArgs(process.argv);
  if (!email || !applicationsDir) {
    console.error('Usage: classify-status-email.js --email <file.json> --applications-dir <dir>');
    process.exit(2);
  }

  const emailData = JSON.parse(fs.readFileSync(email, 'utf8'));

  const applicationsFile = resolveStateFile(applicationsDir, 'applications');
  const applicationsData = applicationsFile
    ? parseApplicationsFile(applicationsFile)
    : { active: [], closed: [], flagged: [] };

  const result = classifyStatusEmail({ ...emailData, applicationsData });
  console.log(JSON.stringify(result));
}

main();
