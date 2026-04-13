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
  closeApplication,
  reopenApplication,
} = require('../scripts/lib/applications');

const FIXTURES = path.join(__dirname, 'fixtures');
const FIXTURE_PATH = path.join(FIXTURES, 'applications.md');

describe('applications parser', () => {
  describe('parseApplicationsContent — empty / header-only', () => {
    it('returns { active: [], closed: [], flagged: [] } for empty content', () => {
      const result = parseApplicationsContent('');
      assert.deepEqual(result, { active: [], closed: [], flagged: [] });
    });

    it('returns { active: [], closed: [], flagged: [] } for header-only content', () => {
      const result = parseApplicationsContent('# Application Pipeline\n\nLast updated: 2026-04-08\n');
      assert.deepEqual(result, { active: [], closed: [], flagged: [] });
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
    // Fix #9: active-only fields must be absent in closed entries
    assert.ok(!md.includes('- **Last activity**:'));
    assert.ok(!md.includes('- **Next action**:'));
    assert.ok(!md.includes('- **URL**:'));
    assert.ok(!md.includes('- **Notes**:'));
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
      // Fix #8: deep history comparison
      for (let j = 0; j < original.active[i].history.length; j++) {
        assert.deepEqual(reparsed.active[i].history[j], original.active[i].history[j]);
      }
    }

    for (let i = 0; i < original.closed.length; i++) {
      assert.equal(reparsed.closed[i].company, original.closed[i].company);
      assert.equal(reparsed.closed[i].stage, original.closed[i].stage);
      assert.deepEqual(reparsed.closed[i].closed, original.closed[i].closed);
      assert.equal(reparsed.closed[i].history.length, original.closed[i].history.length);
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

    it('rejects duplicate company+title', () => {
      createApplication(tmpDir, {
        company: 'Acme',
        title: 'VP Engineering',
        stage: 'Applied',
      });
      assert.throws(
        () => createApplication(tmpDir, { company: 'Acme', title: 'VP Engineering', stage: 'Screen' }),
        /Application already exists/
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

    it('throws for empty note', () => {
      assert.throws(
        () => addNote(tmpDir, { company: 'Maven', note: '' }),
        /note is required/
      );
    });

    it('throws for whitespace-only note', () => {
      assert.throws(
        () => addNote(tmpDir, { company: 'Maven', note: '   ' }),
        /note is required/
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

  describe('closeApplication', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-close-test-'));
      createApplication(tmpDir, {
        company: 'Maven',
        title: 'VP Engineering',
        stage: 'Screen',
      });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('moves entry from active to closed', () => {
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No response after screen' });
      const data = parseApplications(tmpDir);
      assert.equal(data.active.length, 0);
      assert.equal(data.closed.length, 1);
      assert.equal(data.closed[0].company, 'Maven');
    });

    it('sets stage to Closed(reason)', () => {
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No response' });
      const { closed } = parseApplications(tmpDir);
      assert.equal(closed[0].stage, 'Closed (rejected)');
    });

    it('populates closed metadata', () => {
      const today = new Date().toISOString().slice(0, 10);
      closeApplication(tmpDir, { company: 'Maven', reason: 'withdrawn', summary: 'Accepted another offer' });
      const { closed } = parseApplications(tmpDir);
      assert.deepEqual(closed[0].closed, {
        date: today,
        reason: 'withdrawn',
        summary: 'Accepted another offer',
      });
    });

    it('appends history entry', () => {
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No fit' });
      const { closed } = parseApplications(tmpDir);
      const last = closed[0].history[closed[0].history.length - 1];
      assert.equal(last.stage, 'Closed (rejected)');
      assert.ok(last.detail.includes('No fit'));
    });

    it('updates frontmatter counts after close', () => {
      const { parseFrontmatter } = require('../scripts/lib/frontmatter');
      const { resolveStateFile } = require('../scripts/lib/util');
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No fit' });
      const filePath = resolveStateFile(tmpDir, 'applications');
      const { meta } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
      assert.equal(meta.active_count, '0');
      assert.equal(meta.closed_count, '1');
    });

    it('throws if entry is already closed', () => {
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No fit' });
      assert.throws(
        () => closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'Again' }),
        /not found in active applications/
      );
    });

    it('throws if company not found', () => {
      assert.throws(
        () => closeApplication(tmpDir, { company: 'Nonexistent', reason: 'rejected', summary: 'n/a' }),
        /No application found/
      );
    });

    it('requires reason', () => {
      assert.throws(
        () => closeApplication(tmpDir, { company: 'Maven', summary: 'No fit' }),
        /reason is required/
      );
    });

    it('preserves other active entries', () => {
      createApplication(tmpDir, { company: 'Acme', title: 'Sr Dir', stage: 'Applied' });
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No fit' });
      const data = parseApplications(tmpDir);
      assert.equal(data.active.length, 1);
      assert.equal(data.active[0].company, 'Acme');
      assert.equal(data.closed.length, 1);
      assert.equal(data.closed[0].company, 'Maven');
    });
  });

  describe('reopenApplication', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-reopen-test-'));
      createApplication(tmpDir, {
        company: 'Maven',
        title: 'VP Engineering',
        stage: 'Screen',
      });
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No response' });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('moves entry from closed to active', () => {
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const data = parseApplications(tmpDir);
      assert.equal(data.active.length, 1);
      assert.equal(data.closed.length, 0);
      assert.equal(data.active[0].company, 'Maven');
    });

    it('sets stage to the provided value', () => {
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Interview (1)' });
      const { active } = parseApplications(tmpDir);
      assert.equal(active[0].stage, 'Interview (1)');
    });

    it('clears closed metadata', () => {
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      assert.equal(active[0].closed, null);
    });

    it('appends history entry', () => {
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen', detail: 'Recruiter reached back out' });
      const { active } = parseApplications(tmpDir);
      const last = active[0].history[active[0].history.length - 1];
      assert.equal(last.stage, 'Screen');
      assert.ok(last.detail.includes('Recruiter reached back out'));
    });

    it('updates frontmatter counts after reopen', () => {
      const { parseFrontmatter } = require('../scripts/lib/frontmatter');
      const { resolveStateFile } = require('../scripts/lib/util');
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const filePath = resolveStateFile(tmpDir, 'applications');
      const { meta } = parseFrontmatter(fs.readFileSync(filePath, 'utf8'));
      assert.equal(meta.active_count, '1');
      assert.equal(meta.closed_count, '0');
    });

    it('throws if entry is active (not closed)', () => {
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      assert.throws(
        () => reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen' }),
        /not found in closed applications/
      );
    });

    it('throws for invalid stage', () => {
      assert.throws(
        () => reopenApplication(tmpDir, { company: 'Maven', stage: 'Vibing' }),
        /stage must be one of/
      );
    });

    it('rejects Closed as target stage', () => {
      assert.throws(
        () => reopenApplication(tmpDir, { company: 'Maven', stage: 'Closed' }),
        /Cannot reopen to Closed/
      );
    });
  });

  describe('frontmatter support', () => {
    it('parseApplicationsContent ignores frontmatter and parses body', () => {
      const content = `---
format_version: 1
last_updated: 2026-04-09
active_count: 1
closed_count: 0
---
# Application Pipeline

Last updated: 2026-04-09

## Active Applications

### Acme — VP Engineering

- **Stage**: Applied
- **Applied**: 2026-04-09
- **Last activity**: 2026-04-09 — Applied — Added to pipeline
- **Next action**:
- **Contacts**:
- **URL**: https://example.com/job/1
- **Notes**: Test entry

#### History
- 2026-04-09: Applied — Added to pipeline

## Closed Applications
`;
      const result = parseApplicationsContent(content);
      assert.equal(result.active.length, 1);
      assert.equal(result.active[0].company, 'Acme');
      assert.equal(result.active[0].stage, 'Applied');
      assert.equal(result.closed.length, 0);
    });

    it('formatApplicationsFile includes frontmatter with correct fields', () => {
      const { parseFrontmatter } = require('../scripts/lib/frontmatter');
      const data = {
        active: [makeEntry({ company: 'Acme', title: 'VP Eng', stage: 'Applied', applied: '2026-04-09', history: [{ date: '2026-04-09', stage: 'Applied', detail: 'Added' }] })],
        closed: [makeEntry({ company: 'Old Co', title: 'Director', stage: 'Closed (rejected)', applied: '2026-03-01', closed: { date: '2026-03-15', reason: 'rejected', summary: 'No fit' }, history: [{ date: '2026-03-01', stage: 'Applied', detail: 'Added' }] })],
      };
      const output = formatApplicationsFile(data);
      const { meta, body } = parseFrontmatter(output);

      assert.equal(meta.format_version, '1');
      assert.ok(meta.last_updated);
      assert.equal(meta.active_count, '1');
      assert.equal(meta.closed_count, '1');
      assert.ok(body.includes('# Application Pipeline'));
      assert.ok(body.includes('### Acme — VP Eng'));
    });

    it('round-trip with both active and closed entries is stable', () => {
      const { parseFrontmatter } = require('../scripts/lib/frontmatter');
      const data = {
        active: [makeEntry({ company: 'Acme', title: 'VP Eng', stage: 'Screen', applied: '2026-04-01', lastActivity: { date: '2026-04-08', detail: 'Phone screen' }, nextAction: 'Technical interview', contacts: 'Jane Doe', url: 'https://example.com/job/1', notes: 'Good fit', history: [{ date: '2026-04-01', stage: 'Applied', detail: 'Submitted' }, { date: '2026-04-08', stage: 'Screen', detail: 'Phone screen' }] })],
        closed: [makeEntry({ company: 'Old Co', title: 'Director', stage: 'Closed (rejected)', applied: '2026-03-01', closed: { date: '2026-03-15', reason: 'rejected', summary: 'No fit' }, history: [{ date: '2026-03-01', stage: 'Applied', detail: 'Added' }, { date: '2026-03-15', stage: 'Closed (rejected)', detail: 'No fit' }] })],
      };

      const firstPass = formatApplicationsFile(data);
      const parsed = parseApplicationsContent(firstPass);
      const secondPass = formatApplicationsFile(parsed);

      const first = parseFrontmatter(firstPass);
      const second = parseFrontmatter(secondPass);

      assert.equal(first.meta.active_count, second.meta.active_count);
      assert.equal(first.meta.closed_count, second.meta.closed_count);
      assert.equal(first.body, second.body);
    });

    it('round-trip: formatApplicationsFile -> parseApplicationsContent -> formatApplicationsFile is stable', () => {
      const { parseFrontmatter } = require('../scripts/lib/frontmatter');
      const data = {
        active: [makeEntry({ company: 'Acme', title: 'VP Eng', stage: 'Screen', applied: '2026-04-01', lastActivity: { date: '2026-04-08', detail: 'Phone screen' }, nextAction: 'Technical interview', contacts: 'Jane Doe', url: 'https://example.com/job/1', notes: 'Good fit', history: [{ date: '2026-04-01', stage: 'Applied', detail: 'Submitted' }, { date: '2026-04-08', stage: 'Screen', detail: 'Phone screen' }] })],
        closed: [],
      };

      const firstPass = formatApplicationsFile(data);
      const parsed = parseApplicationsContent(firstPass);
      const secondPass = formatApplicationsFile(parsed);

      const first = parseFrontmatter(firstPass);
      const second = parseFrontmatter(secondPass);

      // Meta fields should match (except last_updated which is always today)
      assert.equal(first.meta.format_version, second.meta.format_version);
      assert.equal(first.meta.active_count, second.meta.active_count);
      assert.equal(first.meta.closed_count, second.meta.closed_count);

      // Body should be identical
      assert.equal(first.body, second.body);
    });

    describe('createApplication with frontmatter', () => {
      let tmpDir;

      beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-fm-test-'));
      });

      afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      it('new file has frontmatter with correct counts', () => {
        const { parseFrontmatter } = require('../scripts/lib/frontmatter');
        createApplication(tmpDir, { company: 'Acme', title: 'VP Eng', stage: 'Applied' });

        const { resolveStateFile } = require('../scripts/lib/util');
        const filePath = resolveStateFile(tmpDir, 'applications');
        const raw = fs.readFileSync(filePath, 'utf8');
        const { meta } = parseFrontmatter(raw);

        assert.equal(meta.format_version, '1');
        assert.equal(meta.active_count, '1');
        assert.equal(meta.closed_count, '0');
      });

      it('second create updates counts in frontmatter', () => {
        const { parseFrontmatter } = require('../scripts/lib/frontmatter');
        createApplication(tmpDir, { company: 'Acme', title: 'VP Eng', stage: 'Applied' });
        createApplication(tmpDir, { company: 'Beta', title: 'Director', stage: 'Screen' });

        const { resolveStateFile } = require('../scripts/lib/util');
        const filePath = resolveStateFile(tmpDir, 'applications');
        const raw = fs.readFileSync(filePath, 'utf8');
        const { meta } = parseFrontmatter(raw);

        assert.equal(meta.active_count, '2');
        assert.equal(meta.closed_count, '0');
      });
    });
  });

  describe('parseApplicationsContent — flagged for review', () => {
    it('returns empty flagged array when no section present', () => {
      const content = `---
format_version: 1
---
# Application Pipeline

## Active Applications

## Closed Applications
`;
      const result = parseApplicationsContent(content);
      assert.deepEqual(result.flagged, []);
    });

    it('parses a single flagged entry', () => {
      const content = `---
format_version: 1
---
# Application Pipeline

## Active Applications

## Closed Applications

## Flagged for Review

### Acme Corp — Unknown role — 2026-04-13

- **Detected signal**: "unfortunately" → Rejected
- **Sender**: no-reply@greenhouse-mail.io
- **Match method**: none
- **Message-ID**: <fixture-unknown-001@mail.gmail.com>
- **Action**: Resolve manually
`;
      const result = parseApplicationsContent(content);
      assert.equal(result.flagged.length, 1);
      const entry = result.flagged[0];
      assert.equal(entry.company, 'Acme Corp');
      assert.equal(entry.title, 'Unknown role');
      assert.equal(entry.detectedAt, '2026-04-13');
      assert.equal(entry.status, 'Rejected');
      assert.equal(entry.sender, 'no-reply@greenhouse-mail.io');
      assert.equal(entry.matchMethod, 'none');
      assert.equal(entry.msgId, '<fixture-unknown-001@mail.gmail.com>');
    });
  });

  describe('updateApplication — section guards', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-guard-test-'));
      createApplication(tmpDir, {
        company: 'Maven',
        title: 'VP Engineering',
        stage: 'Applied',
      });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('rejects Closed as a stage — directs to closeApplication', () => {
      assert.throws(
        () => updateApplication(tmpDir, { company: 'Maven', stage: 'Closed' }),
        /use the "close" command/i
      );
    });

    it('throws when updating a closed entry', () => {
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No fit' });
      assert.throws(
        () => updateApplication(tmpDir, { company: 'Maven', stage: 'Screen' }),
        /not found in active applications/
      );
    });
  });
});
