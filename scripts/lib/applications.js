const fs = require('fs');
const path = require('path');
const { resolveStateFile, atomicWriteFileSync, ensureDir } = require('./util');
const { validateApplicationEntry, VALID_STAGES } = require('./validators');
const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');

const HEADING_RE = /^### (.+?) — (.+)$/;
const KEY_VALUE_RE = /^- \*\*(.+?)\*\*:\s*(.*)$/;
const HISTORY_RE = /^- (\d{4}-\d{2}-\d{2}):\s*(.+?)\s*—\s*(.+)$/;
const LAST_ACTIVITY_RE = /^(\d{4}-\d{2}-\d{2})\s*—\s*(.+)$/;
const CLOSED_STAGE_RE = /^Closed\s*\((\w+)\)$/;
const SECTION_RE = /^## (Active Applications|Closed Applications|Flagged for Review)$/;
const FLAGGED_HEADING_RE = /^### (.+?) — (.+?) — (\d{4}-\d{2}-\d{2})$/;

function makeEntry(overrides) {
  return {
    company: null,
    title: null,
    stage: null,
    applied: null,
    lastActivity: { date: null, detail: null },
    nextAction: null,
    contacts: '',
    url: null,
    notes: '',
    history: [],
    closed: null,
    ...overrides,
  };
}

function makeFlaggedEntry(overrides) {
  return {
    company: null,
    title: null,
    detectedAt: null,
    signal: null,
    status: null,
    sender: null,
    matchMethod: null,
    msgId: null,
    action: null,
    ...overrides,
  };
}

function parseApplicationsContent(content) {
  if (!content || !content.trim()) return { active: [], closed: [], flagged: [] };

  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');
  const result = { active: [], closed: [], flagged: [] };

  let currentSection = null; // 'active' | 'closed' | 'flagged'
  let currentEntry = null;
  let inHistory = false;
  let closedDate = null;
  let closedSummary = null;

  function finalizeEntry() {
    if (!currentEntry) return;

    // Attach closed object if applicable
    if (currentSection === 'closed' && currentEntry.stage) {
      const m = currentEntry.stage.match(CLOSED_STAGE_RE);
      currentEntry.closed = {
        date: closedDate,
        reason: m ? m[1] : null,
        summary: closedSummary,
      };
    }

    if (currentSection === 'flagged') {
      result.flagged.push(currentEntry);
    } else {
      result[currentSection].push(currentEntry);
    }
    currentEntry = null;
    inHistory = false;
    closedDate = null;
    closedSummary = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Section header
    const sectionMatch = trimmed.match(SECTION_RE);
    if (sectionMatch) {
      finalizeEntry();
      const name = sectionMatch[1];
      currentSection = name === 'Active Applications'
        ? 'active'
        : name === 'Closed Applications'
        ? 'closed'
        : 'flagged';
      continue;
    }

    if (!currentSection) continue;

    // Flagged section: parse flagged entries separately
    if (currentSection === 'flagged') {
      const fh = trimmed.match(FLAGGED_HEADING_RE);
      if (fh) {
        finalizeEntry();
        currentEntry = makeFlaggedEntry({
          company: fh[1].trim(),
          title: fh[2].trim(),
          detectedAt: fh[3].trim(),
        });
        continue;
      }

      if (!currentEntry) continue;
      if (trimmed === '---') continue;

      const kv = trimmed.match(KEY_VALUE_RE);
      if (kv) {
        const key = kv[1].trim().toLowerCase().replace(/\s+/g, '');
        const value = kv[2].trim();
        switch (key) {
          case 'detectedsignal': {
            const sigMatch = value.match(/^"(.+)"\s*→\s*(.+)$/);
            if (sigMatch) {
              currentEntry.signal = sigMatch[1];
              currentEntry.status = sigMatch[2].trim();
            } else {
              currentEntry.signal = value;
            }
            break;
          }
          case 'sender':
            currentEntry.sender = value || null;
            break;
          case 'matchmethod':
            // value may include parenthetical detail; keep the first token
            currentEntry.matchMethod = (value.split(/\s+/)[0] || value).toLowerCase() || null;
            break;
          case 'message-id':
          case 'messageid':
            currentEntry.msgId = value || null;
            break;
          case 'action':
            currentEntry.action = value || null;
            break;
        }
      }
      continue;
    }

    // Entry heading: ### Company — Title
    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      finalizeEntry();
      currentEntry = makeEntry({
        company: headingMatch[1].trim(),
        title: headingMatch[2].trim(),
      });
      inHistory = false;
      continue;
    }

    if (!currentEntry) continue;

    // Separator
    if (trimmed === '---') continue;

    // History subsection heading
    if (trimmed === '#### History') {
      inHistory = true;
      continue;
    }

    if (inHistory) {
      const histMatch = trimmed.match(HISTORY_RE);
      if (histMatch) {
        currentEntry.history.push({
          date: histMatch[1],
          stage: histMatch[2].trim(),
          detail: histMatch[3].trim(),
        });
      }
      continue;
    }

    // Key-value fields
    const kvMatch = trimmed.match(KEY_VALUE_RE);
    if (kvMatch) {
      const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, '');
      const value = kvMatch[2].trim();

      switch (key) {
        case 'stage':
          currentEntry.stage = value || null;
          break;
        case 'applied':
          currentEntry.applied = value || null;
          break;
        case 'lastactivity': {
          const laMatch = value.match(LAST_ACTIVITY_RE);
          if (laMatch) {
            currentEntry.lastActivity = { date: laMatch[1], detail: laMatch[2].trim() };
          } else {
            currentEntry.lastActivity = { date: null, detail: value || null };
          }
          break;
        }
        case 'nextaction':
          currentEntry.nextAction = value || null;
          break;
        case 'contacts':
          currentEntry.contacts = value; // keep as empty string if blank
          break;
        case 'url':
          currentEntry.url = value || null;
          break;
        case 'notes':
          currentEntry.notes = value; // keep as empty string if blank
          break;
        case 'closed':
          closedDate = value || null;
          break;
        case 'summary':
          closedSummary = value || null;
          break;
      }
    }
  }

  // Finalize the last entry
  finalizeEntry();

  return result;
}

function parseApplicationsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseApplicationsContent(content);
}

function parseApplications(dir) {
  if (!fs.existsSync(dir)) return { active: [], closed: [] };

  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) return { active: [], closed: [] };

  return parseApplicationsFile(filePath);
}

function formatApplication(entry) {
  const lines = [];
  lines.push(`### ${entry.company} — ${entry.title}`);
  lines.push('');
  lines.push(`- **Stage**: ${entry.stage || ''}`);
  lines.push(`- **Applied**: ${entry.applied || ''}`);

  const isClosed = entry.closed != null;

  if (!isClosed) {
    const laDate = entry.lastActivity && entry.lastActivity.date ? entry.lastActivity.date : '';
    const laDetail = entry.lastActivity && entry.lastActivity.detail ? entry.lastActivity.detail : '';
    const laValue = (laDate && laDetail) ? `${laDate} — ${laDetail}` : (laDate || laDetail || '');
    lines.push(`- **Last activity**: ${laValue}`);
    lines.push(`- **Next action**: ${entry.nextAction || ''}`);
    lines.push(`- **Contacts**: ${entry.contacts != null ? entry.contacts : ''}`);
    lines.push(`- **URL**: ${entry.url || ''}`);
    lines.push(`- **Notes**: ${entry.notes != null ? entry.notes : ''}`);
  } else {
    lines.push(`- **Closed**: ${entry.closed.date || ''}`);
    lines.push(`- **Summary**: ${entry.closed.summary || ''}`);
  }

  lines.push('');
  lines.push('#### History');
  lines.push('');
  for (const h of entry.history) {
    lines.push(`- ${h.date}: ${h.stage} — ${h.detail}`);
  }

  return lines.join('\n');
}

function formatFlagged(entry) {
  const lines = [];
  lines.push(`### ${entry.company} — ${entry.title || 'Unknown role'} — ${entry.detectedAt}`);
  lines.push('');
  const sigText = entry.signal && entry.status
    ? `"${entry.signal}" → ${entry.status}`
    : (entry.signal || '');
  lines.push(`- **Detected signal**: ${sigText}`);
  lines.push(`- **Sender**: ${entry.sender || ''}`);
  lines.push(`- **Match method**: ${entry.matchMethod || 'none'}`);
  lines.push(`- **Message-ID**: ${entry.msgId || ''}`);
  lines.push(`- **Action**: ${entry.action || 'Resolve manually — confirm which application this refers to, or dismiss if unrelated'}`);
  return lines.join('\n');
}

function formatApplicationsFile({ active, closed, flagged }) {
  const today = new Date().toISOString().slice(0, 10);
  const flaggedList = flagged || [];
  const parts = [];

  parts.push(`# Application Pipeline\n\nLast updated: ${today}\n`);

  parts.push('## Active Applications\n');
  if (active.length > 0) {
    parts.push(active.map(formatApplication).join('\n\n---\n\n'));
    parts.push('\n');
  }

  parts.push('\n## Closed Applications\n');
  if (closed.length > 0) {
    parts.push(closed.map(formatApplication).join('\n\n---\n\n'));
    parts.push('\n');
  }

  if (flaggedList.length > 0) {
    parts.push('\n## Flagged for Review\n');
    parts.push(flaggedList.map(formatFlagged).join('\n\n---\n\n'));
    parts.push('\n');
  }

  const body = parts.join('\n') + '\n';
  const meta = {
    format_version: 1,
    last_updated: today,
    active_count: active.length,
    closed_count: closed.length,
    flagged_count: flaggedList.length,
  };
  return serializeFrontmatter(meta, body);
}

