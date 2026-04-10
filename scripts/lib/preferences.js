const fs = require('fs');
const path = require('path');
const { resolveStateFile, atomicWriteFileSync, ensureDir } = require('./util');
const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');

const DATE_HEADER_RE = /^## (\d{4}-\d{2}-\d{2})/;
const SUBSECTION_RE = /^### (.+)/;
const TABLE_HEADER_RE = /^\|[^|]+\|/;
const TABLE_SEP_RE = /^\|[-|]+\|/;

function parsePreferencesFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');

  const result = {
    last_run_date: null,
    sections: {},
    tables: [],
  };

  let currentDate = null;
  let currentSubsection = null;
  let inTopLevelTable = false;
  let currentTable = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const dateMatch = trimmed.match(DATE_HEADER_RE);
    if (dateMatch) {
      currentDate = dateMatch[1];
      currentSubsection = null;
      inTopLevelTable = false;

      if (!result.last_run_date || currentDate > result.last_run_date) {
        result.last_run_date = currentDate;
      }

      if (!result.sections[currentDate]) {
        result.sections[currentDate] = {};
      }
      continue;
    }

    const subMatch = trimmed.match(SUBSECTION_RE);
    if (subMatch && currentDate) {
      currentSubsection = subMatch[1];
      inTopLevelTable = false;
      if (!result.sections[currentDate][currentSubsection]) {
        result.sections[currentDate][currentSubsection] = [];
      }
      continue;
    }

    if (!currentDate && TABLE_HEADER_RE.test(trimmed) && !TABLE_SEP_RE.test(trimmed)) {
      if (!inTopLevelTable) {
        currentTable = { headers: [], rows: [] };
        const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
        currentTable.headers = cells;
        inTopLevelTable = true;
        result.tables.push(currentTable);
        continue;
      } else if (currentTable) {
        const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
        currentTable.rows.push(cells);
        continue;
      }
    }

    if (TABLE_SEP_RE.test(trimmed)) {
      continue;
    }

    if (inTopLevelTable && trimmed.startsWith('|') && currentTable) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
      currentTable.rows.push(cells);
      continue;
    }

    if (inTopLevelTable && trimmed && !trimmed.startsWith('|')) {
      inTopLevelTable = false;
      currentTable = null;
    }

    if (currentDate && currentSubsection && trimmed.startsWith('- ')) {
      result.sections[currentDate][currentSubsection].push(trimmed.slice(2));
      continue;
    }
  }

  return result;
}

function appendPreferences(dir, entry) {
  const { validatePreferencesEntry } = require('./validators');
  const validation = validatePreferencesEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid preferences entry: ${validation.errors.join(', ')}`);
  }

  ensureDir(dir);

  const today = new Date().toISOString().slice(0, 10);
  const existing = resolveStateFile(dir, 'preferences');

  const sectionContent = `### ${entry.section}\n${entry.entries.map(e => `- ${e}`).join('\n')}\n`;

  if (existing) {
    const raw = fs.readFileSync(existing, 'utf8');
    const { meta: existingMeta, body: content } = parseFrontmatter(raw);

    const meta = Object.keys(existingMeta).length > 0
      ? { ...existingMeta, format_version: Number(existingMeta.format_version) || 1, last_updated: today }
      : { format_version: 1, last_updated: today };

    const todayHeader = `## ${today}`;
    let body = content;

    if (body.includes(todayHeader)) {
      const headerIdx = body.indexOf(todayHeader);
      const afterHeader = body.indexOf('\n', headerIdx) + 1;
      const nextSection = body.indexOf('\n## ', afterHeader);
      const insertAt = nextSection !== -1 ? nextSection : body.length;

      const before = body.slice(0, insertAt);
      const after = body.slice(insertAt);
      body = before.trimEnd() + '\n\n' + sectionContent + after;
    } else {
      body = body.trimEnd() + '\n\n' + todayHeader + '\n' + sectionContent;
    }

    atomicWriteFileSync(existing, serializeFrontmatter(meta, body));
  } else {
    const fileName = `${today}-preferences.md`;
    const body = `# Job Search — Preferences & Source Effectiveness\n\n## ${today}\n${sectionContent}`;
    const meta = { format_version: 1, last_updated: today };
    atomicWriteFileSync(path.join(dir, fileName), serializeFrontmatter(meta, body));
  }
}

module.exports = {
  parsePreferencesFile,
  appendPreferences,
};
