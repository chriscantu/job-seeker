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
| Posting age (days) | `posted` field from ATS verification | `ACTIVE_AGE_MAX_DAYS=60`, `VERIFY_AGE_MAX_DAYS=120`, `STALE_AGE_THRESHOLD_DAYS=90` |
| Repost count | `output/*-seen-postings.md` parsed via `countReposts` | `VERIFY_REPOST_COUNT=2`, `SKIP_REPOST_COUNT=3`, lookback `REPOST_LOOKBACK_DAYS=90` |

Thresholds are set higher than IC roles to reflect longer executive
hiring cycles.

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

Skills invoke the check via the CLI wrapper, matching the pattern used
for `state.ts` and `cache.ts`:

```
echo '{"roles":[{"url":"...","company":"...","title":"...","posted":"YYYY-MM-DD"}]}' \
  | bun scripts/legitimacy-check.ts
```

Output is JSON: each role gets a `legitimacy: { tier, reasons, signals }`
field appended. `tier` is one of `'Active' | 'Verify' | 'Skip'`.

Library callers can use the modules directly:

```ts
import { computeLegitimacyTier } from '../../scripts/lib/legitimacy';
import { countReposts } from '../../scripts/lib/seen-postings';
import { getTodayUtc } from '../../scripts/lib/util';

const today = getTodayUtc();
const repostCount = countReposts(outputDir, {
  url: role.url,
  company: role.company,
  title: role.title,
  today,
});
const result = computeLegitimacyTier({
  posted: role.posted,
  today,
  repostCount,
});
```

## Out of scope (PR 2+)

- Recent layoffs (WebSearch `"{company}" layoffs`)
- JD specificity heuristic (generic-boilerplate detection)
- Requirements realism (title/req mismatch)
- Per-candidate threshold overrides in `config/search.md`
