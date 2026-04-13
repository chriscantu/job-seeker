const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { classifyStatusEmail, ATS_SENDERS } = require('../scripts/lib/status-classifier');
const { parseApplicationsContent } = require('../scripts/lib/applications');

const FIXTURES = path.join(__dirname, 'fixtures', 'status-emails');

function loadEmail(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function loadApplications() {
  const content = fs.readFileSync(path.join(FIXTURES, 'applications.md'), 'utf8');
  return parseApplicationsContent(content);
}

describe('classifyStatusEmail — sender matching', () => {
  it('returns null for non-ATS sender', () => {
    const email = loadEmail('non-ats-sender.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result, null);
  });

  it('matches @greenhouse-mail.io as greenhouse', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.notEqual(result, null);
    assert.equal(result.atsSender, 'greenhouse');
  });

  it('matches @lever.co as lever', () => {
    const email = loadEmail('ambiguous-no-signal.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.notEqual(result, null);
    assert.equal(result.atsSender, 'lever');
  });
});
