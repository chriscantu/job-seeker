# Test Protocol: Apple Notes Integration (v0.3)

**Date**: 2026-03-11
**Spec**: `integrations/specs/apple-notes-integration-spec.md`
**PR gate**: All steps must be completed and marked ✅ before merge.

---

## Prerequisites

1. `notes-config.md` exists at `integrations/config/notes-config.md` with correct `plugin_root`
2. Apple Notes is running (or will auto-launch)
3. iCloud sync is enabled (or `account: On My Mac` is set in config)
4. You are running these commands from macOS Terminal (Claude Code runs natively on macOS — osascript is in PATH)

---

## Step 1 — Create (new note)

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_create.applescript \
  "Test Note 001" \
  "<div><b>Hello from the test protocol</b></div><div>Line two</div>" \
  "Notes"
```

**Expected output:**
```
success: Test Note 001
```

**Verify in Apple Notes:**
- Open Apple Notes → Notes folder
- "Test Note 001" appears with bold first line and plain second line

**Pass criteria:** Script returns `success: Test Note 001` AND note is visible in Notes app.

---

## Step 2 — Create (dedup / replace)

**Command:** (same as Step 1 — run it again)
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_create.applescript \
  "Test Note 001" \
  "<div>Updated body content</div>" \
  "Notes"
```

**Expected output:**
```
success: Test Note 001
```

**Verify in Apple Notes:**
- "Test Note 001" contains "Updated body content" (not the original text)
- Only ONE note named "Test Note 001" exists (not a duplicate)

**Pass criteria:** Script returns `success:`, body is updated, no duplicate note.

---

## Step 3 — Read (existing note)

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_read.applescript \
  "Test Note 001" \
  "Notes"
```

**Expected output:**
```
Updated body content
```
(Plaintext — HTML tags stripped by Notes)

**Pass criteria:** Returns the plaintext body matching Step 2 content.

---

## Step 4 — Read (missing note)

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_read.applescript \
  "Note That Does Not Exist" \
  "Notes"
```

**Expected output:**
```
NOTE_NOT_FOUND
```

**Pass criteria:** Returns exactly `NOTE_NOT_FOUND`, no error thrown.

---

## Step 5 — Read (missing folder)

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_read.applescript \
  "Test Note 001" \
  "FolderThatDoesNotExist99"
```

**Expected output:**
```
FOLDER_NOT_FOUND
```

**Pass criteria:** Returns exactly `FOLDER_NOT_FOUND`, no error thrown.

---

## Step 6 — Update (existing note)

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_update.applescript \
  "Test Note 001" \
  "<div>State updated via update script</div>" \
  "Notes"
```

**Expected output:**
```
updated: Test Note 001
```

**Verify in Apple Notes:** "Test Note 001" body reads "State updated via update script".

**Pass criteria:** Returns `updated:` AND body is updated in place.

---

## Step 7 — Update (upsert / new note)

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_update.applescript \
  "Test Note Upsert 002" \
  "<div>Created by upsert</div>" \
  "Notes"
```

**Expected output:**
```
created: Test Note Upsert 002
```

**Verify in Apple Notes:** "Test Note Upsert 002" appears in Notes folder.

**Pass criteria:** Returns `created:` AND new note is visible in Notes.

---

## Step 8 — List

**Command:**
```sh
osascript ~/repos/job-seeker/scripts/apple_notes_list.applescript "Notes"
```

**Expected output:** Newline-separated list of all note titles in the Notes folder,
including at minimum:
```
Test Note 001
Test Note Upsert 002
```
(Other pre-existing notes will also appear — this is expected.)

**Pass criteria:** Both test notes appear in the output, one per line.

---

## Step 9 — Integration: daily digest via Claude Code

1. Open Claude Code with the job-seeker plugin loaded
2. Run: "run my job digest"
3. Skill should call `apple_notes_create.applescript` with today's digest title
4. Verify note appears in Apple Notes with correct title format: `Job Search Digest - {date}`
5. Verify body renders correctly (no raw HTML tags visible)

**Pass criteria:**
- [ ] Digest note appears in Apple Notes
- [ ] Title matches expected format
- [ ] Body renders without visible HTML tags
- [ ] No error reported in Claude Code session

---

## Step 10 — Fallback: Notes unavailable

1. Quit the Notes app (`⌘Q`)
2. Run the daily digest in Claude Code
3. Skill should attempt the AppleScript, fail, then save `output/digest-{date}.html`
4. Verify Claude Code reports the exact error message (not a silent fallback)

**Pass criteria:**
- [ ] `output/digest-{date}.html` is created
- [ ] Claude Code session shows: "Apple Notes write failed — saved HTML fallback. Error: {message}"
- [ ] Error message is not swallowed or generic

---

## Cleanup

After all tests pass, delete the two test notes from Apple Notes manually:
- "Test Note 001"
- "Test Note Upsert 002"

---

## Sign-Off

| Step | Result | Notes |
|------|--------|-------|
| 1 — Create new note | | |
| 2 — Create dedup/replace | | |
| 3 — Read existing | | |
| 4 — Read missing note | | |
| 5 — Read missing folder | | |
| 6 — Update existing | | |
| 7 — Update upsert | | |
| 8 — List | | |
| 9 — Digest integration | | |
| 10 — Fallback | | |

**Approved by:** ________________  **Date:** ________________
