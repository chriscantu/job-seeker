# Story Bank — interview-prep Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `interview-prep` into the persistent `output/story-bank.md` that `evaluate` already writes — so each session surfaces existing stories with framing notes instead of regenerating from scratch.

**Architecture:** All changes are confined to `skills/interview-prep/SKILL.md`. Three insertion points: (1) Phase 3 reads the bank and surfaces a preflight prompt, (2) Phase 4 Section 3 replaces fresh-generation with a check-first/generate-gaps pattern, (3) a new Phase 5.5 write-back step appends new stories and updates `used_for` tracking. No new scripts.

**Tech Stack:** Markdown skill files only — no code changes. Story bank is pure markdown state managed by Claude at skill execution time.

---

## File Structure

| File | Change |
|------|--------|
| `skills/interview-prep/SKILL.md` | Three targeted edits: Phase 3 read, Section 3 rewrite, Phase 5 write-back |

No new files. `output/story-bank.md` is created at runtime by `evaluate`; `interview-prep` reads and appends to it.

---

### Task 1: Add story bank read to Phase 3

**Files:**
- Modify: `skills/interview-prep/SKILL.md` (Phase 3 — Research Load section)

Phase 3 currently reads the company research brief and any existing interview-prep file. Add a third parallel read for the story bank, followed by a preflight prompt.

- [ ] **Step 1: Open the file and locate Phase 3**

Read `skills/interview-prep/SKILL.md`. Find the `## Phase 3 — Research Load` section. The section ends before `## Phase 4`.

- [ ] **Step 2: Add the Story Bank subsection after "Existing Interview Prep (for merge)"**

Insert the following block immediately after the `### Existing Interview Prep (for merge)` subsection (after the last bullet point that ends "Full generation, no merge needed."):

```markdown
### Story Bank

Check if `output/story-bank.md` exists.

- **If exists**: Read the full file. Parse each `## {Story Title}` section and extract:
  - The story title (from the `##` heading)
  - Tags (from `**Tags:**` line — strip brackets, split on `] [` to get a list)
  - Use count (length of `**used_for:**` array)

  Build two lookup structures for use in Phase 4:
  - `bankByTag`: map of `tag → [story titles]` (e.g., `"ci-cd" → ["CI/CD Transformation at Procore"]`)
  - `bankByTitle`: map of `title → full story text` (for surfacing the story body)

  Then show the user:

  > "Story bank has {N} stories (most used: {top story title}, used {N} times).
  > Want to audit framing before we map to this JD? (yes / skip)"

  - If user says **yes**: display the full story bank inline and wait for feedback before continuing to Phase 4.
  - If user says **skip** or gives no response within one exchange: continue.

