const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/.+/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export type ValidatorInput = Record<string, unknown>;

export function validateSeenPostingsEntry(entry: ValidatorInput): ValidationResult {
  const errors: string[] = [];

  if (!entry.company || typeof entry.company !== 'string' || !entry.company.trim()) {
    errors.push('company is required');
  } else if (entry.company.includes('|')) {
    errors.push('company must not contain pipe character (|)');
  }

  if (!entry.title || typeof entry.title !== 'string' || !entry.title.trim()) {
    errors.push('title is required');
  } else if (entry.title.includes('|')) {
    errors.push('title must not contain pipe character (|)');
  }

  if (entry.url !== null && entry.url !== undefined && !URL_RE.test(String(entry.url))) {
    errors.push('url must be a valid HTTP(S) URL or null');
  }

  if (entry.posted && !DATE_FORMAT_RE.test(String(entry.posted))) {
    errors.push('posted date must be in YYYY-MM-DD format');
  }
  if (entry.discovered && !DATE_FORMAT_RE.test(String(entry.discovered))) {
    errors.push('discovered date must be in YYYY-MM-DD format');
  }
  if (!entry.posted && !entry.discovered) {
    errors.push('either posted or discovered date (YYYY-MM-DD) is required');
  }

  return { valid: errors.length === 0, errors };
}

export function validatePreferencesEntry(entry: ValidatorInput): ValidationResult {
  const errors: string[] = [];

  if (!entry.section || typeof entry.section !== 'string' || !entry.section.trim()) {
    errors.push('section is required');
  }

  if (!entry.entries || !Array.isArray(entry.entries) || entry.entries.length === 0) {
    errors.push('entries must be a non-empty array');
  }

  return { valid: errors.length === 0, errors };
}

export const VALID_STAGES = [
  'Discovery',
  'Research',
  'Applied',
  'Screen',
  'Interview (1)',
  'Interview (2+)',
  'Final Round',
  'Offer',
  'Decision',
  'Closed',
] as const;

export type Stage = (typeof VALID_STAGES)[number];

export function validateApplicationEntry(entry: ValidatorInput): ValidationResult {
  const errors: string[] = [];

  if (!entry.company || typeof entry.company !== 'string' || !entry.company.trim()) {
    errors.push('company is required');
  } else if (entry.company.includes('|')) {
    errors.push('company must not contain pipe character (|)');
  }

  if (!entry.title || typeof entry.title !== 'string' || !entry.title.trim()) {
    errors.push('title is required');
  } else if (entry.title.includes('|')) {
    errors.push('title must not contain pipe character (|)');
  }

  if (!entry.stage || !(VALID_STAGES as readonly string[]).includes(String(entry.stage))) {
    errors.push(`stage must be one of: ${VALID_STAGES.join(', ')}`);
  }

  if (entry.url !== null && entry.url !== undefined && !URL_RE.test(String(entry.url))) {
    errors.push('url must be a valid HTTP(S) URL or null');
  }

  if (entry.applied && !DATE_FORMAT_RE.test(String(entry.applied))) {
    errors.push('applied date must be in YYYY-MM-DD format');
  }

  return { valid: errors.length === 0, errors };
}
