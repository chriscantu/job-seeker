// scripts/lib/sender-classifier.ts
//
// Heuristic classifier for sender domains discovered by the audit CLI.
// Takes a sender domain + sample data and suggests which auto-trash table
// it belongs in, with a confidence level.
//
// Classification is ordered by specificity:
//   1. Known domain lists → high confidence
//   2. Heuristic signals (noreply@, high count, templated subjects) → medium
//   3. Fallback → unknown / low

export type SenderCategory = 'job-alert' | 'staffing' | 'marketing' | 'unknown';
export type Confidence = 'high' | 'medium' | 'low';

export interface ClassifySenderInput {
  domain: string;
  fromAddresses: string[];
  messageCount: number;
  subjects: string[];
}

export interface ClassifySenderResult {
  suggestedCategory: SenderCategory;
  confidence: Confidence;
}

// Known domains grouped by category. Entries match the domain itself or
// any subdomain (mail.glassdoor.com matches glassdoor.com). This is
// intentionally conservative — only well-known, unambiguous domains.
export const KNOWN_DOMAINS: Record<Exclude<SenderCategory, 'unknown'>, string[]> = {
  'job-alert': [
    'glassdoor.com',
    'indeed.com',
    'ziprecruiter.com',
    'wellfound.com',
    'remotehunter.com',
    'builtin.com',
    'otta.com',
    'dice.com',
    'monster.com',
    'careerbuilder.com',
    'linkedin.com',
  ],
  staffing: [
    'lensa.com',
    'hackajob.co',
    'jobgether.com',
    'echojobs.io',
    'jobera.com',
    'simplyhired.com',
    'remoterocketship.com',
    'ladders.com',
    'theladders.com',
  ],
  marketing: [
    'topresume.com',
    'resumegenius.com',
    'zety.com',
    'resume.io',
    'novoresume.com',
  ],
};

// Automated sender local-part prefixes — signals that the sender is a
// system, not a person.
export const AUTOMATED_LOCAL_PARTS = [
  'noreply',
  'no-reply',
  'notifications',
  'alerts',
  'jobalerts',
  'jobs-noreply',
  'jobs-listings',
  'team',
  'updates',
  'digest',
  'mailer',
];

// Check if `domain` matches or is a subdomain of any entry in `domainList`.
// "mail.glassdoor.com" matches "glassdoor.com".
// "notglassdoor.com" does NOT match "glassdoor.com".
export function matchesDomainList(domain: string, domainList: string[]): boolean {
  const lower = domain.toLowerCase();
  for (const known of domainList) {
    if (lower === known || lower.endsWith('.' + known)) {
      return true;
    }
  }
  return false;
}

// Check if any fromAddress has an automated local-part (exact match or
// delimited by `-` or `+`, e.g. `noreply`, `noreply-bounces`).
export function hasAutomatedLocalPart(fromAddresses: string[]): boolean {
  for (const addr of fromAddresses) {
    const local = addr.split('@')[0].toLowerCase();
    for (const prefix of AUTOMATED_LOCAL_PARTS) {
      if (local === prefix || local.startsWith(prefix + '-') || local.startsWith(prefix + '+')) {
        return true;
      }
    }
  }
  return false;
}

// Check if subjects are templated (many similar subjects).
export function hasTemplatedSubjects(subjects: string[]): boolean {
  if (subjects.length < 3) return false;
  // If 50%+ of subjects share the same first 10 characters, likely templated.
  const prefixes = subjects.map((s) => s.slice(0, 10).toLowerCase());
  const counts: Record<string, number> = {};
  for (const p of prefixes) {
    counts[p] = (counts[p] || 0) + 1;
  }
  const maxCount = Math.max(...Object.values(counts));
  return maxCount / subjects.length >= 0.5;
}

export function classifySender({ domain, fromAddresses, messageCount, subjects }: ClassifySenderInput): ClassifySenderResult {
  // 1. Known domain lists — high confidence
  for (const [category, domainList] of Object.entries(KNOWN_DOMAINS)) {
    if (matchesDomainList(domain, domainList)) {
      return { suggestedCategory: category as SenderCategory, confidence: 'high' };
    }
  }

  // 2. Heuristic signals — medium confidence.
  // All heuristic-tier results default to 'marketing' — expand categories
  // when domain-specific heuristics are added.
  const isAutomated = hasAutomatedLocalPart(fromAddresses);
  const isHighVolume = messageCount >= 5;
  const isTemplated = hasTemplatedSubjects(subjects);

  if (isAutomated && isHighVolume) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }
  if (isAutomated && isTemplated) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }
  if (isHighVolume && isTemplated) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }
  // Automated sender with moderate volume (lower threshold than isHighVolume)
  if (isAutomated && messageCount >= 3) {
    return { suggestedCategory: 'marketing', confidence: 'medium' };
  }

  // 3. Fallback — unknown / low
  return { suggestedCategory: 'unknown', confidence: 'low' };
}
