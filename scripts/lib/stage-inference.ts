// Maps natural-language activity descriptions to canonical stage values.
// Source-of-truth stage list lives in scripts/lib/validators.ts (VALID_STAGES);
// this module exports INFERABLE_STAGES as the subset that natural-language
// inference can produce. Discovery and Research are excluded — both are
// derived from automated events (digest discovery, brief generation), not
// from email or activity text.
//
// Rules are first-match-wins. The ordering invariant is "later lifecycle
// stage first" — combined phrases resolve to the latest stage mentioned.
//
// Two canonical hazards motivating the ordering:
//   1. "got an offer, now negotiating" → Decision (not Offer). Decision
//      sits above Offer so the negotiating signal wins.
//   2. "applied for the final round" → Final Round (not Applied). Applied
//      sits last so it doesn't pre-empt later-stage phrases that happen
//      to also contain the word "applied".
//
// Add new rules with the later-stage-wins invariant in mind. Reordering
// breaks both hazards silently — tests pin each combined-phrase case.

import { VALID_STAGES, type Stage } from './validators';

const STAGE_CLOSED: Stage = 'Closed';
const STAGE_DECISION: Stage = 'Decision';
const STAGE_OFFER: Stage = 'Offer';
const STAGE_FINAL_ROUND: Stage = 'Final Round';
const STAGE_INTERVIEW_2: Stage = 'Interview (2+)';
const STAGE_INTERVIEW_1: Stage = 'Interview (1)';
const STAGE_SCREEN: Stage = 'Screen';
const STAGE_APPLIED: Stage = 'Applied';

export const INFERABLE_STAGES: readonly Stage[] = Object.freeze([
  STAGE_CLOSED, STAGE_DECISION, STAGE_OFFER, STAGE_FINAL_ROUND,
  STAGE_INTERVIEW_2, STAGE_INTERVIEW_1, STAGE_SCREEN, STAGE_APPLIED,
]);

// Module-load invariant: every inferable stage must be a valid stage.
// Catches schema drift if VALID_STAGES is renamed/reordered.
for (const s of INFERABLE_STAGES) {
  if (!(VALID_STAGES as readonly string[]).includes(s)) {
    throw new Error(`stage-inference: "${s}" not in VALID_STAGES (validators.ts drift)`);
  }
}

const RULES: ReadonlyArray<readonly [RegExp, Stage]> = [
  [/\b(rejected|ghosted|withdrew|withdrew the application|position closed)\b/i, STAGE_CLOSED],
  [/\b(negotiating|accepted|deciding)\b/i, STAGE_DECISION],
  [/\b(got an offer|made an offer)\b/i, STAGE_OFFER],
  [/\b(final round|exec interview|onsite)\b/i, STAGE_FINAL_ROUND],
  [/\b(second interview|another round|panel interview)\b/i, STAGE_INTERVIEW_2],
  [/\b(first interview|technical interview|met with hiring manager)\b/i, STAGE_INTERVIEW_1],
  [/\b(phone screen|recruiter call|initial call)\b/i, STAGE_SCREEN],
  [/\b(applied|submitted application)\b/i, STAGE_APPLIED],
];

/**
 * Infer the canonical stage for a natural-language activity description.
 * Returns one of INFERABLE_STAGES on a match, or `null` if no rule fires.
 * Throws on non-string input — that's a programmer error, distinct from
 * "the text didn't match anything." Callers logging "couldn't classify"
 * should never see a non-string slip through.
 *
 * @throws {TypeError} If `text` is not a string.
 */
export function inferStage(text: string): Stage | null {
  if (typeof text !== 'string') {
    throw new TypeError(`inferStage: text must be a string, got ${text === null ? 'null' : typeof text}`);
  }
  for (const [re, stage] of RULES) {
    if (re.test(text)) return stage;
  }
  return null;
}
