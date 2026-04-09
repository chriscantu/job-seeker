const fs = require('fs');
const path = require('path');

const DATE_HEADER_RE = /^## (\d{4}-\d{2}-\d{2})/;
const SUBSECTION_RE = /^### (.+)/;
const TABLE_HEADER_RE = /^\|[^|]+\|/;
const TABLE_SEP_RE = /^\|[-|]+\|/;

function resolveStateFile(dir, type) {
  const pattern = new RegExp(`\\d{4}-\\d{2}-\\d{2}-${type}\\.md$`);
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function parsePreferencesFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const result = {
    last_run_date: null,
    sections: {},
    tables: [],
  };

  let currentDate = null;
  let currentSubsection = null;
  let inTopLevelTable = false;
  let currentTable = null;
  let lastRunDate = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Date header: ## YYYY-MM-DD
    const dateMatch = trimmed.match(DATE_HEADER_RE);
    if (dateMatch) {
      currentDate = dateMatch[1];
      currentSubsection = null;
      inTopLevelTable = false;

      // Track most recent date
      if (!lastRunDate || currentDate > lastRunDate) {
        lastRunDate = currentDate;
      }

      if (!result.sections[currentDate]) {
        result.sections[currentDate] = {};
      }
      continue;
    }

    // Subsection: ### Title (only within a date section)
    const subMatch = trimmed.match(SUBSECTION_RE);
    if (subMatch && currentDate) {
      currentSubsection = subMatch[1];
      inTopLevelTable = false;
      if (!result.sections[currentDate][currentSubsection]) {
        result.sections[currentDate][currentSubsection] = [];
      }
      continue;
    }

    // Top-level table (before any date header)
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

    // Table separator — skip
    if (TABLE_SEP_RE.test(trimmed)) {
      continue;
    }

    // Table row continuation (within top-level table)
    if (inTopLevelTable && trimmed.startsWith('|') && currentTable) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c);
      currentTable.rows.push(cells);
      continue;
    }

    // Non-table, non-header content ends top-level table mode
    if (inTopLevelTable && trimmed && !trimmed.startsWith('|')) {
      inTopLevelTable = false;
      currentTable = null;
    }

    // Bullet content within a subsection
    if (currentDate && currentSubsection && trimmed.startsWith('- ')) {
      result.sections[currentDate][currentSubsection].push(trimmed.slice(2));
      continue;
    }
  }

  result.last_run_date = lastRunDate;
  return result;
}

function appendPreferences(dir, entry) {
  const { validatePreferencesEntry } = require('./validators');
  const validation = validatePreferencesEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid preferences entry: ${validation.errors.join(', ')}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const existing = resolveStateFile(dir, 'preferences');

  const sectionContent = `### ${entry.section}\n${entry.entries.map(e => `- ${e}`).join('\n')}\n`;

  if (existing) {
    let content = fs.readFileSync(existing, 'utf8');
    const todayHeader = `## ${today}`;

    if (content.includes(todayHeader)) {
      // Append new subsection at end of today's section
      const headerIdx = content.indexOf(todayHeader);
      const afterHeader = content.indexOf('\n', headerIdx) + 1;

      // Find where today's section ends (next ## or end of file)
      const nextSection = content.indexOf('\n## ', afterHeader);
      const insertAt = nextSection !== -1 ? nextSection : content.length;

      const before = content.slice(0, insertAt);
      const after = content.slice(insertAt);
      content = before.trimEnd() + '\n\n' + sectionContent + after;
    } else {
      content = content.trimEnd() + '\n\n' + todayHeader + '\n' + sectionContent;
    }

    fs.writeFileSync(existing, content);
  } else {
    const fileName = `${today}-preferences.md`;
    const content = `# Job Search — Preferences & Source Effectiveness\n\n## ${today}\n${sectionContent}`;
    fs.writeFileSync(path.join(dir, fileName), content);
  }
}

module.exports = {
  parsePreferencesFile,
  appendPreferences,
  resolveStateFile,
};
