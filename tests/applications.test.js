const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  parseApplicationsContent,
  parseApplicationsFile,
  makeEntry,
} = require('../scripts/lib/applications');

const FIXTURES = path.join(__dirname, 'fixtures');
const FIXTURE_PATH = path.join(FIXTURES, 'applications.md');

describe('applications parser', () => {
  describe('parseApplicationsContent — empty / header-only', () => {
    it('returns { active: [], closed: [] } for empty content', () => {
      const result = parseApplicationsContent('');
      assert.deepEqual(result, { active: [], closed: [] });
    });

    it('returns { active: [], closed: [] } for header-only content', () => {
      const result = parseApplicationsContent('# Application Pipeline\n\nLast updated: 2026-04-08\n');
      assert.deepEqual(result, { active: [], closed: [] });
    });
  });

  describe('parseApplicationsFile — fixture counts', () => {
    it('parses 4 active applications', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active.length, 4);
    });

    it('parses 3 closed applications', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(closed.length, 3);
    });
  });

  describe('entry parsing — Maven (full active entry)', () => {
    it('extracts company and title from heading', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const maven = active[0];
      assert.equal(maven.company, 'Maven');
      assert.equal(maven.title, 'VP Engineering');
    });

    it('extracts stage', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].stage, 'Screen');
    });

    it('extracts applied date', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].applied, '2026-04-01');
    });

    it('extracts lastActivity as { date, detail }', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.deepEqual(active[0].lastActivity, {
        date: '2026-04-08',
        detail: 'Phone screen with recruiter',
      });
    });

    it('extracts nextAction', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].nextAction, 'Prep for technical interview');
    });

    it('extracts contacts', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].contacts, 'Jane Doe (Recruiter)');
    });

    it('extracts url', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].url, 'https://jobs.lever.co/maven/abc123');
    });

    it('extracts notes', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].notes, 'Strong culture fit');
    });

    it('extracts history as array of { date, stage, detail }', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const maven = active[0];
      assert.equal(maven.history.length, 3);
      assert.deepEqual(maven.history[0], {
        date: '2026-04-01',
        stage: 'Applied',
        detail: 'Submitted via website',
      });
      assert.deepEqual(maven.history[2], {
        date: '2026-04-08',
        stage: 'Screen',
        detail: 'Phone screen with recruiter',
      });
    });

    it('has null closed field for active entries', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      assert.equal(active[0].closed, null);
    });
  });

  describe('entry parsing — Acme Corp (empty optional fields)', () => {
    it('has empty string for contacts when blank', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const acme = active.find(e => e.company === 'Acme Corp');
      assert.ok(acme, 'should find Acme Corp');
      assert.equal(acme.contacts, '');
    });

    it('has empty string for notes when blank', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const acme = active.find(e => e.company === 'Acme Corp');
      assert.equal(acme.notes, '');
    });

    it('extracts title correctly', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const acme = active.find(e => e.company === 'Acme Corp');
      assert.equal(acme.title, 'Senior Director of Engineering');
    });
  });

  describe('entry parsing — GlobalTech (null applied)', () => {
    it('has null applied when field is blank', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const globaltech = active.find(e => e.company === 'GlobalTech');
      assert.ok(globaltech, 'should find GlobalTech');
      assert.equal(globaltech.applied, null);
    });
  });

  describe('entry parsing — Initech (closed with reason and summary)', () => {
    it('parses closed entry stage as full string "Closed (rejected)"', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech');
      assert.ok(initech, 'should find Initech');
      assert.equal(initech.stage, 'Closed (rejected)');
    });

    it('parses closed.date', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech');
      assert.equal(initech.closed.date, '2026-03-28');
    });

    it('parses closed.reason from stage string', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech');
      assert.equal(initech.closed.reason, 'rejected');
    });

    it('parses closed.summary', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech');
      assert.equal(initech.closed.summary, 'No response after phone screen');
    });

    it('extracts history for closed entry', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech');
      assert.equal(initech.history.length, 3);
    });
  });

  describe('entry parsing — TechStart Labs (multiple history entries)', () => {
    it('parses 4 history entries', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const techstart = active.find(e => e.company === 'TechStart Labs');
      assert.ok(techstart, 'should find TechStart Labs');
      assert.equal(techstart.history.length, 4);
    });

    it('parses stage with parens correctly', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const techstart = active.find(e => e.company === 'TechStart Labs');
      assert.equal(techstart.stage, 'Interview (2+)');
    });
  });

  describe('makeEntry — default shape', () => {
    it('returns entry with expected defaults', () => {
      const entry = makeEntry({ company: 'Test Co', title: 'VP Eng' });
      assert.equal(entry.company, 'Test Co');
      assert.equal(entry.title, 'VP Eng');
      assert.equal(entry.stage, null);
      assert.equal(entry.applied, null);
      assert.deepEqual(entry.lastActivity, { date: null, detail: null });
      assert.equal(entry.nextAction, null);
      assert.equal(entry.contacts, '');
      assert.equal(entry.url, null);
      assert.equal(entry.notes, '');
      assert.deepEqual(entry.history, []);
      assert.equal(entry.closed, null);
    });
  });
});
