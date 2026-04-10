# Phase Cache — Resumable Skill Execution

Multi-phase skills can cache intermediate results so that a failure mid-run
does not require restarting from scratch. The `scripts/cache.js` CLI handles
read/write/expiry/cleanup.

## When to Use

Use phase caching when a phase:
- Makes expensive external API calls (TheirStack, WebSearch)
- Performs slow batch operations (email body fetches)
- Produces results that are reusable if a later phase fails

## How to Cache a Phase

### After a phase completes successfully

```bash
bun scripts/cache.js write <skill-name> <phase-name> '<json-result>'
```

The JSON should contain the phase's output — whatever the next phase needs
as input. Cache files expire after 2 hours.

### At skill start — check for cached phases

```bash
bun scripts/cache.js read <skill-name> <phase-name>
```

- **Exit 0 + JSON output**: Cache hit. Present to user:
  "Phase N cached at {cached_at} — {summary}. Resume from Phase N+1?"
  - User confirms: skip the cached phase, use the returned data
  - User says "fresh" or "start over": ignore cache, run from scratch
- **Exit 1**: Cache miss or expired. Run the phase normally.

### Check phases in order

If a skill has multiple cacheable phases, check them in reverse order
(latest first). If Phase 2 is cached, skip both Phase 1 and Phase 2.
If only Phase 1 is cached, skip Phase 1 and run Phase 2.

### After skill completes successfully

Optionally clean up caches for the skill:

```bash
bun scripts/cache.js clean <skill-name>
```

This is not required — caches expire automatically after 2 hours.

## Example: daily-digest

```
# At skill start:
result2=$(bun scripts/cache.js read daily-digest phase2 2>/dev/null)
if [ $? -eq 0 ]; then
  # Phase 2 cached — resume from Phase 3 (compose)
fi

result1=$(bun scripts/cache.js read daily-digest phase1 2>/dev/null)
if [ $? -eq 0 ]; then
  # Phase 1 cached — resume from Phase 2 (verification)
fi

# After Phase 1:
bun scripts/cache.js write daily-digest phase1 '<discovery-results>'

# After Phase 2:
bun scripts/cache.js write daily-digest phase2 '<verification-results>'
```

## Cache File Location

Files are stored in `output/.cache/<skill>-<phase>.json`. The `output/`
directory is gitignored, so cache files are never committed.

## CLI Reference

| Command | Description |
|---------|-------------|
| `read <skill> <phase>` | Print cached data (exit 0) or signal miss (exit 1) |
| `write <skill> <phase> '<json>'` | Cache phase result (2h TTL) |
| `list [skill]` | Show active cache entries with age |
| `clean [skill]` | Remove cache files |
