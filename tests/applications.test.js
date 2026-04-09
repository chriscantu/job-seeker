const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseApplicationsContent,
  parseApplicationsFile,
  parseApplications,
  makeEntry,
  formatApplication,
  formatApplicationsFile,
  createApplication,
  updateApplication,
  addNote,
  findApplication,
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

  describe('applications formatter', () => {
  it('formats a single active entry', () => {
    const md = formatApplication({
      company: 'Maven',
      title: 'VP Engineering',
      stage: 'Screen',
      applied: '2026-04-01',
      lastActivity: { date: '2026-04-08', detail: 'Phone screen with recruiter' },
      nextAction: 'Prep for technical interview',
      contacts: 'Jane Doe (Recruiter)',
      url: 'https://jobs.lever.co/maven/abc123',
      notes: 'Strong culture fit',
      history: [
        { date: '2026-04-01', stage: 'Applied', detail: 'Submitted via website' },
      ],
      closed: null,
    });
    assert.ok(md.includes('### Maven — VP Engineering'));
    assert.ok(md.includes('- **Stage**: Screen'));
    assert.ok(md.includes('- **Applied**: 2026-04-01'));
    assert.ok(md.includes('- 2026-04-01: Applied — Submitted via website'));
  });

  it('formats a closed entry with reason', () => {
    const md = formatApplication({
      company: 'Initech',
      title: 'VP of Engineering',
      stage: 'Closed (rejected)',
      applied: '2026-03-15',
      lastActivity: { date: null, detail: null },
      nextAction: null,
      contacts: null,
      url: null,
      notes: null,
      history: [
        { date: '2026-03-15', stage: 'Applied', detail: 'Submitted via referral' },
      ],
      closed: { date: '2026-03-28', reason: 'rejected', summary: 'No response' },
    });
    assert.ok(md.includes('- **Stage**: Closed (rejected)'));
    assert.ok(md.includes('- **Closed**: 2026-03-28'));
    assert.ok(md.includes('- **Summary**: No response'));
  });

  it('round-trips: parse → format → parse produces equivalent entries', () => {
    const original = parseApplicationsFile(FIXTURE_PATH);
    const formatted = formatApplicationsFile(original);
    const reparsed = parseApplicationsContent(formatted);

    assert.equal(reparsed.active.length, original.active.length);
    assert.equal(reparsed.closed.length, original.closed.length);

    for (let i = 0; i < original.active.length; i++) {
      assert.equal(reparsed.active[i].company, original.active[i].company);
      assert.equal(reparsed.active[i].stage, original.active[i].stage);
      assert.equal(reparsed.active[i].applied, original.active[i].applied);
      assert.equal(reparsed.active[i].history.length, original.active[i].history.length);
    }
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

  describe('createApplication', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates a new file when none exists and parseApplications returns 1 active entry', () => {
      createApplication(tmpDir, {
        company: 'Acme',
        title: 'VP Engineering',
        stage: 'Applied',
      });
      const { active } = parseApplications(tmpDir);
      assert.equal(active.length, 1);
      assert.equal(active[0].company, 'Acme');
    });

    it('defaults applied date to today when not provided', () => {
      const today = new Date().toISOString().slice(0, 10);
      createApplication(tmpDir, {
        company: 'Acme',
        title: 'VP Engineering',
        stage: 'Applied',
      });
      const { active } = parseApplications(tmpDir);
      assert.equal(active[0].applied, today);
    });

    it('appends to existing file: create two entries, verify both exist', () => {
      createApplication(tmpDir, {
        company: 'Acme',
        title: 'VP Engineering',
        stage: 'Applied',
      });
      createApplication(tmpDir, {
        company: 'BetaCorp',
        title: 'Senior Director',
        stage: 'Screen',
      });
      const { active } = parseApplications(tmpDir);
      assert.equal(active.length, 2);
      assert.ok(active.some(e => e.company === 'Acme'));
      assert.ok(active.some(e => e.company === 'BetaCorp'));
    });

    it('creates initial history entry with stage and detail', () => {
      createApplication(tmpDir, {
        company: 'Acme',
        title: 'VP Engineering',
        stage: 'Applied',
      });
      const { active } = parseApplications(tmpDir);
      const entry = active[0];
      assert.equal(entry.history.length, 1);
      assert.equal(entry.history[0].stage, 'Applied');
      assert.ok(entry.history[0].detail.length > 0);
    });

    it('rejects invalid entry: empty company throws', () => {
      assert.throws(
        () => createApplication(tmpDir, { company: '', title: 'VP Engineering', stage: 'Applied' }),
        /Invalid application entry/
      );
    });
  });

  describe('updateApplication', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-update-test-'));
      createApplication(tmpDir, {
        company: 'Maven',
        title: 'VP Engineering',
        stage: 'Applied',
      });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('transitions stage and appends history', () => {
      updateApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.equal(entry.stage, 'Screen');
      assert.equal(entry.history.length, 2);
      assert.equal(entry.history[1].stage, 'Screen');
    });

    it('updates lastActivity date to today', () => {
      const today = new Date().toISOString().slice(0, 10);
      updateApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.equal(entry.lastActivity.date, today);
    });

    it('finds company case-insensitively', () => {
      updateApplication(tmpDir, { company: 'maven', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.equal(entry.stage, 'Screen');
    });

    it('finds company by substring', () => {
      updateApplication(tmpDir, { company: 'Mav', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.equal(entry.stage, 'Screen');
    });

    it('throws for invalid stage', () => {
      assert.throws(
        () => updateApplication(tmpDir, { company: 'Maven', stage: 'Vibing' }),
        /stage must be one of/
      );
    });

    it('throws for no matching company', () => {
      assert.throws(
        () => updateApplication(tmpDir, { company: 'Nonexistent', stage: 'Screen' }),
        /No application found/
      );
    });

    it('throws for ambiguous match', () => {
      createApplication(tmpDir, {
        company: 'Maven Clinic',
        title: 'VP Engineering',
        stage: 'Applied',
      });
      assert.throws(
        () => updateApplication(tmpDir, { company: 'Maven', stage: 'Screen' }),
        /Multiple applications match/
      );
    });
  });

  describe('addNote', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-note-test-'));
      createApplication(tmpDir, {
        company: 'Maven',
        title: 'VP Engineering',
        stage: 'Applied',
      });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('appends note text to notes field', () => {
      addNote(tmpDir, { company: 'Maven', note: 'Cover letter generated 2026-04-09' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.ok(entry.notes.includes('Cover letter generated 2026-04-09'));
    });

    it('appends history entry with note as detail', () => {
      addNote(tmpDir, { company: 'Maven', note: 'Cover letter generated 2026-04-09' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      const last = entry.history[entry.history.length - 1];
      assert.ok(last.detail.includes('Cover letter generated 2026-04-09'));
    });

    it('updates lastActivity date to today', () => {
      const today = new Date().toISOString().slice(0, 10);
      addNote(tmpDir, { company: 'Maven', note: 'Some note' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.equal(entry.lastActivity.date, today);
    });

    it('throws for no matching company', () => {
      assert.throws(
        () => addNote(tmpDir, { company: 'Nonexistent', note: 'A note' }),
        /No application found/
      );
    });

    it('preserves existing notes when appending', () => {
      addNote(tmpDir, { company: 'Maven', note: 'First note' });
      addNote(tmpDir, { company: 'Maven', note: 'Second note' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven');
      assert.ok(entry.notes.includes('First note'));
      assert.ok(entry.notes.includes('Second note'));
      assert.ok(entry.notes.includes('; '));
    });
  });
});
