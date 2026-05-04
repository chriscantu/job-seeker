const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { inferStage } = require('../scripts/lib/stage-inference');

describe('inferStage', () => {
  const cases = [
    ['applied', 'Applied'],
    ['I just submitted application', 'Applied'],
    ['phone screen tomorrow', 'Screen'],
    ['recruiter call went well', 'Screen'],
    ['initial call scheduled', 'Screen'],
    ['first interview today', 'Interview (1)'],
    ['technical interview prep', 'Interview (1)'],
    ['met with hiring manager', 'Interview (1)'],
    ['second interview confirmed', 'Interview (2+)'],
    ['another round next week', 'Interview (2+)'],
    ['panel interview Friday', 'Interview (2+)'],
    ['final round next monday', 'Final Round'],
    ['exec interview at 3pm', 'Final Round'],
    ['onsite scheduled', 'Final Round'],
    ['got an offer!', 'Offer'],
    ['they made an offer', 'Offer'],
    ['negotiating comp', 'Decision'],
    ['accepted the role', 'Decision'],
    ['still deciding', 'Decision'],
    ['rejected via email', 'Closed'],
    ['ghosted for 4 weeks', 'Closed'],
    ['I withdrew', 'Closed'],
    ['position closed', 'Closed'],
  ];

  for (const [input, expected] of cases) {
    it(`maps "${input}" → ${expected}`, () => {
      assert.equal(inferStage(input), expected);
    });
  }

  it('returns null on unknown text', () => {
    assert.equal(inferStage('the weather is nice'), null);
  });

  it('returns null on non-string input', () => {
    assert.equal(inferStage(null), null);
    assert.equal(inferStage(undefined), null);
    assert.equal(inferStage(42), null);
  });

  it('first-match wins (rules ordered most-specific first)', () => {
    assert.equal(inferStage('second interview today'), 'Interview (2+)');
  });
});