function createApplication(dir, entry) {
  const validation = validateApplicationEntry(entry);
  if (!validation.valid) {
    throw new Error(`Invalid application entry: ${validation.errors.join(', ')}`);
  }

  ensureDir(dir);

  const today = new Date().toISOString().slice(0, 10);
  const applied = entry.applied || today;

  const newEntry = {
    ...makeEntry(),
    company: entry.company,
    title: entry.title,
    stage: entry.stage,
    applied,
    url: entry.url || null,
    notes: entry.notes || '',
    contacts: entry.contacts || '',
    nextAction: entry.nextAction || null,
    lastActivity: { date: applied, detail: `${entry.stage} — Added to pipeline` },
    history: [{ date: applied, stage: entry.stage, detail: 'Added to pipeline' }],
  };

  const existing = resolveStateFile(dir, 'applications');

  if (existing) {
    const data = parseApplicationsFile(existing);
    const dupe = [...data.active, ...data.closed].find(
      e => e.company.toLowerCase() === entry.company.toLowerCase()
        && e.title.toLowerCase() === entry.title.toLowerCase()
    );
    if (dupe) {
      throw new Error(`Application already exists: ${dupe.company} — ${dupe.title}`);
    }
    data.active.push(newEntry);
    atomicWriteFileSync(existing, formatApplicationsFile(data));
  } else {
    const fileName = `${today}-applications.md`;
    const data = { active: [newEntry], closed: [] };
    atomicWriteFileSync(path.join(dir, fileName), formatApplicationsFile(data));
  }
}

function findApplication(data, companyQuery) {
  const query = companyQuery.toLowerCase();
  const all = [...data.active, ...data.closed];
  const matches = all.filter(e => e.company.toLowerCase().includes(query));

  if (matches.length === 0) {
    throw new Error(`No application found matching "${companyQuery}"`);
  }
  if (matches.length > 1) {
    const names = matches.map(e => e.company).join(', ');
    throw new Error(`Multiple applications match "${companyQuery}": ${names}`);
  }
  return matches[0];
}

function findInSection(data, companyQuery, section) {
  const query = companyQuery.toLowerCase();
  const primary = data[section];
  const other = section === 'active' ? 'closed' : 'active';
  const matches = primary.filter(e => e.company.toLowerCase().includes(query));

  if (matches.length === 0) {
    const otherMatches = data[other].filter(e => e.company.toLowerCase().includes(query));
    if (otherMatches.length > 0) {
      const hint = section === 'active'
        ? 'it is closed — use the "reopen" command first'
        : 'it is active';
      throw new Error(`"${companyQuery}" not found in ${section} applications (${hint})`);
    }
    throw new Error(`No application found matching "${companyQuery}"`);
  }
  if (matches.length > 1) {
    const names = matches.map(e => e.company).join(', ');
    throw new Error(`Multiple applications match "${companyQuery}": ${names}`);
  }
  return matches[0];
}

function updateApplication(dir, { company, stage, detail }) {
  if (stage === 'Closed') {
    throw new Error('Cannot update stage to Closed directly — use the "close" command instead');
  }
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`stage must be one of: ${VALID_STAGES.join(', ')}`);
  }

  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  const data = parseApplicationsFile(filePath);
  const entry = findInSection(data, company, 'active');
  const today = new Date().toISOString().slice(0, 10);
  const detailText = detail || stage;

  entry.stage = stage;
  entry.lastActivity = { date: today, detail: detailText };
  entry.history.push({ date: today, stage, detail: detailText });

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
}

function closeApplication(dir, { company, reason, summary }) {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reason is required');
  }

  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  const data = parseApplicationsFile(filePath);
  const entry = findInSection(data, company, 'active');
  const today = new Date().toISOString().slice(0, 10);
  const closedStage = `Closed (${reason.trim()})`;
  const detailText = summary || reason;

  // Remove from active
  data.active = data.active.filter(e => e !== entry);

  // Update entry for closed section
  entry.stage = closedStage;
  entry.closed = { date: today, reason: reason.trim(), summary: summary || null };
  entry.lastActivity = { date: today, detail: detailText };
  entry.history.push({ date: today, stage: closedStage, detail: detailText });

  // Add to closed
  data.closed.push(entry);

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
}