- **If not exists**: Set `bankByTag = {}` and `bankByTitle = {}`. No preflight prompt — the bank is empty.
```

- [ ] **Step 3: Verify the edit reads correctly**

Re-read `skills/interview-prep/SKILL.md` Phase 3 and confirm:
- `### Story Bank` appears as a third subsection under Phase 3
- The lookup structure names (`bankByTag`, `bankByTitle`) are consistent (they'll be referenced in Phase 4)
- The preflight prompt text is present

- [ ] **Step 4: Commit**

```bash
git add skills/interview-prep/SKILL.md
git commit -m "feat(interview-prep): read story bank in Phase 3 with preflight prompt"
```

---

### Task 2: Rewrite Section 3 — bank-aware story generation

**Files:**
- Modify: `skills/interview-prep/SKILL.md` (Phase 4 Section 3 — STAR Story Bank)

This is the core change. Currently Section 3 generates 6-8 fresh STAR stories on every run. Replace it with: check tags → surface existing → generate only for gaps.

- [ ] **Step 1: Locate Section 3 in Phase 4**

Find `### Section 3: STAR Story Bank` in `skills/interview-prep/SKILL.md`. The section ends at `Story selection criteria:` block (just before `### Section 4:`).

- [ ] **Step 2: Replace Section 3 content**

Replace everything from `Generate 6-8 stories using...` through the end of the `Story selection criteria` bullet list with the following:

```markdown
Using the `bankByTag` and `bankByTitle` maps built in Phase 3, generate 6-8 stories
for this session. The goal is to **surface existing stories first** and only generate
new ones for themes not yet covered.

**Required theme coverage** (select based on round type):

| Round type | Required themes (in priority order) |
|------------|--------------------------------------|
| `behavioral` | team-scaling, conflict-resolution, delivery-transformation, cross-functional-influence, failure-learning, org-design |
| `technical` | ci-cd, platform-modernization, dx, technical-strategy, architecture |
| `hiring-manager` | team-scaling, cross-functional-influence, org-design, strategic-alignment |
| `culture-fit` | values-alignment, team-building, cross-functional-influence, failure-learning |
| `executive-panel` | team-scaling, delivery-transformation, technical-strategy, org-change |
| `recruiter-screen` | team-scaling, delivery-transformation, cross-functional-influence |
| `unknown` | team-scaling, delivery-transformation, cross-functional-influence, technical-strategy |

**For each required theme:**

1. Look up the theme in `bankByTag`.
2. **If a match exists:** Look up the story body in `bankByTitle`. Output the full story
   using the format below, marking it **[existing]**. Add a one-line framing note
   specific to this company and round type.
3. **If no match:** Generate a new story from `config/candidate.md` accomplishments
   and `references/resume.pdf`. Mark it **[new]**. Use the bank format (with Reflection
   and Tags — see below). Track it in a `newStories` list for write-back in Phase 5.5.

Aim for 6-8 stories total. If existing stories cover all required themes, surface the
best 6-8 by relevance (most recently used or highest tag overlap with JD). Do not
generate new stories just to hit the count if the bank already covers the themes.

**Story format** (for both existing and new):

```markdown
### {Story Title}

**Situation:** {1-2 sentences — company, problem, stakes}

**Task:** {Your specific responsibility}

**Action:** {What you did — concrete methods, decisions, leadership moves}

**Result:** {Quantified outcome}

**Reflection:** {What this signals about your leadership / what you'd do differently}

**Tags:** [{theme1}] [{theme2}] [{theme3}]

_{Source: existing | new — {one-line framing note for this round/company}}_
```

**For new stories**, include a **Reflection** that answers "what does this story signal
about my leadership at VP level?" — not just "what went well." This is what separates
VP-level storytelling from manager-level. Example: "This signals I prioritize system
reliability over feature velocity when there's a conflict — and that I can make that
call without needing executive air cover."
```

- [ ] **Step 3: Verify the replacement**

Re-read `skills/interview-prep/SKILL.md` Section 3 and confirm:
- The theme table covers all 7 round types (behavioral, technical, hiring-manager, culture-fit, executive-panel, recruiter-screen, unknown)
- The story format block includes `**Reflection:**` and `**Tags:**`
- The `newStories` list is mentioned (needed in Task 3)
- `[existing]` / `[new]` markers are present

- [ ] **Step 4: Commit**

```bash
git add skills/interview-prep/SKILL.md
git commit -m "feat(interview-prep): rewrite Section 3 with bank-aware story generation"
```

---

### Task 3: Add Phase 5.5 — story bank write-back

**Files:**
- Modify: `skills/interview-prep/SKILL.md` (between Phase 5 and Error Handling)

After writing `output/{company-slug}/interview-prep.md`, append new stories to the bank, update `used_for` on existing stories, and show bank stats. This is a new phase inserted between the existing Phase 5 and Error Handling sections.

- [ ] **Step 1: Locate the insertion point**

Find `## Error Handling` in `skills/interview-prep/SKILL.md`. The new phase goes immediately before it (after the closing lines of Phase 5's "Present Summary" block).

- [ ] **Step 2: Insert Phase 5.5 before Error Handling**

Insert the following block:

```markdown
---

## Phase 5.5 — Story Bank Write-Back

### Append new stories

For each story in `newStories` (tracked in Phase 4 Section 3):

1. Check whether `output/story-bank.md` already contains a `## {Story Title}` heading
   with that exact title. If it does, skip — do not duplicate.
2. If no duplicate: append the story to `output/story-bank.md` in this format:

```markdown
## {Story Title}
**Situation:** {text}
**Task:** {text}
**Action:** {text}
**Result:** {text}
**Reflection:** {text}
**Tags:** [{theme1}] [{theme2}]
**used_for:** ["{Company} — {YYYY-MM-DD}"]
```

If `output/story-bank.md` does not exist, create it with this header first:

```markdown
# STAR+R Story Bank

Stories accumulate across sessions. Each story is tagged and tracked for reuse.

```

### Update used_for on existing stories

For each **existing** story that was surfaced in Section 3 (i.e., marked `[existing]`):

1. Find the story in `output/story-bank.md` by its `## {Story Title}` heading
2. Find its `**used_for:**` line
3. If the current company+date is not already in the list, append it:
   - Change `**used_for:** []` → `**used_for:** ["{Company} — {YYYY-MM-DD}"]`
   - Change `**used_for:** ["..."]` → `**used_for:** ["...", "{Company} — {YYYY-MM-DD}"]`
4. Write the updated file

### Show bank summary and flag core stories

After write-back, count `used_for` entries per story across the full bank.

Append to the Phase 5 "Present Summary" output (after the existing summary block):

> **Story bank:** {total} stories total — {N} used today ({existing_count} existing, {new_count} new).
> {if any story has 3+ entries in used_for}: Core stories (used 3+ times — worth memorizing):
> {list of core story titles}

If no story has 3+ uses, omit the core stories line.
```

- [ ] **Step 3: Verify the insertion**

Re-read the file and confirm:
- Phase 5.5 appears between Phase 5 and Error Handling
- The `used_for` append logic correctly handles both empty array and non-empty array cases
- The core story threshold (3+) is stated
- The story creation format matches the format in `skills/evaluate/SKILL.md` Block F exactly (compare the two `##` story blocks)

- [ ] **Step 4: Cross-check format parity with evaluate**

Read `skills/evaluate/SKILL.md` Block F append format. Confirm that the format in Phase 5.5 matches exactly — same field names (`**used_for:**` lowercase, `**Reflection:**` capitalized, `**Tags:**` with square bracket syntax). If there's a mismatch, fix `interview-prep` to match `evaluate` (evaluate is the canonical writer).

- [ ] **Step 5: Commit**

```bash
git add skills/interview-prep/SKILL.md
git commit -m "feat(interview-prep): add Phase 5.5 story bank write-back with core story flagging"
```

---

### Task 4: Close resolved issue #67

Issue #67 (evaluate skill) was shipped in PR #73 but never auto-closed.

- [ ] **Step 1: Close the issue**

```bash
gh issue close 67 --comment "Shipped in PR #73 (feat(evaluate): add /evaluate skill with scored fit analysis and STAR+R story bank). Closing."
```

- [ ] **Step 2: Confirm**

```bash
gh issue view 67 --json state,title
```

Expected: `{"state":"CLOSED","title":"evaluate: new skill — structured job evaluation (A–G blocks for VPE roles)"}`

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Read bank before generating | Task 1 (Phase 3 read) + Task 2 (Section 3 lookup) |
| Surface existing stories with framing adjustments | Task 2 (`[existing]` with framing note) |
| Generate only for gaps | Task 2 (theme coverage table + gap logic) |
| Append new stories to bank | Task 3 (Phase 5.5 append) |
| `used_for` tracking | Task 3 (update existing + populate new) |
| Preflight audit prompt ("bank has X stories") | Task 1 (preflight prompt in Phase 3) |
| Flag 3+ use "core stories" | Task 3 (core story summary) |
| Format consistency with evaluate | Task 3 Step 4 (cross-check) |

**Placeholder scan:** No TBDs, no "add appropriate handling," no "similar to above." All story formats are verbatim. ✓

**Type consistency:**
- `bankByTag` defined in Task 1, referenced in Task 2. ✓
- `bankByTitle` defined in Task 1, referenced in Task 2. ✓
- `newStories` introduced in Task 2, consumed in Task 3. ✓
- `used_for` format (lowercase, array syntax) consistent across Tasks 2 and 3. ✓
