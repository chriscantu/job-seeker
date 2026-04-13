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

describe('classifyStatusEmail — signal extraction', () => {
  it('extracts Rejected signal from "we\'ve decided not to move forward"', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
    assert.match(result.signal, /not to move forward/i);
  });

  it('extracts Rejected signal from "unfortunately" + "moving forward"', () => {
    const email = loadEmail('discord-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
  });

  it('extracts Interview signal from "next steps" + "schedule your interview"', () => {
    const email = loadEmail('realtor-interview-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Interview');
  });

  it('extracts Applied signal from "application received"', () => {
    const email = loadEmail('ambiguous-no-signal.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    // NB: fixture body says "We received your application" — normalize test expectations
    assert.equal(result.status, 'Applied');
  });

  it('status is null when no signal phrases match', () => {
    const email = {
      sender: 'notifications@lever.co',
      senderName: 'Test',
      subject: 'Generic update',
      body: 'Hello, this is just a status email with no specific signal phrases.',
      msgId: '<test-no-signal@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, null);
  });

  it('priority: Rejected beats Applied when both phrases present', () => {
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Test',
      subject: 'Application update',
      body: 'Thank you for applying. After review, we\'ve decided not to move forward.',
      msgId: '<test-priority@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
  });
});

describe('classifyStatusEmail — URL matching', () => {
  it('HIGH tier when body URL matches applications.md entry URL', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'HIGH');
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Atlassian');
  });

  it('HIGH tier for interview URL match', () => {
    const email = loadEmail('realtor-interview-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'HIGH');
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Realtor.com');
  });

  it('URL normalization: strips query params and trailing slash', () => {
    const applicationsData = {
      active: [{
        company: 'Test',
        title: 'Role',
        url: 'https://boards.greenhouse.io/test/jobs/999',
        stage: 'Applied',
      }],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Test',
      subject: 'Update',
      body: 'Unfortunately https://boards.greenhouse.io/test/jobs/999/?utm=foo we have decided.',
      msgId: '<test-norm@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Test');
  });
});
