const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parsePreferencesFile,
  appendPreferences,
} = require('../scripts/lib/preferences');
const { resolveStateFile } = require('../scripts/lib/util');

const FIXTURES = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(__dirname, 'tmp-prefs');

function setupTmpDir() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

function teardownTmpDir() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
}

describe('preferences parser', () => {
  it('extracts last_run_date from most recent section header', () => {
    const result = parsePreferencesFile(path.join(FIXTURES, 'sample-preferences.md'));
    assert.equal(result.last_run_date, '2026-04-09');
  });

  it('extracts date-headed sections', () => {
    const result = parsePreferencesFile(path.join(FIXTURES, 'sample-preferences.md'));
    assert.ok(result.sections['2026-04-08']);
    assert.ok(result.sections['2026-04-09']);
  });

  it('extracts subsections within date sections', () => {
    const result = parsePreferencesFile(path.join(FIXTURES, 'sample-preferences.md'));
    const section = result.sections['2026-04-08'];
    assert.ok(section['Source Effectiveness']);
    assert.ok(section['TheirStack Credits']);
  });

  it('captures subsection content as arrays', () => {
    const result = parsePreferencesFile(path.join(FIXTURES, 'sample-preferences.md'));
    const sourceEff = result.sections['2026-04-08']['Source Effectiveness'];
    assert.ok(Array.isArray(sourceEff));
    assert.ok(sourceEff.some(line => line.includes('TheirStack')));
  });

  it('extracts top-level tables', () => {
    const result = parsePreferencesFile(path.join(FIXTURES, 'sample-preferences.md'));
    assert.ok(result.tables);
    assert.ok(result.tables.length > 0);
  });

  it('returns empty sections when file has no date headers', () => {
    const result = parsePreferencesFile(path.join(FIXTURES, 'sample-preferences.md'));
    // All sections should be keyed by date
    for (const key of Object.keys(result.sections)) {
      assert.ok(/\d{4}-\d{2}-\d{2}/.test(key), `section key should be a date: ${key}`);
    }
  });
});

describe('preferences writer', () => {
  beforeEach(() => setupTmpDir());
  afterEach(() => teardownTmpDir());

  it('creates new file when none exists', () => {
    appendPreferences(TMP_DIR, {
      section: 'Source Effectiveness',
      entries: ['Indeed: 3 relevant roles', 'LinkedIn: 1 relevant role'],
    });

    const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('preferences'));
    assert.equal(files.length, 1);

    const content = fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8');
    assert.ok(content.includes('Source Effectiveness'));
    assert.ok(content.includes('Indeed: 3 relevant roles'));
  });

  it('appends to existing file under today header', () => {
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}-preferences.md`;
    fs.writeFileSync(path.join(TMP_DIR, fileName),
      `# Preferences\n\n## ${today}\n### Old Section\n- old data\n`
    );

    appendPreferences(TMP_DIR, {
      section: 'New Section',
      entries: ['new data'],
    });

    const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
    assert.ok(content.includes('Old Section'), 'should keep old section');
    assert.ok(content.includes('New Section'), 'should add new section');
    assert.ok(content.includes('new data'));
  });

  it('throws on invalid entry', () => {
    assert.throws(() => {
      appendPreferences(TMP_DIR, { section: '', entries: [] });
    });
  });
});

describe('frontmatter support', () => {
  it('parsePreferencesFile ignores frontmatter and parses body', () => {
    const tmpFile = path.join(TMP_DIR, '2026-04-09-preferences.md');
    setupTmpDir();
    fs.writeFileSync(tmpFile,
      `---\nformat_version: 1\nlast_updated: 2026-04-09\n---\n# Job Search — Preferences\n\n## 2026-04-09\n### Source Effectiveness\n- Indeed: 3 relevant roles\n`
    );

    const result = parsePreferencesFile(tmpFile);
    assert.equal(result.last_run_date, '2026-04-09');
    assert.ok(result.sections['2026-04-09']);
    assert.ok(result.sections['2026-04-09']['Source Effectiveness']);
    teardownTmpDir();
  });

  it('appendPreferences preserves existing frontmatter and updates last_updated', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}-preferences.md`;
    setupTmpDir();
    fs.writeFileSync(path.join(TMP_DIR, fileName),
      `---\nformat_version: 1\nlast_updated: 2026-01-01\n---\n# Preferences\n\n## ${today}\n### Old Section\n- old data\n`
    );

    appendPreferences(TMP_DIR, {
      section: 'New Section',
      entries: ['new data'],
    });

    const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    assert.equal(meta.format_version, '1');
    assert.equal(meta.last_updated, today);
    assert.ok(body.includes('Old Section'));
    assert.ok(body.includes('New Section'));
    teardownTmpDir();
  });

  it('appendPreferences backfills frontmatter when none exists', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}-preferences.md`;
    setupTmpDir();
    fs.writeFileSync(path.join(TMP_DIR, fileName),
      `# Preferences\n\n## ${today}\n### Old Section\n- old data\n`
    );

    appendPreferences(TMP_DIR, {
      section: 'New Section',
      entries: ['new data'],
    });

    const content = fs.readFileSync(path.join(TMP_DIR, fileName), 'utf8');
    const { meta } = parseFrontmatter(content);

    assert.equal(meta.format_version, '1');
    assert.equal(meta.last_updated, today);
    teardownTmpDir();
  });

  it('appendPreferences creates new file with frontmatter', () => {
    const { parseFrontmatter } = require('../scripts/lib/frontmatter');
    setupTmpDir();

    appendPreferences(TMP_DIR, {
      section: 'Source Effectiveness',
      entries: ['Indeed: 3 relevant roles'],
    });

    const files = fs.readdirSync(TMP_DIR).filter(f => f.includes('preferences'));
    const content = fs.readFileSync(path.join(TMP_DIR, files[0]), 'utf8');
    const { meta, body } = parseFrontmatter(content);

    assert.equal(meta.format_version, '1');
    assert.ok(meta.last_updated);
    assert.ok(body.includes('Source Effectiveness'));
    teardownTmpDir();
  });
});
