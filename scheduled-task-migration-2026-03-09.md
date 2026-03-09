# Scheduled Task → Interactive Migration — March 9, 2026

## Problem

The daily job digest was configured as a scheduled task (`executive-job-digest`)
running at 7am weekdays. A validation test revealed that **scheduled tasks run in
a sandboxed Linux VM**, which has no access to macOS-native tools like `osascript`
or Apple Notes.

This was not surfaced during the design phase — the assumption was that scheduled
tasks would have the same capabilities as interactive Cowork sessions.

## Root Cause

| Context | Runs On | osascript | Apple Notes | Gmail Drafts |
|---------|---------|-----------|-------------|--------------|
| **Interactive Cowork session** | User's Mac | ✅ | ✅ | ✅ |
| **Scheduled task** | Linux VM | ❌ | ❌ | ✅ |

## What We Considered and Ruled Out

| Option | Why It Failed |
|--------|---------------|
| Scheduled task → Apple Notes | osascript not available in Linux VM |
| Scheduled task → Gmail send | Gmail connector can create drafts but can't send |
| Scheduled task → Gmail draft | Chris doesn't check Gmail regularly |
| Scheduled task → file → interactive pickup | Unnecessary complexity |

## Solution

**Drop the scheduled task. Run the digest interactively when Chris opens Cowork.**

Chris opens Cowork daily, so there's no delay in getting the digest. The interactive
session runs on his Mac with full access to osascript and Apple Notes — exactly the
environment where the digest was tested and working on March 7.

## Changes Made

1. **Disabled scheduled tasks:**
   - `executive-job-digest` (7am weekday cron) — disabled
   - `executive-job-digest-test` (one-time validation) — disabled

2. **Updated `skills/daily-digest/SKILL.md`:**
   - Description now says "interactive" instead of "scheduled task"
   - Added explicit note about macOS requirement and why scheduled tasks don't work

3. **Updated `CLAUDE.md`:**
   - Skill trigger table now notes `daily-digest` is interactive-only

## Key Lesson

**Cowork scheduled tasks ≠ interactive sessions.** Any skill that depends on
macOS-native capabilities (osascript, Apple Notes, Finder, etc.) must run
interactively. Design future skills with this constraint in mind.
