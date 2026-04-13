---
name: setup
description: >
  First-time setup and ongoing health check for the job-seeker plugin.
  Triggers: "setup", "configure job seeker", "check my setup", "initialize",
  "get started", "first time setup", "what's missing". Reports configuration
  status and interactively guides through missing pieces.
allowed-tools: Read, Write, Edit, Bash, Glob, AskUserQuestion
---

# Setup

Reports configuration status and interactively walks the user through any
missing or incomplete pieces. Safe to re-run anytime as a health check.

## Phase 0 — Preflight

Read `skills/_shared/preflight.md` and execute, but display validate-config
output even on success — setup's purpose is to show config status. Do NOT
fail-fast on validation errors; capture them for the status dashboard instead.

---

## Phase 1 — Status Dashboard

Check every configurable piece and build a status table. Print it before
doing anything else so the user sees the full picture.

### Required checks

1. **config/candidate.md** — does it exist? If yes, run
   `bun scripts/validate-config.js` and check for field-level issues.
2. **config/search.md** — same as above (validate-config.js covers both).
3. **references/resume.pdf** — does the file exist?

### Optional checks

4. **integrations/config/theirstack-config.md** — does it exist? If yes,
   does it contain a non-placeholder `api_key` (i.e., not `tsk_xxxxxxxxxxxxxxxx`)?
5. **integrations/config/notes-config.md** — does it exist? If yes, does
   `plugin_root` point to a real directory?
6. **credentials/gmail-client-secret.json** — does it exist? If yes, does
   `credentials/gmail-tokens.json` also exist (authenticated)?

### Output format

```
Setup Status
─────────────────────────────────────────────────
✓ config/candidate.md              configured
✓ config/search.md                 configured
✗ references/resume.pdf            missing
○ integrations/theirstack          optional · not configured
○ integrations/apple-notes         optional · not configured
─────────────────────────────────────────────────
2 ready · 1 required missing · 2 optional
```

Legend:
- `✓` = present and valid
- `✗` = required but missing or invalid
- `○` = optional, not configured (neutral — not an error)
- `●` = optional, configured and valid

---

## Phase 2 — Guided Fix

Work through missing items in this order:
1. Required items first (candidate.md, search.md, resume.pdf)
2. Optional items second (TheirStack, Apple Notes)

For each missing item, follow the specific guide below.

### 2a — references/resume.pdf (if missing)

Tell the user:
> "Place your resume PDF at `references/resume.pdf`. This is the source of
> truth for detailed accomplishments — skills like cover-letter and
> interview-prep read it directly.
>
> Once you've placed it there, say 'done' and I'll continue."

Wait for confirmation. Do NOT proceed to candidate.md or search.md until
the resume is in place (or the user explicitly says to skip it). The resume
enables the smart pre-population flow for the config files.

### 2b — config/candidate.md (if missing or invalid)

**Resume-first flow (preferred):** If `references/resume.pdf` exists:

1. Read `references/resume.pdf`
2. Extract: name, current role/company, years of experience, core strengths,
   previous companies, education, location
3. Extract all quantified accomplishments (look for dollar amounts,
   percentages, team sizes, time reductions — any sentence with a number
   that demonstrates impact)
4. Present the extracted data to the user in the same table format as
   `config/candidate.md.example` and ask them to confirm or correct each
   field. For accomplishments, include the first 5 quantified achievements
   found in the resume — users typically lead with their strongest work.
   Show the selected 5 and ask the user to confirm, reword, or swap any.
5. Ask for their email address (not typically on a resume)
6. Generate `config/candidate.md` with confirmed values

