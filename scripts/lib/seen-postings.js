const fs = require('fs');
const path = require('path');

const URL_RE = /https?:\/\/[^\s|[\]]+/;
const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const SECTION_HEADER_RE = /^## (\d{4}-\d{2}-\d{2})(?:\s+\((.+)\))?/;
const POSTED_RE = /posted:(\d{4}-\d{2}-\d{2})/;
const DISCOVERED_RE = /discovered:(\d{4}-\d{2}-\d{2})/;
const SOURCE_RE = /source:([\w-]+)/;
const STAR_RE = /⭐/g;
const BRACKET_FLAG_RE = /\[([^\]]+)\]/g;

const KNOWN_STATUSES = [
  'Surfaced', 'Excluded', 'EXCLUDED', 'CLOSED', 'PASSED',
  'Skipped', 'Already seen',
];

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
  return m ? m[0].replace(/[,)]+$/, '') : null;
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

function extractStatus(text) {
  // Check for status patterns: "Excluded (...)", "CLOSED", "PASSED (...)", etc.
  // Also check for "Surfaced", "Skipped", "Already seen" in table rows
  for (const status of KNOWN_STATUSES) {
    const statusRe = new RegExp(`(?:^|\\|\\s*)${status}(?:\\s*\\(([^)]+)\\))?`, 'i');
    const m = text.match(statusRe);
    if (m) {
      return {
        status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() === 'Closed'
          ? status  // preserve original case for CLOSED
          : status.charAt(0).toUpperCase() + status.slice(1, status.length).replace(/^(.)/, c => c),
        detail: m[1] || null,
      };
    }
  }
  return { status: null, detail: null };
}

function extractStatusFromText(text) {
  // More nuanced status extraction that handles various patterns
  // "Excluded (reason)" "CLOSED" "PASSED (reason)" "Surfaced" "Skipped (reason)"

  // Check pipe-separated or standalone status keywords
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
  // Split by pipe, check each segment for known flag patterns
  const segments = text.split('|').map(s => s.trim());
  for (const seg of segments) {
    if (!seg) continue;

    // CLOSED as standalone pipe segment
    if (/^CLOSED\b/.test(seg) && !flags.includes('CLOSED')) {
      flags.push('CLOSED');
      continue;
    }

    // Known flags
    for (const flag of KNOWN_FLAGS) {
      if (seg === flag || seg.startsWith(flag + ' ')) {
        if (!flags.includes(flag) && !flags.some(f => f.startsWith(flag))) {
          // For APPLIED, include the date: "APPLIED 2026-04-04"
          if (flag === 'CLOSED' && seg !== 'CLOSED') continue;
          flags.push(seg.startsWith(flag) ? seg : flag);
        }
      }
    }

    // APPLIED with date
    if (/^APPLIED\s+\d{4}-\d{2}-\d{2}/.test(seg) && !flags.some(f => f.startsWith('APPLIED'))) {
      flags.push(seg.match(/^APPLIED\s+\d{4}-\d{2}-\d{2}/)[0]);
    }
  }

  return flags;
}

