# State File Frontmatter — Design Spec

**Issue**: #48
**Date**: 2026-04-09
**Status**: Approved

## Problem

Central state files (`seen-postings`, `preferences`, `applications`) lack structured
metadata. There is no machine-readable format version, no last-updated timestamp, and
no way to derive file-level facts without parsing the entire document. This is
inconsistent with the per-company artifact frontmatter established in #36 and makes
the eventual JSON migration (#22) harder.

## Approach

**Frontmatter-aware parsers (Approach A)**: Each lib module (`applications.js`,
`seen-postings.js`, `preferences.js`) uses the existing `parseFrontmatter()` /
`serializeFrontmatter()` from `scripts/lib/frontmatter.js` to handle metadata.
Parsers strip frontmatter before processing content. Writers re-serialize frontmatter
on output.

Rejected alternative: handling frontmatter in `state.js` orchestrator only. This
can't cover direct I/O functions like `flagSeenPosting` and `appendSeenPosting` that
bypass the orchestrator.

## Decisions

- **Format version**: Simple integer (`format_version: 1`), bump on breaking changes
- **Computed vs. static fields**: Applications gets computed counts on every write
  (free — data already in memory). Seen-postings and preferences get only static
  fields (counts would require a full parse on what are currently cheap string appends)
- **Migration strategy**: Backfill on next write. If a write operation touches a file
  without frontmatter, inject default frontmatter. No migration script needed.
- **Backward compatibility**: `parseFrontmatter` already returns empty meta + full
  body when no frontmatter exists (established in #36). Parsers work unchanged on
  legacy files.

## Frontmatter Schemas

### All file types (shared fields)

```yaml
format_version: 1
last_updated: YYYY-MM-DD
```

### applications.md (additional fields)

```yaml
format_version: 1
last_updated: 2026-04-09
active_count: 3
closed_count: 1
```

- `active_count` / `closed_count` computed from `active.length` / `closed.length`
  on every call to `formatApplicationsFile`
- `last_updated` set to today's date on every write

### seen-postings.md

```yaml
format_version: 1
last_updated: 2026-04-09
```

- `last_updated` set to today on every write
- No entry count (would require parsing on append/flag operations)

### preferences.md

```yaml
format_version: 1
last_updated: 2026-04-09
```

- `last_updated` set to today on every write
- No computed fields

## Parser Changes (Read Path)

Each parser strips frontmatter before processing:

**`applications.js` — `parseApplicationsContent(content)`**
- Call `parseFrontmatter(content)` at top, parse `.body` instead of raw `content`
- All regex patterns operate on body unchanged

**`seen-postings.js` — `parseSeenPostingsContent(content)`**
- Same: `parseFrontmatter(content)`, parse `.body`

**`preferences.js` — `parsePreferencesFile(filePath)`**
- Call `parseFrontmatter` on raw content, parse `.body`

Key invariant: parsers never see frontmatter lines. Zero regression risk on read path.

## Writer Changes (Write Path)

**`applications.js` — `formatApplicationsFile({ active, closed })`**
- Rebuilds entire file from scratch (existing behavior)
- After building body, wrap with `serializeFrontmatter(meta, body)`
- Meta computed fresh: `{ format_version: 1, last_updated: today, active_count: active.length, closed_count: closed.length }`
- No need to read previous frontmatter — full rewrite replaces everything

**`seen-postings.js` — `appendSeenPosting(dir, entry)`**
- Call `parseFrontmatter` to split meta from body
- All string index manipulation operates on body only
- Reassemble with `serializeFrontmatter(meta, body)`
- Backfill: if meta is empty, create `{ format_version: 1, last_updated: today }`
- If meta exists, update `last_updated`

**`seen-postings.js` — `flagSeenPosting(dir, url, flag)`**
- `parseFrontmatter` to split, operate on body lines, reassemble
- Update `last_updated` on successful flag

**`seen-postings.js` — new file creation**
- Wrap bare markdown with `serializeFrontmatter({ format_version: 1, last_updated: today }, body)`

**`preferences.js` — `appendPreferences(dir, entry)`**
- Same pattern as seen-postings: split, manipulate body, reassemble
- Backfill if no meta, update `last_updated` if exists

**`preferences.js` — new file creation**
- Wrap with frontmatter

## Testing Strategy

### Unit tests (extend existing test files)

**`tests/applications.test.js`**
- `parseApplicationsContent` with frontmatter — parses body, ignores frontmatter
- `formatApplicationsFile` — output includes correct frontmatter fields
- Round-trip: format -> parse -> format produces stable output
- `createApplication` on file with existing frontmatter — preserved and counts updated

**`tests/seen-postings.test.js`**
- `parseSeenPostingsContent` with frontmatter — body parsed correctly
- `appendSeenPosting` with frontmatter — preserved, `last_updated` updated
- `appendSeenPosting` without frontmatter (backfill) — frontmatter created
- `flagSeenPosting` with frontmatter — preserved

**`tests/preferences.test.js`**
- `parsePreferencesFile` with frontmatter — body parsed correctly
- `appendPreferences` with frontmatter — preserved and updated
- `appendPreferences` without frontmatter (backfill) — created

**`tests/state-cli.test.js`**
- Integration: create application -> read -> verify frontmatter in file on disk

No changes to `tests/frontmatter.test.js` — module itself is unchanged.

## Documentation Updates

- **`skills/_shared/state-io.md`** — add Frontmatter section documenting shared
  fields, per-type fields, and backfill behavior
- **`skills/_shared/frontmatter.md`** — add central state file schemas alongside
  existing per-company artifact schemas

## Risks

1. **Seen-postings string index manipulation**: `appendSeenPosting` and
   `flagSeenPosting` use index-based string operations. After splitting with
   `parseFrontmatter`, these operate on body only — indices stay correct without
   offset math.
2. **Applications `---` separator**: The `---` used between application entries
   could interact with frontmatter detection. This is safe because
   `parseFrontmatter` only matches `---` at position 0 of the string (the body
   won't start with `---`).
3. **Silent corruption**: Mitigated by test coverage on every write path and
   round-trip stability tests.
