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

function classifyStatusEmail(input) {
  const { sender, subject, body, msgId } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  const sig = extractSignal({ subject, body });

  return {
    tier: 'LOW',
    status: sig ? sig.status : null,
    matchMethod: 'none',
    signal: sig ? sig.signal : null,
    atsSender,
    matchedEntry: null,
    msgId,
  };
}

module.exports = { classifyStatusEmail, ATS_SENDERS, SIGNAL_RULES, matchAtsSender, extractSignal };
