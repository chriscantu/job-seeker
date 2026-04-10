# Phase Checkpointing — Design Spec

**Issue**: #35
**Date**: 2026-04-10
**Status**: Approved

## Problem

When a multi-phase skill (daily-digest, scan-email, resume-tailor) fails partway
through, the entire run restarts from scratch — re-issuing API calls, re-fetching
data, and wasting TheirStack credits on work that already completed successfully.

## Approach

**Thin cache script + skill instructions (Option B)**: A `scripts/cache.js` CLI
utility handles read/write/expiry/cleanup of phase results. Skills call it via
`bun scripts/cache.js read|write ...` at phase boundaries. Cache files are JSON
stored in `output/.cache/`.

Rejected alternatives:
- **A (instructions only)**: Claude would need to do timestamp math and file I/O
  in its head — error-prone, no enforcement.
- **C (shared skill module only)**: Better than A but still relies on Claude
  interpreting the protocol correctly with no testable enforcement.

## Decisions

- **Expiry**: 2 hours (`CACHE_TTL_MS = 7_200_000`). Long enough to step away and
  come back; short enough that stale data from yesterday is never served.
- **User confirmation**: Skills always prompt before resuming from cache. User can
  say "fresh" to ignore cache and run from scratch.
- **No configurability**: Expiry is hardcoded. YAGNI — one TTL serves all skills.
- **File naming**: `output/.cache/<skill>-<phase>.json`
- **Architecture**: CLI entrypoint (`scripts/cache.js`) routes to logic module
  (`scripts/lib/cache.js`), following the `state.js` / `lib/*.js` pattern.

## CLI Interface

### `read <skill> <phase>`

Reads `output/.cache/<skill>-<phase>.json`. If file exists and is within TTL,
prints the cached data as JSON to stdout and exits 0. If missing or expired,
exits 1 with no output.

```
$ bun scripts/cache.js read daily-digest phase1
{"cached_at":"2026-04-10T09:05:00.000Z","data":{"roles":[...]}}

$ bun scripts/cache.js read daily-digest phase1
(exit code 1 — expired or missing)
```

### `write <skill> <phase> '<json>'`

Validates JSON, writes to `output/.cache/<skill>-<phase>.json` with metadata.
Uses `atomicWriteFileSync`. Prints `{"success":true}`.

```
$ bun scripts/cache.js write daily-digest phase1 '{"roles":[...]}'
{"success":true}
```

### `list [skill]`

Lists all cache files with age. Optional skill filter.

```
$ bun scripts/cache.js list
daily-digest/phase1  2026-04-10 09:05  (47 min ago)
daily-digest/phase2  2026-04-10 09:08  (44 min ago)
```

### `clean [skill]`

Removes all cache files, or just for a specific skill. Reports count removed.

```
$ bun scripts/cache.js clean daily-digest
Removed 2 cache files
```

## Cache File Format

```json
{
  "skill": "daily-digest",
  "phase": "phase1",
  "cached_at": "2026-04-10T09:05:00.000Z",
  "expires_at": "2026-04-10T11:05:00.000Z",
  "data": { ... }
}
```

- `cached_at` / `expires_at`: ISO 8601 timestamps
- `data`: Arbitrary JSON — the phase result payload
- `skill` / `phase`: Metadata for `list` display and `clean` filtering

## Skill Integration

Each skill gets two additions: a cache-read check at start, and cache-write
calls after each cacheable phase.

### daily-digest — 2 cacheable phases

**Start**: `bun scripts/cache.js read daily-digest phase1`
- Hit: "Phase 1 cached at {time} — {N} roles discovered. Resume from Phase 2?"
- Miss: Run Phase 1 normally

**After Phase 1 (discovery)**: `bun scripts/cache.js write daily-digest phase1 '<json>'`
- Cache: raw candidate list + source metadata

**Before Phase 2**: `bun scripts/cache.js read daily-digest phase2`
- Hit: "Phase 2 cached at {time}. Resume from Phase 3 (compose)?"
- Miss: Run Phase 2 normally

**After Phase 2 (verification)**: `bun scripts/cache.js write daily-digest phase2 '<json>'`
- Cache: verified URLs + closed postings

### scan-email — 1 cacheable phase

**Start**: `bun scripts/cache.js read scan-email body-fetch`
- Hit: "Body fetch cached at {time} — {N} roles extracted. Resume from dedup?"
- Miss: Run Phases 1-3 normally

**After Phases 2-3 (metadata + body fetch)**: `bun scripts/cache.js write scan-email body-fetch '<json>'`
- Cache: extracted roles before dedup/verification

### resume-tailor — 1 cacheable phase

**Start**: `bun scripts/cache.js read resume-tailor analysis`
- Hit: "Posting analysis cached — resume from composition?"
- Miss: Run Phase 2 normally

**After Phase 2 (analyze & score)**: `bun scripts/cache.js write resume-tailor analysis '<json>'`
- Cache: requirement mapping + accomplishment scoring

### Shared convention doc

`skills/_shared/phase-cache.md` documents the protocol:
- How to call cache.js (read/write syntax)
- When to write (after each cacheable phase completes successfully)
- How to prompt for resumption (show timestamp + summary, accept "fresh" to bypass)
- Each SKILL.md references this doc rather than duplicating instructions

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `scripts/cache.js` | Create | CLI entrypoint — argument parsing, routing |
| `scripts/lib/cache.js` | Create | Core logic — readCache, writeCache, listCaches, cleanCaches |
| `skills/_shared/phase-cache.md` | Create | Shared convention doc for skill authors |
| `skills/daily-digest/SKILL.md` | Modify | Add cache-read at start, cache-write after phases 1 & 2 |
| `skills/scan-email/SKILL.md` | Modify | Add cache-read at start, cache-write after body fetch |
| `skills/resume-tailor/SKILL.md` | Modify | Add cache-read at start, cache-write after analysis |
| `tests/cache.test.js` | Create | Unit + integration tests |

## Testing Strategy

### Unit tests (`tests/cache.test.js`)

- `write` — creates file in `output/.cache/`, valid JSON with all metadata fields
- `read` — returns cached data when file exists and fresh
- `read` — exits 1 when file doesn't exist
- `read` — exits 1 when file is expired
- `list` — shows cache files with age
- `list` — filters by skill name
- `clean` — removes all cache files, reports count
- `clean` — removes only specified skill's caches
- `write` — rejects invalid JSON argument
- Round-trip: write → read → verify data matches

### No changes to existing tests

Cache.js is a new module with no interaction with existing parsers or state
management.

## Risks

1. **Convention, not enforcement**: Skills are markdown — Claude must follow the
   cache-read/write instructions. The script enforces expiry and format, but
   nothing forces a skill to call it. Mitigated by: clear instructions in each
   SKILL.md + shared convention doc.
2. **Large cache payloads**: A daily-digest Phase 1 with 50 roles could produce
   a sizable JSON file. Not a real concern — these are <100KB and temporary.
3. **Clock skew**: Expiry uses `Date.now()` comparison. If system clock jumps,
   cache could expire early or late. Acceptable for a local CLI tool.