const ATS_SENDERS = {
  greenhouse: [/@greenhouse\.io$/i, /@greenhouse-mail\.io$/i],
  lever: [/@lever\.co$/i],
  ashby: [/@ashbyhq\.com$/i],
};

function matchAtsSender(sender) {
  if (!sender) return null;
  for (const [name, patterns] of Object.entries(ATS_SENDERS)) {
    if (patterns.some(re => re.test(sender))) return name;
  }
  return null;
}

function classifyStatusEmail(input) {
  const { sender } = input;
  const atsSender = matchAtsSender(sender);
  if (!atsSender) return null;

  return {
    tier: 'LOW',
    status: null,
    matchMethod: 'none',
    signal: null,
    atsSender,
    matchedEntry: null,
    msgId: input.msgId,
  };
}

module.exports = { classifyStatusEmail, ATS_SENDERS, matchAtsSender };
