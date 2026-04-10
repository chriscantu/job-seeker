const fs = require('fs');
const path = require('path');
const { resolveStateFile, atomicWriteFileSync, ensureDir } = require('./util');
const { parseFrontmatter, serializeFrontmatter } = require('./frontmatter');

const URL_RE = /https?:\/\/[^\s|[\]]+/;
const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const SECTION_HEADER_RE = /^## (\d{4}-\d{2}-\d{2})(?:\s+\((.+)\))?/;
const POSTED_RE = /posted:(\d{4}-\d{2}-\d{2})/;
const DISCOVERED_RE = /discovered:(\d{4}-\d{2}-\d{2})/;
const SOURCE_RE = /source:([\w-]+)/;
const STAR_RE = /⭐/g;
const BRACKET_FLAG_RE = /\[([^\]]+)\]/g;

const KNOWN_FLAGS = [
  'RESEARCHED', 'RESUME TAILORED', 'COVER LETTER', 'CLOSED',
];

function makeEntry(overrides) {
  return {
    company: null,
    title: null,
    url: null,
    date: null,
    posted: null,
    discovered: null,
    flags: [],
    stars: 0,
    source: null,
    status: null,
    statusDetail: null,
    sectionLabel: null,
    raw: null,
    ...overrides,
  };
}

function extractUrl(text) {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[,);]+$/, '') : null;
}

function extractStars(text) {
  const matches = text.match(STAR_RE);
  return matches ? matches.length : 0;
}

function extractPosted(text) {
  const m = text.match(POSTED_RE);
  return m ? m[1] : null;
}

function extractDiscovered(text) {
  const m = text.match(DISCOVERED_RE);
  return m ? m[1] : null;
}

function extractSource(text) {
  const m = text.match(SOURCE_RE);
  return m ? m[1] : null;
}

function extractStatusFromText(text) {
  const patterns = [
    { re: /\bExcluded\s*\(([^)]+)\)/i, status: 'Excluded' },
    { re: /\bExcluded\b/i, status: 'Excluded' },
    { re: /\bPASSED\s*\(([^)]+)\)/i, status: 'PASSED' },
    { re: /\bPASSED\b/i, status: 'PASSED' },
    { re: /\bSkipped\s*\(([^)]+)\)/i, status: 'Skipped' },
    { re: /\bSkipped\b/i, status: 'Skipped' },
    { re: /\bSurfaced\b/i, status: 'Surfaced' },
    { re: /\bAlready seen\b/i, status: 'Already seen' },
  ];

  for (const { re, status } of patterns) {
    const m = text.match(re);
    if (m) {
      return { status, detail: m[1] || null };
    }
  }

  return { status: null, detail: null };
}

function extractFlags(text) {
  const flags = [];

  // Extract square-bracket flags: [CLOSED], [ONSITE SF - SKIP], etc.
  const bracketMatches = [...text.matchAll(BRACKET_FLAG_RE)];
  for (const m of bracketMatches) {
    flags.push(m[1]);
  }

  // Extract pipe-delimited flags: | RESEARCHED | RESUME TAILORED | CLOSED | APPLIED 2026-04-04
  const segments = text.split('|').map(s => s.trim());
  for (const seg of segments) {
    if (!seg) continue;

    // Known flags
    for (const flag of KNOWN_FLAGS) {
      if (seg === flag || seg.startsWith(flag + ' ')) {
        if (flag === 'CLOSED' && seg !== 'CLOSED') continue;
        flags.push(seg.startsWith(flag) ? seg : flag);
      }
    }

    // APPLIED with date
    if (/^APPLIED\s+\d{4}-\d{2}-\d{2}/.test(seg)) {
      flags.push(seg.match(/^APPLIED\s+\d{4}-\d{2}-\d{2}/)[0]);
    }
  }

  return [...new Set(flags)];
}

