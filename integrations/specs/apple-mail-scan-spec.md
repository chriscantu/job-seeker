# Apple Mail Scan — Feature Spec

**Status**: Shipped
**Author**: Cantu
**Date**: 2026-03-26

---

## Problem

The daily-digest skill searches job boards (TheirStack API, Greenhouse, Lever,
Ashby, WebSearch) but misses roles that arrive via email — Indeed alerts,
LinkedIn notifications, Glassdoor, and recruiter outreach. A March 26 Gmail
MCP scan surfaced two roles (TrueML, Charles Schwab) that board searches
missed entirely, proving email is a material discovery channel.

Chris's primary job search email is iCloud (`chris.m.cantu@icloud.com`),
routed through Apple Mail on macOS. Gmail (`christopher.cantu@gmail.com`)
receives secondary alerts and is already accessible via Gmail MCP server.

---

## Goals

1. Surface job alert roles from Apple Mail that board searches miss
2. Dedup against `output/*-seen-postings.md` to avoid re-surfacing known roles
3. Verify extracted URLs via ATS APIs before presenting to the user
4. Track source effectiveness (which email sources yield relevant roles)

## Non-Goals (v1)

- Application status tracking (Greenhouse/Lever/Ashby confirmation emails)
- Recruiter outreach detection and classification
- Gmail scanning (already available via MCP — separate integration)
- Marking emails as read, moving, or modifying them in any way

These are documented as future enhancements in the skill definition.

---

## Architecture

**Runtime**: Claude Code on macOS, osascript via Bash tool (matching Apple
Notes integration pattern from v0.3).

**Two AppleScript files**:
- `apple_mail_scan.applescript` — batch metadata extraction (10 messages per
  call, subject/sender/date/index)
- `apple_mail_read.applescript` — single message body/source fetch by index

**Classification**: Sender domain matching against a reference file
(`references/email-patterns.md`), with subject-line pre-filtering using
title keywords from `config/search.md`.

**URL extraction**: From HTML source (`source of msg`) using href attribute
regex. Falls back to plaintext (`content of msg`) URL regex. Verified via
ATS API routing from `integrations/adapters/ats-apis.md`.

**State flow**: New roles → `output/*-seen-postings.md`. Source stats →
`output/*-preferences.md`. Same state layer as all other skills.

---

## Constraints

- **Read-only**: Never marks emails as read, moves, deletes, or modifies
- **10-message batches**: osascript times out on larger loops (proven in
  eisenhower production use)
- **50-message cap**: Scans at most 50 messages per session to keep runtime
  reasonable
- **macOS-only**: Requires Apple Mail configured with the target account
- **ASCII-safe output**: AppleScript strips non-printable and non-ASCII
  characters to prevent JSON serialization errors. Scan script keeps
  codepoints 32-126 only; read script also preserves tab/CR/LF (9, 10, 13)
  for HTML parsing
- **User confirmation required**: Results presented in a table; state is
  only written after user approves

---

## Reference Implementation

Adapted from `claude-eisenhower/commands/scan-email.md`:
- Batch processing pattern (10 messages, sequential)
- Metadata-first approach (body fetch only for matches)
- osascript calling convention
- Read-only email access

**Improvements over eisenhower**:
- External `.applescript` files (not inline) — testable, reusable
- HTML source extraction for URL parsing (eisenhower only needs plaintext)
- 4000-char body preview (eisenhower uses 500 — insufficient for job alert URLs)
- Classification patterns in a reference file (DRY, Open/Closed)
- Apple Mail availability check before scanning

---

## Dependencies

- Apple Mail configured with iCloud account on macOS
- `integrations/config/mail-config.md` (from `.example` template)
- `references/email-patterns.md` (email classification patterns)
- `integrations/adapters/ats-apis.md` (URL verification — already exists)
- `config/search.md` (title keywords, filters — already exists)
