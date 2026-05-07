# Posting Legitimacy Check

Filter ghost postings (left open with no intent to hire, or already filled)
before composing a digest or evaluation.

Adapted from [santifer/career-ops](https://github.com/santifer/career-ops)
Block G. Tracked in issue #68.

## Tiers

| Tier | Meaning | Action |
|------|---------|--------|
| Active | Low-risk posting | Include normally |
| Verify | Mixed signals | Include with status flag |
| Skip | Strong ghost indicators | Exclude from digest, list in footer with reason |

## MVP Signals

Implemented in `scripts/lib/legitimacy.ts` (pure function
`computeLegitimacyTier`) and `scripts/lib/seen-postings.ts`
(helper `countReposts`). Both have no network cost — they consume
data already pulled by Phase 1/2.

| Signal | Source | Constant |
|--------|--------|----------|
| Posting age (days) | `posted` field from ATS verification | `ACTIVE_AGE_MAX_DAYS=60`, `VERIFY_AGE_MAX_DAYS=120` |
| Repost count | `output/*-seen-postings.md` parsed via `countReposts` | `VERIFY_REPOST_COUNT=2`, `SKIP_REPOST_COUNT=3`, lookback `REPOST_LOOKBACK_DAYS=90` |

Thresholds reflect VP/Director roles, which legitimately stay open longer
than IC roles (60–120d is normal at the executive level).

## Tier rules

- **Skip** if any:
  - posting age > `VERIFY_AGE_MAX_DAYS`
  - repost count >= `SKIP_REPOST_COUNT`
  - posting age > `STALE_AGE_THRESHOLD_DAYS` (90) AND repost count >= `VERIFY_REPOST_COUNT`
- **Verify** if any (and not Skip):
  - posting date unknown
  - posting age >= `ACTIVE_AGE_MAX_DAYS`
  - repost count == `VERIFY_REPOST_COUNT`
- **Active** otherwise.

## Usage

```ts
import { computeLegitimacyTier } from '../../scripts/lib/legitimacy';
import { countReposts } from '../../scripts/lib/seen-postings';

const repostCount = countReposts(outputDir, {
  url: role.url,
  company: role.company,
  title: role.title,
});

const result = computeLegitimacyTier({
  posted: role.posted,
  today: getTodayUtc(),
  repostCount,
});
// result.tier ∈ 'Active' | 'Verify' | 'Skip'
// result.reasons: human-readable explanation strings
```

## Out of scope (PR 2+)

- Recent layoffs (WebSearch `"{company}" layoffs`)
- JD specificity heuristic (generic-boilerplate detection)
- Requirements realism (title/req mismatch)
- Per-candidate threshold overrides in `config/search.md`
