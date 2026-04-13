const ATS_SENDERS = {
  greenhouse: [/@greenhouse\.io$/i, /@greenhouse-mail\.io$/i],
  lever: [/@lever\.co$/i],
  ashby: [/@ashbyhq\.com$/i],
};

// Priority 1 (highest) wins if multiple match.
const SIGNAL_RULES = [
  {
    status: 'Offer',
    priority: 1,
    patterns: [/\boffer\b/i, /excited to extend/i],
  },
  {
    status: 'Interview',
    priority: 2,
    patterns: [/interview scheduled/i, /schedule your interview/i],
  },
  {
    status: 'Interview',
    priority: 3,
    patterns: [/move forward with you\b/i, /next steps/i, /we'?d like to/i],
  },
  {
    status: 'Rejected',
    priority: 4,
    patterns: [
      /not to move forward/i,
      /not moving forward/i,
      /we'?ve decided/i,
      /will not be moving forward/i,
      /unfortunately/i,
      /other candidates/i,
    ],
  },
  {
    status: 'Applied',
    priority: 5,
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

function allEntries(applicationsData) {
  return [
    ...(applicationsData.active || []),
    ...(applicationsData.closed || []),
    ...(applicationsData.flagged || []),
  ];
}

function matchByUrl(body, applicationsData) {
  const bodyUrls = new Set(extractUrls(body));
  if (bodyUrls.size === 0) return null;
  for (const entry of allEntries(applicationsData)) {
    const entryUrl = normalizeUrl(entry.url);
    if (entryUrl && bodyUrls.has(entryUrl)) {
      return entry;
    }
  }
  return null;
}

function classifyStatusEmail(input) {
  const { sender, subject, body, msgId, applicationsData } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  const sig = extractSignal({ subject, body });

  const urlMatch = matchByUrl(body, applicationsData || { active: [], closed: [], flagged: [] });

  let tier = 'LOW';
  let matchMethod = 'none';
  let matchedEntry = null;

  if (urlMatch) {
    matchMethod = 'url';
    matchedEntry = urlMatch;
    if (sig) tier = 'HIGH';
  }

  return {
    tier,
    status: sig ? sig.status : null,
    matchMethod,
    signal: sig ? sig.signal : null,
    atsSender,
    matchedEntry,
    msgId,
  };
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
};
