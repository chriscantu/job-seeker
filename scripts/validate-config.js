#!/usr/bin/env node
// scripts/validate-config.js
// Validates config files exist and contain required fields.
// Run: node scripts/validate-config.js
// Exit 0 = valid. Exit 1 = issues found (messages printed to stdout).

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const issues = [];

function checkFile(filePath, requiredFields, examplePath) {
  const fullPath = path.join(root, filePath);
  if (!fs.existsSync(fullPath)) {
    issues.push(`✗ ${filePath} not found.\n  Copy ${examplePath} to ${filePath} and fill in your details.`);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  for (const field of requiredFields) {
    // Match "| Field |" in markdown table (with optional whitespace)
    const pattern = new RegExp(`\\|\\s*${field}\\s*\\|`);
    if (!pattern.test(content)) {
      issues.push(`✗ ${filePath} is missing required field: "${field}"`);
    }
  }
}

function checkGitignore() {
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return;
  const content = fs.readFileSync(gitignorePath, 'utf8');
  const required = [
    'config/candidate.md',
    'config/search.md',
    '/references/',
  ];
  for (const entry of required) {
    if (!content.includes(entry)) {
      issues.push(`✗ .gitignore is missing entry: ${entry}`);
    }
  }
}

function checkStateFiles() {
  // Validates naming for all three state file types: seen-postings, applications, preferences.
  // State files live in output/ after migration (not memory/job-search/ — that is the old Apple Notes mirror).
  const outputDir = path.join(root, 'output');
  if (!fs.existsSync(outputDir)) return;
  const statePattern = /^(\d{4}-\d{2}-\d{2})-(seen-postings|applications|preferences)\.md$/;
  const stateFiles = fs.readdirSync(outputDir).filter(f =>
    (f.includes('seen-postings') || f.includes('applications') || f.includes('preferences')) &&
    f.endsWith('.md')
  );
  for (const file of stateFiles) {
    if (!statePattern.test(file)) {
      issues.push(`✗ State file "output/${file}" does not follow YYYY-MM-DD-{type}.md naming.`);
    }
  }
}

const CANDIDATE_FIELDS = [
  'Name', 'Current Role', 'Target Roles', 'Experience',
  'Core Strengths', 'Previous Companies', 'Education', 'Location', 'Email',
];
const SEARCH_FIELDS = ['Remote Preference', 'Comp Floor', 'Company Types'];

checkFile('config/candidate.md', CANDIDATE_FIELDS, 'config/candidate.md.example');
checkFile('config/search.md', SEARCH_FIELDS, 'config/search.md.example');
checkGitignore();
checkStateFiles();

if (issues.length === 0) {
  console.log('✓ Config valid');
  process.exit(0);
} else {
  console.log(`✗ ${issues.length} issue(s) found:\n`);
  issues.forEach(i => console.log(`  ${i}\n`));
  process.exit(1);
}