**Fallback flow (no resume):** Ask the user for each required field one
at a time, in this order:
- Full name
- Current role and company
- Target roles (suggest defaults from search.md.example)
- Years of experience and team scope
- Core strengths (3-6, comma-separated)
- Previous companies
- Education
- Location
- Email
- 3-5 quantified accomplishments (explain: "These ground your cover
  letters and interview prep in real evidence. Include specific numbers.")

Generate `config/candidate.md` from their answers.

### 2c — config/search.md (if missing or invalid)

Ask the user interactively for each section:

1. **Target role titles** — suggest defaults from search.md.example, ask
   them to add/remove/keep
2. **Remote preference** — "Remote, Hybrid, or both?"
3. **Location for hybrid** — only if hybrid selected (e.g., "Austin TX area")
4. **Comp floor** — "What's your minimum? Format: $X base + Y% bonus + $Z equity"
5. **Company types** — suggest: mission-driven, growth-stage, midsize.
   Ask if they want to adjust
6. **Company stage floor** — "Series B+? 100+ employees? Or no minimum?"
7. **Min team size** — "Minimum number of engineers you'd want to lead?"
8. **Companies to skip** — "Any companies to exclude? (comma-separated, or 'none')"
9. **Sources** — suggest defaults, ask to adjust
10. **Location constraints** — confirm: remote yes, hybrid yes, relocation no,
    in-office no, contract no — adjust as needed
11. **Apple Notes prefix** — only if Apple Notes integration is configured.
    Default: "Job Search"
12. **Notes** — "Anything else about your search context?"

Generate `config/search.md` from their answers.

### 2d — integrations/config/theirstack-config.md (optional)

Explain what TheirStack provides:
> "TheirStack searches 321K+ job sites via API — it's the primary discovery
> engine for the daily digest. Free tier gives 200 credits/month (~25 daily
> runs). Without it, the digest falls back to web search, which works but
> finds fewer results.
>
> Want to set it up? You'll need an API key from
> https://theirstack.com/dashboard/api-keys"

If yes:
1. Ask for their API key
2. Ask for daily credit budget (suggest: 8 for free tier, explain the math)
3. Generate `integrations/config/theirstack-config.md` with their values
   and the default `base_url`

If no, move on. This is optional.

### 2e — integrations/config/notes-config.md (optional)

Explain what Apple Notes integration provides:
> "The daily digest can write directly to Apple Notes for a native reading
> experience on your Mac/iPhone/iPad. This requires macOS with Apple Notes.
>
> Want to enable it?"

If yes:
1. Ask for the absolute path to this plugin repo (suggest the current
   working directory)
2. Ask which Apple Notes folder to use (suggest: "Job Search")
3. Ask for iCloud account name (suggest: "iCloud")
4. Generate `integrations/config/notes-config.md` with their values

If no, move on.

### 2f — credentials/gmail-client-secret.json (optional)

Explain what Gmail API credentials provide:
> "The Gmail API integration lets scan-email automatically trash processed
> job alert emails instead of requiring manual cleanup. It requires a
> Google Cloud project with the Gmail API enabled.
>
> Want to set it up?"

If yes:
1. Guide the user through Google Cloud Console:
   - Go to https://console.cloud.google.com/
   - Create a project (or select existing)
   - Enable the Gmail API
   - Create OAuth 2.0 credentials (Desktop application type)
   - Download the JSON file
2. Ask the user to save it as `credentials/gmail-client-secret.json`
3. Run `bun scripts/gmail.js auth` to complete the OAuth flow
4. Verify: check that `credentials/gmail-tokens.json` was created

If no, move on. This is optional — scan-email falls back to manual
cleanup reports without it.

---

## Phase 3 — Verify

After all guided fixes are complete:

1. Run `bun scripts/validate-config.js` — show the output
2. Re-run the Phase 1 status dashboard to confirm everything is green
3. If all required items pass, tell the user:
   > "Setup complete. You can run `/daily-digest` to start finding roles,
   > or re-run `/setup` anytime to check your configuration."
4. If issues remain, list them and offer to help fix

---

## Re-run Behavior

When all items are already configured, Phase 1 prints the dashboard and
Phase 2 is skipped. Tell the user everything looks good and which skills
are available. This makes `/setup` useful as a health check, not just a
one-time wizard.