function reopenApplication(dir, { company, stage, detail }) {
  if (stage === 'Closed') {
    throw new Error('Cannot reopen to Closed — use the "close" command instead');
  }
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`stage must be one of: ${VALID_STAGES.join(', ')}`);
  }

  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  const data = parseApplicationsFile(filePath);
  const entry = findInSection(data, company, 'closed');

  const today = new Date().toISOString().slice(0, 10);
  const detailText = detail || `Reopened at ${stage}`;

  // Remove from closed
  data.closed = data.closed.filter(e => e !== entry);

  // Update entry for active section
  entry.stage = stage;
  entry.closed = null;
  entry.lastActivity = { date: today, detail: detailText };
  entry.history.push({ date: today, stage, detail: detailText });

  // Add to active
  data.active.push(entry);

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
}

function hasMsgIdInHistory(filePath, msgId) {
  if (!msgId) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(`msg-id: ${msgId}`);
}

function flagForReview(dir, opts) {
  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  if (hasMsgIdInHistory(filePath, opts.msgId)) {
    // Check flagged section too via parse
    const existing = parseApplicationsFile(filePath);
    const dup = (existing.flagged || []).find(e => e.msgId === opts.msgId);
    if (dup) return { skipped: true };
  }

  const data = parseApplicationsFile(filePath);
  data.flagged = data.flagged || [];
  data.flagged.push({
    company: opts.company || 'Unknown',
    title: opts.title || 'Unknown role',
    detectedAt: opts.detectedAt || new Date().toISOString().slice(0, 10),
    signal: opts.signal || null,
    status: opts.status || null,
    sender: opts.sender || null,
    matchMethod: opts.matchMethod || 'none',
    msgId: opts.msgId || null,
    action: opts.action || null,
  });

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
  return { skipped: false };
}

function markStatusChanged(dir, opts) {
  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  if (hasMsgIdInHistory(filePath, opts.msgId)) {
    return { skipped: true };
  }

  const data = parseApplicationsFile(filePath);
  const query = opts.matchedCompany.toLowerCase();
  const detectedAt = opts.detectedAt || new Date().toISOString().slice(0, 10);
  const detail = `scan-email detected ${opts.atsSender} ${opts.newStatus.toLowerCase()} (msg-id: ${opts.msgId})`;

  if (opts.newStatus === 'Rejected') {
    const idx = data.active.findIndex(e => e.company.toLowerCase() === query);
    if (idx === -1) throw new Error(`No active application matching "${opts.matchedCompany}"`);
    const entry = data.active[idx];
    data.active.splice(idx, 1);

    entry.stage = 'Closed (rejected)';
    entry.closed = {
      date: detectedAt,
      reason: 'rejected',
      summary: `scan-email detected ${opts.atsSender} rejection: "${opts.signal}"`,
    };
    entry.lastActivity = { date: detectedAt, detail: `Closed (rejected) — ${opts.signal}` };
    entry.history.push({ date: detectedAt, stage: 'Closed (rejected)', detail });
    data.closed.push(entry);
  } else {
    const entry = data.active.find(e => e.company.toLowerCase() === query);
    if (!entry) throw new Error(`No active application matching "${opts.matchedCompany}"`);
    entry.stage = opts.newStatus;
    entry.lastActivity = { date: detectedAt, detail: `${opts.newStatus} — ${opts.signal}` };
    entry.history.push({ date: detectedAt, stage: opts.newStatus, detail });
  }

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
  return { skipped: false };
}

function addNote(dir, { company, note }) {
  if (!note || typeof note !== 'string' || !note.trim()) {
    throw new Error('note is required and must be a non-empty string');
  }

  const filePath = resolveStateFile(dir, 'applications');
  if (!filePath) throw new Error('No applications file found');

  const data = parseApplicationsFile(filePath);
  const entry = findApplication(data, company);

  const today = new Date().toISOString().slice(0, 10);

  entry.notes = entry.notes ? `${entry.notes}; ${note}` : note;
  entry.lastActivity = { date: today, detail: note };
  entry.history.push({ date: today, stage: entry.stage, detail: note });

  atomicWriteFileSync(filePath, formatApplicationsFile(data));
}

module.exports = {
  parseApplicationsContent,
  parseApplicationsFile,
  parseApplications,
  makeEntry,
  formatApplication,
  formatApplicationsFile,
  createApplication,
  findApplication,
  updateApplication,
  closeApplication,
  reopenApplication,
  addNote,
  flagForReview,
  markStatusChanged,
};
