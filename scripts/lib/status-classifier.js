const ATS_SENDERS = {
  greenhouse: [/@greenhouse\.io$/i, /@greenhouse-mail\.io$/i],
  lever: [/@lever\.co$/i],
  ashby: [/@ashbyhq\.com$/i],
};

// Priority 1 (highest) wins if multiple match.
//
// Rejected is priority 2 so that polite rejections — "we'd like to thank you for
// your interest, but we've decided to move forward with other candidates" —
// classify as Rejected and not as Interview. Soft interview phrases ("next
// steps", "we'd like to", "move forward with you") are intentionally absent
// because they collide with rejection templates; real interview invites that
// only carry soft phrases fall to LOW / Flagged for Review rather than
// auto-applying a wrong status. Lone /unfortunately/ is also removed — on its
// own it is ambiguous ("Unfortunately we need to reschedule your interview").
const SIGNAL_RULES = [
  {
    status: 'Offer',
    priority: 1,
    patterns: [/\boffer\b/i, /excited to extend/i],
  },
  {
    status: 'Rejected',
    priority: 2,
    patterns: [
      /not to move forward/i,
      /not moving forward/i,
      /will not be moving forward/i,
      /will not be advancing/i,
      /we'?ve decided to/i,
      /other candidates/i,
      /we regret to inform/i,
      /decided not to proceed/i,
    ],
  },
  {
    status: 'Interview',
    priority: 3,
    patterns: [/interview scheduled/i, /schedule your interview/i],
  },
  {
    status: 'Applied',
    priority: 4,
    patterns: [
      /application received/i,
      /thank you for applying/i,
      /received your application/i,
    ],
  },
];

function matchAtsSender(sender) {
  if (!sender) return null;
  for (const [name, patterns] of Object.entries(ATS_SENDERS)) {
    if (patterns.some(re => re.test(sender))) return name;
  }
  return null;
}

function extractSignal({ subject, body }) {
  const haystack = `${subject || ''}\n${body || ''}`;
  let best = null; // { priority, status, signal }
  for (const rule of SIGNAL_RULES) {
    for (const re of rule.patterns) {
      const m = haystack.match(re);
      if (m && (!best || rule.priority < best.priority)) {
        best = { priority: rule.priority, status: rule.status, signal: m[0] };
      }
    }
  }
  return best;
}

const URL_RE = /https?:\/\/[^\s<>"')]+/gi;

function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase();
    const pathname = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${host}${pathname}`;
  } catch {
    return null;
  }
}

function extractUrls(body) {
  if (!body) return [];
  const matches = body.match(URL_RE) || [];
  return matches.map(normalizeUrl).filter(Boolean);
}

// Iterates active and closed entries with their section label. Flagged
// entries are NOT yielded: a flagged entry is "we don't know what this
// is", so matching against one creates a silent-skip loop (classifier
// matches the old flagged entry, markStatusChanged skips because section
// isn't active, the new signal is lost). Real applications live in active
// or closed; match only against those. Order matters: active is preferred
// so a follow-up email to an active-but-also-previously-closed company
// picks the active entry first.
function* entriesForMatching(applicationsData) {
  for (const e of applicationsData.active || []) yield { entry: e, section: 'active' };
  for (const e of applicationsData.closed || []) yield { entry: e, section: 'closed' };
}

function matchByUrl(body, applicationsData) {
  const bodyUrls = new Set(extractUrls(body));
  if (bodyUrls.size === 0) return null;
  for (const pair of entriesForMatching(applicationsData)) {
    const entryUrl = normalizeUrl(pair.entry.url);
    if (entryUrl && bodyUrls.has(entryUrl)) return pair;
  }
  return null;
}

function normalizeName(name) {
  if (!name) return null;
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|corp|corporation|ltd|limited)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function extractCompanyFromSender({ sender, senderName, subject }) {
  // Prefer senderName display (strip "via Lever" / "Talent Acquisition" / etc.).
  if (senderName) {
    const cleaned = senderName
      .replace(/\s+via\s+(lever|greenhouse|ashby)/i, '')
      .replace(/\s+(talent acquisition|recruiting|careers|talent team)\s*$/i, '')
      .trim();
    if (cleaned && cleaned.toLowerCase() !== 'greenhouse' && cleaned.toLowerCase() !== 'lever' && cleaned.toLowerCase() !== 'ashby') {
      return cleaned;
    }
  }
  // Greenhouse pattern: {company}@greenhouse-mail.io
  if (sender) {
    const m = sender.match(/^([^@]+)@greenhouse-mail\.io$/i);
    if (m && m[1] !== 'no-reply') return m[1];
  }
  // Subject patterns. Stops only on em-dash (section separator) or specific
  // sentence continuations — NOT on ASCII hyphens, so "Acme-Corp" is preserved.
  if (subject) {
    const patterns = [
      /application to ([^—]+?)(?:\s+(?:has|was|is|for|role)\b|\s*—|\s*$)/i,
      /interview with ([^—]+?)(?:\s+(?:for|on|at)\b|\s*—|\s*$)/i,
    ];
    for (const re of patterns) {
      const m = subject.match(re);
      if (m) return m[1].trim();
    }
  }
  return null;
}

function matchByName({ sender, senderName, subject }, applicationsData) {
  const rawName = extractCompanyFromSender({ sender, senderName, subject });
  if (!rawName) return null;
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  for (const pair of entriesForMatching(applicationsData)) {
    if (normalizeName(pair.entry.company) === normalized) return pair;
  }
  return null;
}

// Projects a parsed applications.md entry to the minimal shape callers need,
// and freezes it so a caller can't mutate the pipeline through the classifier
// result reference.
function projectMatch(pair) {
  if (!pair) return null;
  return Object.freeze({
    company: pair.entry.company,
    title: pair.entry.title,
    url: pair.entry.url || null,
    stage: pair.entry.stage,
    section: pair.section,
  });
}

function classifyStatusEmail(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('classifyStatusEmail: input must be an object');
  }
  const { sender, senderName, subject, body, msgId, applicationsData } = input;
  // Missing sender is a programming error (upstream parser dropped the
  // header), not a classification result. Throw loudly so the CLI surfaces
  // it as classifier_failed instead of conflating it with a non-ATS null.
  if (typeof sender !== 'string' || !sender) {
    throw new TypeError('classifyStatusEmail: input.sender must be a non-empty string');
  }
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  const sig = extractSignal({ subject, body });
  const data = applicationsData || { active: [], closed: [], flagged: [] };

  const urlMatch = matchByUrl(body, data);
  const nameMatch = urlMatch ? null : matchByName({ sender, senderName, subject }, data);

  let tier = 'LOW';
  let matchMethod = 'none';
  let matchedEntry = null;

  if (urlMatch) {
    matchMethod = 'url';
    matchedEntry = projectMatch(urlMatch);
    if (sig) tier = 'HIGH';
  } else if (nameMatch) {
    matchMethod = 'name';
    matchedEntry = projectMatch(nameMatch);
    if (sig) tier = 'MEDIUM';
  }

  return Object.freeze({
    tier,
    status: sig ? sig.status : null,
    matchMethod,
    signal: sig ? sig.signal : null,
    atsSender,
    matchedEntry,
    msgId,
  });
}

module.exports = {
  classifyStatusEmail,
  ATS_SENDERS,
  SIGNAL_RULES,
  matchAtsSender,
  extractSignal,
  normalizeUrl,
  extractUrls,
  matchByUrl,
  normalizeName,
  extractCompanyFromSender,
  matchByName,
};