function parseTableRow(line, currentDate, sectionLabel) {
  // Parse: | Date Seen | Company | Title | URL | Status |
  const cells = line.split('|').map(c => c.trim()).filter(c => c);
  if (cells.length < 4) return null;

  // Skip header/separator rows
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
  // Strip leading "- "
  const content = line.replace(/^-\s+/, '');

  const url = extractUrl(content);
  const posted = extractPosted(content);
  const discovered = extractDiscovered(content);
  const source = extractSource(content);
  const stars = extractStars(content);
  const flags = extractFlags(content);
  const { status, detail } = extractStatusFromText(content);

  // Extract company and title from the beginning (pipe-delimited)
  const segments = content.split('|').map(s => s.trim());
  const company = segments[0] || null;
  let title = segments.length > 1 ? segments[1] : null;

  // Clean up title: remove "cover letter + resume generated" notes from Gen 1
  // In Gen 1, format is: Company | Title | notes | date | URL
  // In Gen 2, format is: Company | Title | Location | date | URL | status
  // In Gen 3, format is: Company | Title | URL | posted:date | flags...
  // We need to figure out which segment is the title vs other fields

  if (title) {
    // If title looks like a URL, location, date, or status, it's not the title
    if (URL_RE.test(title) || DATE_RE.test(title) || /^(Remote|Hybrid|On-site)/i.test(title)) {
      title = null;
    }
    // Gen 1: "cover letter + resume generated" is notes, not title
    if (title === 'cover letter + resume generated' || title === 'cover letter generated') {
      // Title is actually in the company field parsed wrong — re-examine
      // Actually in Gen 1: Company | Title | notes | date | URL
      // segments[0] = company, segments[1] = title, segments[2] = notes
      // This should be fine as-is since company is segments[0] and title is segments[1]
    }
  }

  // For Gen 1 with bracket flags, strip brackets from being parsed as part of URL
  let cleanUrl = url;
  if (cleanUrl) {
    cleanUrl = cleanUrl.replace(/\[.*$/, '').trim();
    // Also strip trailing slash only if it was added by accident
  }

  return makeEntry({
    company,
    title,
    url: cleanUrl || null,
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
  const lines = content.split('\n');
  const entries = [];
  let currentDate = null;
  let sectionLabel = null;
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Section header: ## YYYY-MM-DD or ## YYYY-MM-DD (label)
    const headerMatch = trimmed.match(SECTION_HEADER_RE);
    if (headerMatch) {
      currentDate = headerMatch[1];
      sectionLabel = headerMatch[2] || null;
      inTable = false;
      continue;
    }

    // Table header detection
    if (trimmed.startsWith('| Date') || trimmed.startsWith('|---')) {
      inTable = true;
      continue;
    }

    // Table row
    if (inTable && trimmed.startsWith('|') && !trimmed.startsWith('|---')) {
      const entry = parseTableRow(trimmed, currentDate, sectionLabel);
      if (entry) entries.push(entry);
      continue;
    }

    // Bullet entry
    if (trimmed.startsWith('- ') && trimmed.includes('|')) {
      inTable = false;
      const entry = parseBulletLine(trimmed, currentDate, sectionLabel);
      if (entry) entries.push(entry);
      continue;
    }

    // Non-matching line — reset table mode if not empty
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
  const pattern = /\d{4}-\d{2}-\d{2}-seen-postings\.md$/;
  // Also match gen1/gen2 fixture files that contain "seen-postings"
  const allPattern = /seen-postings\.md$/;

  const files = fs.readdirSync(dir)
    .filter(f => allPattern.test(f))
    .sort()  // chronological by filename
    .map(f => path.join(dir, f));

  const allEntries = [];
  for (const file of files) {
    const entries = parseSeenPostingsFile(file);
    allEntries.push(...entries);
  }

  // Sort chronologically by date
  allEntries.sort((a, b) => {
    const dateA = a.date || '0000-00-00';
    const dateB = b.date || '0000-00-00';
    return dateA.localeCompare(dateB);
  });

  return allEntries;
}

function resolveStateFile(dir, type) {
  const pattern = new RegExp(`\\d{4}-\\d{2}-\\d{2}-${type}\\.md$`);
  const files = fs.readdirSync(dir)
    .filter(f => pattern.test(f))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(dir, files[0]) : null;
}

function formatEntry(entry) {
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
  const { validateSeenPostingsEntry } = require('./validators');
  const result = validateSeenPostingsEntry(entry);
  if (!result.valid) {
    throw new Error(`Invalid entry: ${result.errors.join(', ')}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const line = formatEntry(entry);
  const existing = resolveStateFile(dir, 'seen-postings');

  if (existing) {
    let content = fs.readFileSync(existing, 'utf8');
    const todayHeader = `## ${today}`;

    if (content.includes(todayHeader)) {
      // Find the header and append after the last entry in that section
      const headerIdx = content.indexOf(todayHeader);
      const afterHeader = content.indexOf('\n', headerIdx) + 1;

      // Find where this section ends (next ## or end of file)
      const nextSection = content.indexOf('\n## ', afterHeader);
      const insertAt = nextSection !== -1 ? nextSection : content.length;

      // Ensure trailing newline before inserting
      const before = content.slice(0, insertAt);
      const after = content.slice(insertAt);
      content = before.trimEnd() + '\n' + line + '\n' + after;
    } else {
      // Add new date header at end of file
      content = content.trimEnd() + '\n\n' + todayHeader + '\n' + line + '\n';
    }

    fs.writeFileSync(existing, content);
  } else {
    // Create new file
    const fileName = `${today}-seen-postings.md`;
    const content = `# Job Search — Seen Postings\n\n## ${today}\n${line}\n`;
    fs.writeFileSync(path.join(dir, fileName), content);
  }
}

function flagSeenPosting(dir, url, flag) {
  const existing = resolveStateFile(dir, 'seen-postings');
  if (!existing) {
    return { success: false, error: `No seen-postings file found in ${dir}` };
  }

  const content = fs.readFileSync(existing, 'utf8');
  const lines = content.split('\n');
  let found = false;
  let alreadyFlagged = false;

  // Normalize the target URL for matching
  const normalizedTarget = normalizeUrl(url);

  for (let i = 0; i < lines.length; i++) {
    const lineUrl = extractUrl(lines[i]);
    if (lineUrl && normalizeUrl(lineUrl) === normalizedTarget) {
      found = true;

      // Check if flag already exists
      if (lines[i].includes(flag)) {
        alreadyFlagged = true;
        break;
      }

      // Append flag
      lines[i] = lines[i].trimEnd() + ' | ' + flag;
      break;
    }
  }

  if (!found) {
    return { success: false, error: `No entry found for URL: ${url}` };
  }

  if (!alreadyFlagged) {
    fs.writeFileSync(existing, lines.join('\n'));
  }

  return { success: true, alreadyFlagged };
}

function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Strip www., query params, trailing slash, fragments
    let host = u.hostname.replace(/^www\./, '');
    let pathname = u.pathname.replace(/\/$/, '');
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

  // 1. Exact URL match (normalized)
  if (url) {
    const normalizedTarget = normalizeUrl(url);
    const urlMatch = entries.find(e => e.url && normalizeUrl(e.url) === normalizedTarget);
    if (urlMatch) {
      return { duplicate: true, match: 'exact-url', existing: urlMatch };
    }
  }

  // 2. Company + title fuzzy match
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
  resolveStateFile,
  formatEntry,
  appendSeenPosting,
  flagSeenPosting,
  normalizeUrl,
  querySeenPostings,
  dedupCheck,
};
