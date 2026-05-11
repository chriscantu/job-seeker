import { daysBetween } from './util';

export const ACTIVE_AGE_MAX_DAYS = 60;
export const VERIFY_AGE_MAX_DAYS = 120;
export const STALE_AGE_THRESHOLD_DAYS = 90;
export const VERIFY_REPOST_COUNT = 2;
export const SKIP_REPOST_COUNT = 3;
export const REPOST_LOOKBACK_DAYS = 90;

export type LegitimacyTier = 'Active' | 'Verify' | 'Skip';

export interface LegitimacySignals {
  postingAgeDays: number | null;
  repostCount: number;
}

export interface LegitimacyResult {
  tier: LegitimacyTier;
  signals: LegitimacySignals;
  reasons: string[];
}

export interface LegitimacyInput {
  posted: string | null;
  today: string;
  repostCount: number;
}

export function computeLegitimacyTier(input: LegitimacyInput): LegitimacyResult {
  const { posted, today, repostCount } = input;

  let postingAgeDays: number | null = null;
  if (posted) {
    try {
      postingAgeDays = daysBetween(posted, today);
    } catch {
      postingAgeDays = null;
    }
  }

  const signals: LegitimacySignals = { postingAgeDays, repostCount };
  const reasons: string[] = [];

  if (postingAgeDays !== null && postingAgeDays > VERIFY_AGE_MAX_DAYS) {
    reasons.push(`posting ${postingAgeDays}d old (>${VERIFY_AGE_MAX_DAYS}d)`);
  }
  if (repostCount >= SKIP_REPOST_COUNT) {
    reasons.push(`reposted ${repostCount}× in last ${REPOST_LOOKBACK_DAYS}d`);
  }
  if (
    postingAgeDays !== null &&
    postingAgeDays > STALE_AGE_THRESHOLD_DAYS &&
    repostCount >= VERIFY_REPOST_COUNT
  ) {
    reasons.push(`stale ${postingAgeDays}d posting reposted ${repostCount}×`);
  }

  if (reasons.length > 0) {
    return { tier: 'Skip', signals, reasons };
  }

  if (postingAgeDays === null) {
    reasons.push('posting date unknown');
  }
  if (postingAgeDays !== null && postingAgeDays >= ACTIVE_AGE_MAX_DAYS) {
    reasons.push(`posting ${postingAgeDays}d old (>=${ACTIVE_AGE_MAX_DAYS}d)`);
  }
  if (repostCount === VERIFY_REPOST_COUNT) {
    reasons.push(`reposted ${repostCount}× in last ${REPOST_LOOKBACK_DAYS}d`);
  }

  if (reasons.length > 0) {
    return { tier: 'Verify', signals, reasons };
  }

  return { tier: 'Active', signals, reasons: [] };
}
