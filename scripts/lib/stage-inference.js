// Maps natural-language activity descriptions to the canonical stage values
// from skills/application-tracker/pipeline-schema.md (lines 43-54).
//
// Order matters: more specific patterns must come before broader ones so
// that e.g. "second interview" matches Interview (2+) before any broader
// "interview" rule could fire.

const RULES = [
  [/\b(rejected|ghosted|withdrew|withdrew the application|position closed)\b/i, 'Closed'],
  [/\b(negotiating|accepted|deciding)\b/i, 'Decision'],
  [/\b(got an offer|made an offer)\b/i, 'Offer'],
  [/\b(final round|exec interview|onsite)\b/i, 'Final Round'],
  [/\b(second interview|another round|panel interview)\b/i, 'Interview (2+)'],
  [/\b(first interview|technical interview|met with hiring manager)\b/i, 'Interview (1)'],
  [/\b(phone screen|recruiter call|initial call)\b/i, 'Screen'],
  [/\b(applied|submitted application)\b/i, 'Applied'],
];

function inferStage(text) {
  if (typeof text !== 'string') return null;
  for (const [re, stage] of RULES) {
    if (re.test(text)) return stage;
  }
  return null;
}

module.exports = { inferStage };
