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

  it('polite rejection: Rejected beats Interview when both phrases present', () => {
    // Real rejection template: "we'd like to thank you" + "decided to move forward
    // with other candidates". Old P3 /we'?d like to/i Interview beat P4 /other
    // candidates/i Rejected, silently inverting status. Regression test for C3.
    const email = loadEmail('polite-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, 'Rejected');
  });

  it('reschedule interview phrasing does NOT classify as Rejected', () => {
    // Old lone /unfortunately/i fired Rejected on this message, auto-closing a
    // live interview thread. Regression test for C4.
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Test',
      subject: 'Interview reschedule',
      body: 'Unfortunately, the hiring manager is traveling this week — can we reschedule your interview for next Monday?',
      msgId: '<test-reschedule@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.notEqual(result.status, 'Rejected');
  });

  it('drops soft Interview phrases — "next steps" alone no longer classifies', () => {
    // Soft Interview phrases collide with rejection templates. They are now
    // absent from SIGNAL_RULES; emails with only soft phrases go to LOW.
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Test',
      subject: 'Next steps',
      body: 'We\'d like to share next steps for your application.',
      msgId: '<test-soft-interview@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.status, null);
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

describe('classifyStatusEmail — name matching', () => {
  it('MEDIUM tier when sender name matches entry without URL', () => {
    const email = loadEmail('discord-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'MEDIUM');
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Discord');
  });

  it('LOW tier when ATS sender + signal but no entry matches', () => {
    const email = loadEmail('unknown-company-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.tier, 'LOW');
    assert.equal(result.matchMethod, 'none');
    assert.equal(result.matchedEntry, null);
    // Status still extracted — this is a LOW-with-status case
    assert.equal(result.status, 'Rejected');
  });

  it('name normalization strips "Inc" / "LLC" / punctuation', () => {
    const applicationsData = {
      active: [{
        company: 'Realtor.com',
        title: 'Director',
        url: null,
        stage: 'Applied',
      }],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Realtor com Inc',
      subject: 'Update',
      body: 'Unfortunately, we will not be moving forward.',
      msgId: '<test-norm-name@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Realtor.com');
  });

  it('URL match takes precedence over name match', () => {
    const applicationsData = {
      active: [
        { company: 'Alpha', title: 'VP', url: 'https://boards.greenhouse.io/alpha/jobs/1', stage: 'Applied' },
        { company: 'Beta', title: 'VP', url: null, stage: 'Applied' },
      ],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Beta',
      subject: 'Update',
      body: 'We will not be moving forward. Check https://boards.greenhouse.io/alpha/jobs/1 for the posting.',
      msgId: '<test-precedence@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.company, 'Alpha');
  });

  it('subject extraction preserves hyphenated company names', () => {
    // Old regex /application to (.+?)(?:\s*[-—]|\s*$)/ stopped at ASCII hyphen,
    // truncating "Acme-Corp" to "Acme". Regression test for I8.
    const applicationsData = {
      active: [{ company: 'Acme-Corp', title: 'VP', url: null, stage: 'Applied' }],
      closed: [],
      flagged: [],
    };
    const email = {
      sender: 'no-reply@greenhouse-mail.io',
      senderName: 'Greenhouse',
      subject: 'Your application to Acme-Corp has been received',
      body: 'Thank you for applying.',
      msgId: '<test-hyphen@mail>',
    };
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'name');
    assert.equal(result.matchedEntry.company, 'Acme-Corp');
  });
});

describe('classifyStatusEmail — matchedEntry projection and section', () => {
  it('matchedEntry is projected to {company, title, url, stage, section} only', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.deepEqual(
      Object.keys(result.matchedEntry).sort(),
      ['company', 'section', 'stage', 'title', 'url']
    );
  });

  it('matchedEntry and result are frozen — callers cannot mutate pipeline through the classifier result', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.matchedEntry), true);
    // Silent-fail mutation in non-strict mode leaves values unchanged.
    const originalCompany = result.matchedEntry.company;
    try { result.matchedEntry.company = 'Hacked'; } catch {}
    assert.equal(result.matchedEntry.company, originalCompany);
  });

  it('section === "active" for a URL match against an Active entry', () => {
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData: loadApplications() });
    assert.equal(result.matchedEntry.section, 'active');
  });

  it('section === "closed" for a URL match against a Closed entry', () => {
    // C2 regression: classifier used to return closed entries without signaling
    // the section, causing markStatusChanged to throw.
    const applicationsData = {
      active: [],
      closed: [{
        company: 'Atlassian',
        title: 'VP Engineering',
        url: 'https://boards.greenhouse.io/atlassian/jobs/5123456',
        stage: 'Closed (rejected)',
      }],
      flagged: [],
    };
    const email = loadEmail('atlassian-rejection-greenhouse.json');
    const result = classifyStatusEmail({ ...email, applicationsData });
    assert.equal(result.matchMethod, 'url');
    assert.equal(result.matchedEntry.section, 'closed');
  });
});