function parseTableRow(line, currentDate, sectionLabel) {
  const cells = line.split('|').map(c => c.trim()).filter(c => c);
  if (cells.length < 4) return null;

  if (cells[0] === 'Date Seen' || cells[0].startsWith('---')) return null;

  const [dateSeen, company, title, url, ...rest] = cells;
  const statusText = rest.join(' | ');
  const { status, detail } = extractStatusFromText(statusText);

  return makeEntry({
    company,
    title,
    url: extractUrl(url) || extractUrl(line),
    date: dateSeen.match(DATE_RE) ? dateSeen.match(DATE_RE)[0] : currentDate,
    status,
    statusDetail: detail,
    sectionLabel,
    raw: line,
  });
}

function parseBulletLine(line, currentDate, sectionLabel) {
  const content = line.replace(/^-\s+/, '');

  const posted = extractPosted(content);
  const discovered = extractDiscovered(content);
  const source = extractSource(content);
  const stars = extractStars(content);
  const flags = extractFlags(content);
  const { status, detail } = extractStatusFromText(content);

  const segments = content.split('|').map(s => s.trim());
  const company = segments[0] || null;
  let title = segments.length > 1 ? segments[1] : null;

  if (title) {
    if (URL_RE.test(title) || DATE_RE.test(title) || /^(Remote|Hybrid|On-site)/i.test(title)) {
      title = null;
    }
  }

  // Extract URL and strip bracket artifacts from Gen 1 format
  const rawUrl = extractUrl(content);
  const url = rawUrl ? rawUrl.replace(/\[.*$/, '').trim() : null;

  return makeEntry({
    company,
    title,
    url: url || null,
    date: currentDate,
    posted,
    discovered,
    flags,
    stars,
    source,
    status,
    statusDetail: detail,
    sectionLabel,
    raw: line,
  });
}

function parseSeenPostingsContent(content) {
  const { body } = parseFrontmatter(content);
  const lines = body.split('\n');
  const entries = [];
  let currentDate = null;
  let sectionLabel = null;
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const headerMatch = trimmed.match(SECTION_HEADER_RE);
    if (headerMatch) {
      currentDate = headerMatch[1];
      sectionLabel = headerMatch[2] || null;
      inTable = false;
      continue;
    }

    if (trimmed.startsWith('| Date') || trimmed.startsWith('|---')) {
      inTable = true;
      continue;
    }

    if (inTable && trimmed.startsWith('|')) {
      const entry = parseTableRow(trimmed, currentDate, sectionLabel);
      if (entry) entries.push(entry);
      continue;
    }

    if (trimmed.startsWith('- ') && trimmed.includes('|')) {
      inTable = false;
      const entry = parseBulletLine(trimmed, currentDate, sectionLabel);
      if (entry) entries.push(entry);
      continue;
    }

    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('_') && !trimmed.startsWith('|')) {
      inTable = false;
    }
  }

  return entries;
}

function parseSeenPostingsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseSeenPostingsContent(content);
}

function parseSeenPostings(dir) {
  if (!fs.existsSync(dir)) return [];

  const pattern = /\d{4}-\d{2}-\d{2}-seen-postings\.md$/;
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .map(f => path.join(dir, f));

  const allEntries = [];
  for (const file of files) {
    const entries = parseSeenPostingsFile(file);
    allEntries.push(...entries);
  }

  allEntries.sort((a, b) => {
    const dateA = a.date || '0000-00-00';
    const dateB = b.date || '0000-00-00';
    return dateA.localeCompare(dateB);
  });

  return allEntries;
}

function formatEntry(entry) {
  const { validateSeenPostingsEntry } = require('./validators');
  const result = validateSeenPostingsEntry(entry);
  if (!result.valid) {
    throw new Error(`Invalid entry: ${result.errors.join(', ')}`);
  }

  const parts = [`- ${entry.company} | ${entry.title}`];

  if (entry.url) {
    parts.push(entry.url);
  }

  if (entry.posted) {
    parts.push(`posted:${entry.posted}`);
  } else if (entry.discovered) {
    parts.push(`discovered:${entry.discovered}`);
  }

  if (entry.source) {
    parts.push(`source:${entry.source}`);
  }

  if (entry.flags && entry.flags.length > 0) {
    for (const flag of entry.flags) {
      parts.push(flag);
    }
  }

  return parts.join(' | ');
}

