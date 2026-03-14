# Config Migration Test Protocol

**Date written**: 2026-03-14
**Covers**: v0.4 Item 5 — Candidate-Agnostic Configuration
**Related spec**: `integrations/specs/candidate-agnostic-config-spec.md`

Run these steps manually after implementing the config migration.
Check each step off as you go. Note any failures with the exact error.

---

## Prerequisites

- Both `config/candidate.md` and `config/search.md` exist and are filled in
- `references/writing-samples/` exists (can be empty)
- No `memory/job-search/` directory

---

## Steps

- [ ] **1. Validate-config passes with full setup**

  ```
  node scripts/validate-config.js
  ```
  Expected: `✓ Config valid`

- [ ] **2. Validate-config fails clearly when candidate.md is missing**

  Rename `config/candidate.md` to `config/candidate.md.bak`, then run:
  ```
  node scripts/validate-config.js
  ```
  Expected: exit 1, message points to `config/candidate.md.example`

  Restore: `mv config/candidate.md.bak config/candidate.md`

- [ ] **3. Validate-config fails clearly when a required field is missing**

  Temporarily rename the `Email` row in `config/candidate.md` to `EmailX`, run:
  ```
  node scripts/validate-config.js
  ```
  Expected: exit 1, message names the missing field `"Email"`

  Restore the `Email` row.

- [ ] **4. daily-digest uses Name from config (not hardcoded "Chris")**

  In `config/candidate.md`, temporarily change Name to `Test User`. Run `daily-digest`.
  Expected: digest greeting reads "Good morning Test User —"

  Restore Name to `Christopher Cantu`.

- [ ] **5. daily-digest writes state to output/ file**

  After running `daily-digest`:
  ```
  ls output/*-seen-postings.md
  ```
  Expected: at least one file matching `YYYY-MM-DD-seen-postings.md` exists.
  Open it and confirm entries follow the `- Company | Title | URL` format.

- [ ] **6. daily-digest Apple Notes write still works (Chris only)**

  Check that `integrations/config/notes-config.md` exists.
  After running `daily-digest`, confirm `Job Search - Seen Postings` note in
  Apple Notes was updated (open Notes app).

- [ ] **7. cover-letter reads writing samples when present**

  Add a short markdown file to `references/writing-samples/sample.md`.
  Run `cover-letter` for any test company.
  Confirm in the session that the skill read the sample (it should reference
  reading files from `references/writing-samples/`).

- [ ] **8. memory/job-search/ does not exist**

  ```
  ls memory/
  ```
  Expected: `job-search/` directory is absent.

- [ ] **9. validate-config catches bad state file naming**

  Depends on `checkStateFiles()` in `scripts/validate-config.js` (implemented in Chunk 1, Task 4).
  Create a misnamed state file:
  ```
  touch output/seen-postings.md
  node scripts/validate-config.js
  ```
  Expected: exit 1, message flags `output/seen-postings.md` naming violation.
  Cleanup: `rm output/seen-postings.md`

  Remove: `rm output/seen-postings.md`

---

## Caveats

- Steps 4–6 require running Claude skills interactively
- Step 6 requires macOS with Apple Notes configured
- Apple Notes validation (step 6) is optional for users without Notes integration
