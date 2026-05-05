import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferStage, INFERABLE_STAGES } from '../scripts/lib/stage-inference';
import { VALID_STAGES } from '../scripts/lib/validators';

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

  it('throws on non-string input (programmer error, distinct from no-match)', () => {
    assert.throws(() => inferStage(null as unknown as string), /string/i);
    assert.throws(() => inferStage(undefined as unknown as string), /string/i);
    assert.throws(() => inferStage(42 as unknown as string), /string/i);
    assert.throws(() => inferStage({} as unknown as string), /string/i);
  });

  it('first-match wins (rules ordered most-specific first)', () => {
    assert.equal(inferStage('second interview today'), 'Interview (2+)');
  });

  it('combined phrase resolves to later lifecycle stage (Offer + Decision)', () => {
    assert.equal(inferStage('got an offer, now negotiating'), 'Decision');
  });

  it('combined phrase resolves to later lifecycle stage (Applied + Final Round)', () => {
    assert.equal(inferStage('applied for the final round'), 'Final Round');
  });
});

describe('INFERABLE_STAGES', () => {
  it('exports an array of stage strings', () => {
    assert.ok(Array.isArray(INFERABLE_STAGES));
    assert.ok(INFERABLE_STAGES.length > 0);
    for (const s of INFERABLE_STAGES) assert.equal(typeof s, 'string');
  });

  it('is a subset of VALID_STAGES (no schema drift)', () => {
    for (const s of INFERABLE_STAGES) {
      assert.ok(VALID_STAGES.includes(s), `INFERABLE_STAGES contains "${s}" not in VALID_STAGES`);
    }
  });

  it('every inferStage output value is in INFERABLE_STAGES', () => {
    const sampleHits = [
      'applied', 'phone screen', 'first interview', 'second interview',
      'final round', 'got an offer', 'negotiating', 'rejected',
    ];
    for (const text of sampleHits) {
      const stage = inferStage(text)!;
      assert.ok(INFERABLE_STAGES.includes(stage), `inferStage("${text}") = "${stage}" not in INFERABLE_STAGES`);
    }
  });
});