function appendSeenPosting(dir, entry) {
  ensureDir(dir);

  const today = new Date().toISOString().slice(0, 10);
  const line = formatEntry(entry);
  const existing = resolveStateFile(dir, 'seen-postings');

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
      body = before.trimEnd() + '\n' + line + '\n' + after;
    } else {
      body = body.trimEnd() + '\n\n' + todayHeader + '\n' + line + '\n';
    }

    atomicWriteFileSync(existing, serializeFrontmatter(meta, body));
  } else {
    const fileName = `${today}-seen-postings.md`;
    const body = `# Job Search — Seen Postings\n\n## ${today}\n${line}\n`;
    const meta = { format_version: 1, last_updated: today };
    atomicWriteFileSync(path.join(dir, fileName), serializeFrontmatter(meta, body));
  }
}

function flagSeenPosting(dir, url, flag) {
  if (!fs.existsSync(dir)) {
    return { success: false, error: `Directory not found: ${dir}` };
  }

  const pattern = /\d{4}-\d{2}-\d{2}-seen-postings\.md$/;
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();

  if (files.length === 0) {
    return { success: false, error: `No seen-postings file found in ${dir}` };
  }

  const normalizedTarget = normalizeUrl(url);
  const today = new Date().toISOString().slice(0, 10);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta: existingMeta, body } = parseFrontmatter(raw);
    const lines = body.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const lineUrl = extractUrl(lines[i]);
      if (lineUrl && normalizeUrl(lineUrl) === normalizedTarget) {
        if (lines[i].includes(flag)) {
          return { success: true, alreadyFlagged: true };
        }

        lines[i] = lines[i].trimEnd() + ' | ' + flag;

        const meta = Object.keys(existingMeta).length > 0
          ? { ...existingMeta, format_version: Number(existingMeta.format_version) || 1, last_updated: today }
          : { format_version: 1, last_updated: today };

        atomicWriteFileSync(filePath, serializeFrontmatter(meta, lines.join('\n')));
        return { success: true, alreadyFlagged: false };
      }
    }
  }

  return { success: false, error: `No entry found for URL: ${url}` };
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const pathname = u.pathname.replace(/\/$/, '');
    return `${host}${pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

function querySeenPostings(dir, filters) {
  const entries = parseSeenPostings(dir);

  return entries.filter(entry => {
    if (filters.company) {
      if (!entry.company || !entry.company.toLowerCase().includes(filters.company.toLowerCase())) {
        return false;
      }
    }

    if (filters.flagged) {
      if (!entry.flags.some(f => f.startsWith(filters.flagged))) {
        return false;
      }
    }

    if (filters.notFlagged) {
      if (entry.flags.some(f => f.startsWith(filters.notFlagged))) {
        return false;
      }
    }

    return true;
  });
}

function dedupCheck(dir, { url, company, title } = {}) {
  const entries = parseSeenPostings(dir);

  if (url) {
    const normalizedTarget = normalizeUrl(url);
    const urlMatch = entries.find(e => e.url && normalizeUrl(e.url) === normalizedTarget);
    if (urlMatch) {
      return { duplicate: true, match: 'exact-url', existing: urlMatch };
    }
  }

  if (company && title) {
    const normCompany = company.toLowerCase().trim();
    const normTitle = title.toLowerCase().trim();
    const titleMatch = entries.find(e =>
      e.company && e.title &&
      e.company.toLowerCase().trim() === normCompany &&
      e.title.toLowerCase().trim() === normTitle
    );
    if (titleMatch) {
      return { duplicate: true, match: 'company-title', existing: titleMatch };
    }
  }

  return { duplicate: false };
}

module.exports = {
  parseSeenPostings,
  parseSeenPostingsFile,
  parseSeenPostingsContent,
  makeEntry,
  formatEntry,
  appendSeenPosting,
  flagSeenPosting,
  normalizeUrl,
  querySeenPostings,
  dedupCheck,
};
