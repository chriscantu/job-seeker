import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseApplicationsContent,
  parseApplicationsFile,
  parseApplications,
  makeEntry,
  formatApplication,
  formatApplicationsFile,
  createApplication,
  updateApplication,
  addNote,
  closeApplication,
  reopenApplication,
  flagForReview,
  markStatusChanged,
  daysBetween,
  staleApplications,
} from '../scripts/lib/applications';
import type { MarkStatusChangedInput, CloseApplicationInput } from '../scripts/lib/applications';
import type { ProjectedMatch } from '../scripts/lib/status-classifier';
import { parseFrontmatter } from '../scripts/lib/frontmatter';
import { resolveStateFile } from '../scripts/lib/util';

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
      const acme = active.find(e => e.company === 'Acme Corp')!;
      assert.ok(acme, 'should find Acme Corp');
      assert.equal(acme.contacts, '');
    });

    it('has empty string for notes when blank', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const acme = active.find(e => e.company === 'Acme Corp')!;
      assert.equal(acme.notes, '');
    });

    it('extracts title correctly', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const acme = active.find(e => e.company === 'Acme Corp')!;
      assert.equal(acme.title, 'Senior Director of Engineering');
    });
  });

  describe('entry parsing — GlobalTech (null applied)', () => {
    it('has null applied when field is blank', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const globaltech = active.find(e => e.company === 'GlobalTech')!;
      assert.ok(globaltech, 'should find GlobalTech');
      assert.equal(globaltech.applied, null);
    });
  });

  describe('entry parsing — Initech (closed with reason and summary)', () => {
    it('parses closed entry stage as full string "Closed (rejected)"', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech')!;
      assert.ok(initech, 'should find Initech');
      assert.equal(initech.stage, 'Closed (rejected)');
    });

    it('parses closed.date', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech')!;
      assert.equal(initech.closed!.date, '2026-03-28');
    });

    it('parses closed.reason from stage string', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech')!;
      assert.equal(initech.closed!.reason, 'rejected');
    });

    it('parses closed.summary', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech')!;
      assert.equal(initech.closed!.summary, 'No response after phone screen');
    });

    it('extracts history for closed entry', () => {
      const { closed } = parseApplicationsFile(FIXTURE_PATH);
      const initech = closed.find(e => e.company === 'Initech')!;
      assert.equal(initech.history.length, 3);
    });
  });

  describe('entry parsing — TechStart Labs (multiple history entries)', () => {
    it('parses 4 history entries', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const techstart = active.find(e => e.company === 'TechStart Labs')!;
      assert.ok(techstart, 'should find TechStart Labs');
      assert.equal(techstart.history.length, 4);
    });

    it('parses stage with parens correctly', () => {
      const { active } = parseApplicationsFile(FIXTURE_PATH);
      const techstart = active.find(e => e.company === 'TechStart Labs')!;
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
      contacts: '',
      url: null,
      notes: '',
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
    let tmpDir: string;

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
    let tmpDir: string;

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
      const entry = active.find(e => e.company === 'Maven')!;
      assert.equal(entry.stage, 'Screen');
      assert.equal(entry.history.length, 2);
      assert.equal(entry.history[1].stage, 'Screen');
    });

    it('updates lastActivity date to today', () => {
      const today = new Date().toISOString().slice(0, 10);
      updateApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven')!;
      assert.equal(entry.lastActivity.date, today);
    });

    it('finds company case-insensitively', () => {
      updateApplication(tmpDir, { company: 'maven', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven')!;
      assert.equal(entry.stage, 'Screen');
    });

    it('finds company by substring', () => {
      updateApplication(tmpDir, { company: 'Mav', stage: 'Screen' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven')!;
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
    let tmpDir: string;

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
      const entry = active.find(e => e.company === 'Maven')!;
      assert.ok(entry.notes.includes('Cover letter generated 2026-04-09'));
    });

    it('appends history entry with note as detail', () => {
      addNote(tmpDir, { company: 'Maven', note: 'Cover letter generated 2026-04-09' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven')!;
      const last = entry.history[entry.history.length - 1];
      assert.ok(last.detail.includes('Cover letter generated 2026-04-09'));
    });

    it('updates lastActivity date to today', () => {
      const today = new Date().toISOString().slice(0, 10);
      addNote(tmpDir, { company: 'Maven', note: 'Some note' });
      const { active } = parseApplications(tmpDir);
      const entry = active.find(e => e.company === 'Maven')!;
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
      const entry = active.find(e => e.company === 'Maven')!;
      assert.ok(entry.notes.includes('First note'));
      assert.ok(entry.notes.includes('Second note'));
      assert.ok(entry.notes.includes('; '));
    });
  });

  describe('closeApplication', () => {
    let tmpDir: string;

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
      closeApplication(tmpDir, { company: 'Maven', reason: 'rejected', summary: 'No fit' });
      const filePath = resolveStateFile(tmpDir, 'applications')!;
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
        () => closeApplication(tmpDir, { company: 'Maven', summary: 'No fit' } as CloseApplicationInput),
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
    let tmpDir: string;

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
      reopenApplication(tmpDir, { company: 'Maven', stage: 'Screen' });
      const filePath = resolveStateFile(tmpDir, 'applications')!;
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
      let tmpDir: string;

      beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-fm-test-'));
      });

      afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      it('new file has frontmatter with correct counts', () => {
          createApplication(tmpDir, { company: 'Acme', title: 'VP Eng', stage: 'Applied' });

          const filePath = resolveStateFile(tmpDir, 'applications')!;
        const raw = fs.readFileSync(filePath, 'utf8');
        const { meta } = parseFrontmatter(raw);

        assert.equal(meta.format_version, '1');
        assert.equal(meta.active_count, '1');
        assert.equal(meta.closed_count, '0');
      });

      it('second create updates counts in frontmatter', () => {
          createApplication(tmpDir, { company: 'Acme', title: 'VP Eng', stage: 'Applied' });
        createApplication(tmpDir, { company: 'Beta', title: 'Director', stage: 'Screen' });

          const filePath = resolveStateFile(tmpDir, 'applications')!;
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
    let tmpDir: string;

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

  describe('formatApplicationsFile — flagged for review round-trip', () => {
    it('writes flagged section and flagged_count frontmatter', () => {
      const data = {
        active: [],
        closed: [],
        flagged: [{
          company: 'Acme Corp',
          title: 'Unknown role',
          detectedAt: '2026-04-13',
          signal: 'unfortunately',
          status: 'Rejected',
          sender: 'no-reply@greenhouse-mail.io',
          matchMethod: 'none',
          msgId: '<fixture-unknown-001@mail.gmail.com>',
          action: 'Resolve manually — confirm which application this refers to, or dismiss if unrelated',
        }],
      };

      const output = formatApplicationsFile(data);
      assert.match(output, /flagged_count:\s*1/);
      assert.match(output, /## Flagged for Review/);
      assert.match(output, /### Acme Corp — Unknown role — 2026-04-13/);
      assert.match(output, /\*\*Detected signal\*\*: "unfortunately" → Rejected/);
      assert.match(output, /\*\*Message-ID\*\*: <fixture-unknown-001@mail\.gmail\.com>/);

      // Round-trip: parse the output, get back the same flagged entry
      const reparsed = parseApplicationsContent(output);
      assert.equal(reparsed.flagged.length, 1);
      assert.equal(reparsed.flagged[0].company, 'Acme Corp');
      assert.equal(reparsed.flagged[0].msgId, '<fixture-unknown-001@mail.gmail.com>');
    });

    it('omits flagged section when empty (but includes flagged_count: 0)', () => {
      const data = { active: [], closed: [], flagged: [] };
      const output = formatApplicationsFile(data);
      assert.match(output, /flagged_count:\s*0/);
      assert.doesNotMatch(output, /## Flagged for Review/);
    });
  });

  describe('flagForReview / markStatusChanged', () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-status-'));
      // Seed with fixture
      const content = fs.readFileSync(path.join(__dirname, 'fixtures', 'status-emails', 'applications.md'), 'utf8');
      fs.writeFileSync(path.join(dir, '2026-04-13-applications.md'), content);
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('flagForReview appends to Flagged section and bumps flagged_count', () => {
      flagForReview(dir, {
        company: 'Acme Corp',
        title: 'Unknown role',
        signal: 'unfortunately',
        status: 'Rejected',
        sender: 'no-reply@greenhouse-mail.io',
        matchMethod: 'none',
        msgId: '<fixture-unknown-001@mail.gmail.com>',
        detectedAt: '2026-04-13',
      });
      const data = parseApplications(dir);
      assert.equal(data.flagged.length, 1);
      assert.equal(data.flagged[0].company, 'Acme Corp');

      const raw = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
      assert.match(raw, /flagged_count:\s*1/);
    });

    const atlassianActive: ProjectedMatch = {
      company: 'Atlassian',
      title: 'VP Engineering',
      url: 'https://boards.greenhouse.io/atlassian/jobs/5123456',
      stage: 'Applied',
      section: 'active',
    };

    const realtorActive: ProjectedMatch = {
      company: 'Realtor.com',
      title: 'Director, Software Engineering',
      url: 'https://boards.greenhouse.io/realtor/jobs/5234567',
      stage: 'Applied',
      section: 'active',
    };

    it('markStatusChanged(Rejected) moves entry to Closed and appends history with msg-id', () => {
      const result = markStatusChanged(dir, {
        msgId: '<fixture-atlassian-001@mail.gmail.com>',
        matchedEntry: atlassianActive,
        status: 'Rejected',
        signal: "we've decided not to move forward",
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      assert.equal(result.skipped, false);

      const data = parseApplications(dir);
      assert.equal(data.active.find(e => e.company === 'Atlassian'), undefined);
      const closed = data.closed.find(e => e.company === 'Atlassian')!;
      assert.notEqual(closed, undefined);
      assert.match(closed.stage!, /Closed \(rejected\)/);

      const raw = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
      assert.match(raw, /\(msg-id: <fixture-atlassian-001@mail\.gmail\.com>\)/);
    });

    it('markStatusChanged is idempotent by msg-id', () => {
      markStatusChanged(dir, {
        msgId: '<fixture-atlassian-001@mail.gmail.com>',
        matchedEntry: atlassianActive,
        status: 'Rejected',
        signal: 'not moving forward',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      const second = markStatusChanged(dir, {
        msgId: '<fixture-atlassian-001@mail.gmail.com>',
        matchedEntry: atlassianActive,
        status: 'Rejected',
        signal: 'not moving forward',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      assert.equal(second.skipped, true);
      assert.equal(second.reason, 'msg-id already processed');

      const data = parseApplications(dir);
      const closed = data.closed.filter(e => e.company === 'Atlassian');
      assert.equal(closed.length, 1);
    });

    it('flagForReview is idempotent by msg-id', () => {
      const opts = {
        company: 'Realtor.com',
        title: 'Dir, Software Engineering',
        signal: null,
        status: null,
        sender: 'no-reply@greenhouse.io',
        matchMethod: 'none',
        msgId: '<fixture-realtor-reminder-001@mail.gmail.com>',
        detectedAt: '2026-04-13',
      };
      const first = flagForReview(dir, opts);
      assert.equal(first.skipped, false);

      const second = flagForReview(dir, opts);
      assert.equal(second.skipped, true);
      assert.equal(second.reason, 'msg-id already processed');

      const data = parseApplications(dir);
      const matches = data.flagged.filter(e => e.msgId === opts.msgId);
      assert.equal(matches.length, 1);
    });

    it('markStatusChanged(Interview) maps classifier "Interview" to valid "Interview (1)" stage', () => {
      markStatusChanged(dir, {
        msgId: '<fixture-realtor-001@mail.gmail.com>',
        matchedEntry: realtorActive,
        status: 'Interview',
        signal: 'schedule your interview',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      const data = parseApplications(dir);
      const entry = data.active.find(e => e.company === 'Realtor.com')!;
      // Classifier emits 'Interview' but VALID_STAGES requires 'Interview (1)' or
      // 'Interview (2+)'. Regression test for C1.
      assert.equal(entry.stage, 'Interview (1)');
      const last = entry.history[entry.history.length - 1];
      assert.match(last.detail, /\(msg-id: <fixture-realtor-001@mail\.gmail\.com>\)/);
    });

    it('markStatusChanged(Interview) advances Interview (1) → Interview (2+) on repeat signal', () => {
      markStatusChanged(dir, {
        msgId: '<fixture-interview-first@mail>',
        matchedEntry: realtorActive,
        status: 'Interview',
        signal: 'schedule your interview',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      markStatusChanged(dir, {
        msgId: '<fixture-interview-second@mail>',
        matchedEntry: { ...realtorActive, stage: 'Interview (1)' },
        status: 'Interview',
        signal: 'interview scheduled',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-14',
      });
      const data = parseApplications(dir);
      const entry = data.active.find(e => e.company === 'Realtor.com')!;
      assert.equal(entry.stage, 'Interview (2+)');
    });

    it('markStatusChanged(Interview) does NOT walk Offer stage backwards', () => {
      // C5 regression: stray interview reminder on an Offer-stage app used to
      // downgrade to 'Interview (1)'. STAGES_OUTRANKING_INTERVIEW prevents it.
      // Seed an Offer entry first.
      const offerEntry = { ...realtorActive, stage: 'Offer' };
      // Manually put Realtor at Offer stage by writing the file directly.
      const raw = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
      fs.writeFileSync(
        path.join(dir, '2026-04-13-applications.md'),
        raw.replace(/(### Realtor\.com[\s\S]*?\*\*Stage\*\*): Applied/, '$1: Offer')
      );

      markStatusChanged(dir, {
        msgId: '<fixture-stray-interview@mail>',
        matchedEntry: offerEntry,
        status: 'Interview',
        signal: 'interview scheduled',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      const data = parseApplications(dir);
      const entry = data.active.find(e => e.company === 'Realtor.com')!;
      assert.equal(entry.stage, 'Offer');
    });

    it('cross-format idempotency: flagForReview then markStatusChanged with same msg-id skips', () => {
      // Regression test for I5. msg-id previously stored by flagForReview as
      // **Message-ID**: <id> was invisible to markStatusChanged's idempotency
      // check, which only searched for `msg-id: <id>` in history entries.
      const msgId = '<fixture-cross-format@mail>';
      flagForReview(dir, {
        company: 'Atlassian',
        title: 'VP Engineering',
        signal: 'unfortunately',
        status: 'Rejected',
        sender: 'no-reply@greenhouse-mail.io',
        matchMethod: 'name',
        msgId,
        detectedAt: '2026-04-13',
      });
      const result = markStatusChanged(dir, {
        msgId,
        matchedEntry: atlassianActive,
        status: 'Rejected',
        signal: 'we\'ve decided to move forward',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      assert.equal(result.skipped, true);
      assert.equal(result.reason, 'msg-id already processed');

      const data = parseApplications(dir);
      // Atlassian should still be Active (wasn't rejected because we skipped)
      const active = data.active.find(e => e.company === 'Atlassian')!;
      assert.notEqual(active, undefined);
      assert.equal(active.stage, 'Applied');
    });

    it('cross-format idempotency: markStatusChanged then flagForReview with same msg-id skips', () => {
      const msgId = '<fixture-cross-format-2@mail>';
      markStatusChanged(dir, {
        msgId,
        matchedEntry: atlassianActive,
        status: 'Rejected',
        signal: 'we\'ve decided to move forward',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      const result = flagForReview(dir, {
        company: 'Atlassian',
        title: 'VP Engineering',
        signal: 'something',
        status: null,
        sender: 'no-reply@greenhouse.io',
        matchMethod: 'none',
        msgId,
        detectedAt: '2026-04-13',
      });
      assert.equal(result.skipped, true);
      assert.equal(result.reason, 'msg-id already processed');

      const data = parseApplications(dir);
      // No flagged entry should have been appended
      assert.equal((data.flagged || []).length, 0);
    });

    it('markStatusChanged with matchedEntry.section=closed is a silent skip (no throw, no mutation)', () => {
      // Regression test for C2. A courtesy rejection email for an already-closed
      // application used to throw `No active application matching "..."`.
      const before = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
      const result = markStatusChanged(dir, {
        msgId: '<fixture-closed-section@mail>',
        matchedEntry: {
          company: 'The New York Times',
          title: 'VP Engineering',
          url: null,
          stage: 'Closed (rejected)',
          section: 'closed',
        },
        status: 'Rejected',
        signal: 'we regret to inform',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      assert.equal(result.skipped, true);
      assert.match(result.reason!, /closed/);
      // File must be unchanged — no silent mutation of closed entries.
      const after = fs.readFileSync(path.join(dir, '2026-04-13-applications.md'), 'utf8');
      assert.equal(before, after);
    });

    it('markStatusChanged with matchedEntry.section=flagged is a silent skip', () => {
      const result = markStatusChanged(dir, {
        msgId: '<fixture-flagged-section@mail>',
        matchedEntry: {
          company: 'SomeCompany',
          title: 'Unknown',
          url: null,
          stage: null,
          section: 'flagged',
        },
        status: 'Rejected',
        signal: 'not moving forward',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      assert.equal(result.skipped, true);
      assert.match(result.reason!, /flagged/);
    });

    it('markStatusChanged(Rejected) on disappeared Active entry flags for review instead of throwing', () => {
      // Mid-batch race: entry was in Active at classify time, removed before
      // write. Must not throw — scan-email batch would crash.
      const result = markStatusChanged(dir, {
        msgId: '<fixture-missing-entry@mail>',
        matchedEntry: {
          company: 'NonexistentCo',
          title: 'VP Engineering',
          url: null,
          stage: 'Applied',
          section: 'active',
        },
        status: 'Rejected',
        signal: 'not moving forward',
        atsSender: 'greenhouse',
        detectedAt: '2026-04-13',
      });
      assert.equal(result.skipped, false);
      const data = parseApplications(dir);
      const flagged = data.flagged.find(e => e.msgId === '<fixture-missing-entry@mail>');
      assert.notEqual(flagged, undefined);
    });

    it('markStatusChanged throws when matchedEntry is missing', () => {
      // Fail-closed: no opts.matchedEntry is a programming error, not a
      // fallback to 'active'.
      assert.throws(
        () => markStatusChanged(dir, {
          msgId: '<fixture-no-match@mail>',
          status: 'Rejected',
          signal: 'not moving forward',
          atsSender: 'greenhouse',
          detectedAt: '2026-04-13',
        } as MarkStatusChangedInput),
        /matchedEntry is required/
      );
    });

    it('markStatusChanged throws when matchedEntry.section is missing', () => {
      assert.throws(
        () => markStatusChanged(dir, {
          msgId: '<fixture-no-section@mail>',
          // @ts-expect-error — intentionally constructing invalid input (no section) to assert runtime fail-closed
          matchedEntry: { company: 'X', title: 'Y', url: null, stage: 'Applied' },
          status: 'Rejected',
          signal: 'not moving forward',
          atsSender: 'greenhouse',
          detectedAt: '2026-04-13',
        }),
        /matchedEntry\.section is required/
      );
    });
  });
});

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    assert.equal(daysBetween('2026-05-04', '2026-05-04'), 0);
  });

  it('returns positive integer days for later "to" date', () => {
    assert.equal(daysBetween('2026-04-20', '2026-05-04'), 14);
  });

  it('returns negative for earlier "to" date', () => {
    assert.equal(daysBetween('2026-05-04', '2026-04-20'), -14);
  });

  it('handles month boundaries', () => {
    assert.equal(daysBetween('2026-04-30', '2026-05-02'), 2);
  });

  it('handles year boundaries', () => {
    assert.equal(daysBetween('2025-12-31', '2026-01-02'), 2);
  });

  it('throws on invalid input', () => {
    assert.throws(() => daysBetween('2026-05', '2026-05-04'), /YYYY-MM-DD/);
    assert.throws(() => daysBetween(null as unknown as string, '2026-05-04'), /YYYY-MM-DD/);
  });

  it('handles leap-day correctly (2024 is a leap year)', () => {
    assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  });

  it('handles non-leap-year February correctly (2025)', () => {
    assert.equal(daysBetween('2025-02-28', '2025-03-01'), 1);
  });

  it('throws on invalid month (13)', () => {
    assert.throws(() => daysBetween('2026-13-01', '2026-05-04'), /YYYY-MM-DD/);
  });

  it('throws on invalid day (Feb 30)', () => {
    assert.throws(() => daysBetween('2026-02-30', '2026-05-04'), /YYYY-MM-DD/);
  });

  it('throws on Feb 29 in non-leap year', () => {
    assert.throws(() => daysBetween('2025-02-29', '2025-03-01'), /YYYY-MM-DD/);
  });
});

describe('staleApplications', () => {
  const APPLICATIONS_FIXTURE = path.join(__dirname, 'fixtures', 'applications.md');
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-'));
    fs.cpSync(APPLICATIONS_FIXTURE, path.join(tmpDir, '2026-05-04-applications.md'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns active entries enriched with daysSinceLastActivity', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    for (const entry of result) {
      assert.ok(typeof entry.daysSinceLastActivity === 'number');
      assert.ok(entry.daysSinceLastActivity >= 0);
      assert.ok(entry.company);
      assert.ok(entry.stage);
    }
  });

  it('omits closed entries', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    for (const entry of result) {
      assert.ok(!entry.stage!.startsWith('Closed'));
    }
  });

  it('uses lastActivity.date when present (constructed inline since canonical fixture lacks the field)', () => {
    // The shared fixture has no `**Last Activity**` lines, so the canonical
    // priority path (lastActivity.date over applied) needs an inline fixture.
    // Without this, the original `if (e) { ... }` test would silently no-op.
    const lastActivityDir = fs.mkdtempSync(path.join(os.tmpdir(), 'last-activity-'));
    try {
      const md = `---\nformat_version: 1\nlast_updated: 2026-05-04\n---\n# Application Pipeline\n\nLast updated: 2026-05-04\n\n## Active Applications\n\n### Vector Co — VP Eng\n- **Stage**: Screen\n- **Applied**: 2026-04-01\n- **Last activity**: 2026-04-25 — Phone screen\n- **URL**: https://example.com/vector\n\n#### History\n- 2026-04-01: Applied — Submitted\n- 2026-04-25: Screen — Phone screen\n`;
      fs.writeFileSync(path.join(lastActivityDir, '2026-05-04-applications.md'), md);
      const result = staleApplications(lastActivityDir, { today: '2026-05-04' });
      const e = result.find(x => x.company === 'Vector Co')!;
      assert.ok(e, 'fixture must produce a Vector Co entry');
      assert.ok(e.lastActivity?.date, 'entry must carry lastActivity.date');
      // 2026-04-25 → 2026-05-04 is 9 days; using `applied` (2026-04-01)
      // would yield 33 days. Verifies lastActivity.date wins.
      assert.equal(e.daysSinceLastActivity, 9);
    } finally {
      fs.rmSync(lastActivityDir, { recursive: true, force: true });
    }
  });

  it('falls back to applied date when lastActivity is absent', () => {
    // Confirms the second leg of the fallback chain. Canonical fixture
    // active entries all carry lastActivity, so use an inline fixture
    // that omits it.
    const fallbackDir = fs.mkdtempSync(path.join(os.tmpdir(), 'applied-fallback-'));
    try {
      const md = `---\nformat_version: 1\nlast_updated: 2026-05-04\n---\n# Application Pipeline\n\nLast updated: 2026-05-04\n\n## Active Applications\n\n### Bare Co — VP Eng\n- **Stage**: Applied\n- **Applied**: 2026-04-15\n- **URL**: https://example.com/bare\n\n#### History\n- 2026-04-15: Applied — Submitted\n`;
      fs.writeFileSync(path.join(fallbackDir, '2026-05-04-applications.md'), md);
      const result = staleApplications(fallbackDir, { today: '2026-05-04' });
      const e = result.find(x => x.company === 'Bare Co')!;
      assert.ok(e, 'fixture must produce Bare Co entry');
      assert.ok(!e.lastActivity?.date, 'entry must NOT carry lastActivity.date');
      // 2026-04-15 → 2026-05-04 = 19 days.
      assert.equal(e.daysSinceLastActivity, 19);
    } finally {
      fs.rmSync(fallbackDir, { recursive: true, force: true });
    }
  });

  it('tags stalenessLevel when --warn and --alert provided', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04', warn: 14, alert: 21 });
    for (const entry of result) {
      assert.ok(['ok', 'warn', 'alert'].includes(entry.stalenessLevel!));
      if (entry.daysSinceLastActivity! >= 21) {
        assert.equal(entry.stalenessLevel, 'alert');
      } else if (entry.daysSinceLastActivity! >= 14) {
        assert.equal(entry.stalenessLevel, 'warn');
      } else {
        assert.equal(entry.stalenessLevel, 'ok');
      }
    }
  });

  it('omits stalenessLevel when thresholds not provided', () => {
    const result = staleApplications(tmpDir, { today: '2026-05-04' });
    for (const entry of result) {
      assert.equal(entry.stalenessLevel, undefined);
    }
  });

  it('throws when no applications file exists (distinct from empty pipeline)', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
    try {
      assert.throws(
        () => staleApplications(empty, { today: '2026-05-04' }),
        /No applications file found/
      );
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('returns [] for empty pipeline (file present, zero active entries)', () => {
    const emptyPipelineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-pipeline-'));
    try {
      const md = `---\nformat_version: 1\nlast_updated: 2026-05-04\n---\n# Application Pipeline\n\nLast updated: 2026-05-04\n`;
      fs.writeFileSync(path.join(emptyPipelineDir, '2026-05-04-applications.md'), md);
      assert.deepEqual(staleApplications(emptyPipelineDir, { today: '2026-05-04' }), []);
    } finally {
      fs.rmSync(emptyPipelineDir, { recursive: true, force: true });
    }
  });

  it('throws when only warn is provided (asymmetric thresholds)', () => {
    assert.throws(
      () => staleApplications(tmpDir, { today: '2026-05-04', warn: 14 }),
      /both warn and alert|alert.*required/i
    );
  });

  it('throws when only alert is provided (asymmetric thresholds)', () => {
    assert.throws(
      () => staleApplications(tmpDir, { today: '2026-05-04', alert: 21 }),
      /both warn and alert|warn.*required/i
    );
  });

  it('throws when warn >= alert (ordering violated)', () => {
    assert.throws(
      () => staleApplications(tmpDir, { today: '2026-05-04', warn: 21, alert: 14 }),
      /warn.*alert|threshold.*ord/i
    );
    assert.throws(
      () => staleApplications(tmpDir, { today: '2026-05-04', warn: 14, alert: 14 }),
      /warn.*alert|threshold.*ord/i
    );
  });

  it('per-entry resilience: corrupt date surfaces with error field, batch continues', () => {
    // Construct a fixture with one good entry and one entry whose Applied
    // date is malformed (passes parser, fails daysBetween's strict regex).
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-corrupt-'));
    try {
      const md = `---\nformat_version: 1\nlast_updated: 2026-05-04\n---\n# Application Pipeline\n\nLast updated: 2026-05-04\n\n## Active Applications\n\n### Good Co — VP Eng\n- **Stage**: Applied\n- **Applied**: 2026-04-20\n- **URL**: https://example.com/good\n\n#### History\n- 2026-04-20: Applied — Submitted\n\n### Bad Co — VP Eng\n- **Stage**: Applied\n- **Applied**: 04/20/2026\n- **URL**: https://example.com/bad\n\n#### History\n- 2026-04-20: Applied — Submitted\n`;
      fs.writeFileSync(path.join(corruptDir, '2026-05-04-applications.md'), md);

      const result = staleApplications(corruptDir, { today: '2026-05-04' });
      assert.equal(result.length, 2, 'both entries should surface (no batch-loss)');

      const good = result.find(e => e.company === 'Good Co')!;
      assert.equal(good.daysSinceLastActivity, 14);
      assert.equal(good.error, undefined);

      const bad = result.find(e => e.company === 'Bad Co')!;
      assert.equal(bad.daysSinceLastActivity, null);
      assert.match(bad.error!, /YYYY-MM-DD|invalid/i);
    } finally {
      fs.rmSync(corruptDir, { recursive: true, force: true });
    }
  });
});

describe('flagForReview — empty-payload guard', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-empty-'));
    const content = fs.readFileSync(path.join(__dirname, 'fixtures', 'status-emails', 'applications.md'), 'utf8');
    fs.writeFileSync(path.join(dir, '2026-04-13-applications.md'), content);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('throws when both company and msgId are missing (typo-protection)', () => {
    assert.throws(
      () => flagForReview(dir, { title: 'VP Eng', signal: 'rejected', status: 'Rejected' }),
      /company.*msgId|identif/i
    );
  });

  it('accepts when company is present even if msgId is missing', () => {
    const result = flagForReview(dir, { company: 'Acme', title: 'VP Eng' });
    assert.equal(result.skipped, false);
  });

  it('accepts when msgId is present even if company is missing', () => {
    const result = flagForReview(dir, { msgId: 'msg-only-1', title: 'VP Eng' });
    assert.equal(result.skipped, false);
  });
});
