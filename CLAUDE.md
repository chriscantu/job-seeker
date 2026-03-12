# Job Seeker — Plugin Instructions

## Purpose

This plugin is a job search platform for Chris Cantu, an Engineering Director
seeking Senior Director / VP of Engineering roles at mission-driven, growth-stage
or midsize companies. It automates and assists with every phase of the executive
job search lifecycle.

## Principles (Read First)

Before creating files or running any skill, read `PRINCIPLES.md`.
It defines the quality standards, personalization rules, and privacy
constraints that govern all work in this plugin.

---

## Candidate Profile (Always in Context)

| Field | Value |
|-------|-------|
| **Name** | Christopher Cantu |
| **Current Role** | Director of Engineering, Procore Technologies |
| **Target Roles** | Senior Director of Engineering, VP of Engineering, Head of Engineering, SVP Engineering |
| **Experience** | 15+ years leading platform engineering teams (60+ engineers) |
| **Core Strengths** | Delivery transformation, CI/CD optimization, platform engineering, multinational team leadership, design systems, DevOps excellence |
| **Previous Companies** | Procore, Babylon Health, Vrbo (Expedia Group) |
| **Education** | MS Information Systems + BBA, Baylor University |
| **Location** | Austin, TX — Remote or Hybrid preferred |
| **Comp Floor** | $265K base + 15% bonus + $100K RSUs (current) |
| **What He Wants** | Mission-driven company where he can shape engineering culture, not just maintain it |
| **Email** | chris.m.cantu@icloud.com |

---

## State Management

All persistent state lives in Apple Notes (read and written via `osascript` through the Bash tool — requires Claude Code on macOS):

| Apple Note | Purpose |
|------------|---------|
| `Job Search - Seen Postings` | Deduplication log — every role ever surfaced |
| `Job Search - Preferences` | Interest signals, liked/passed roles, source effectiveness |
| `Job Search - Applications` | Application pipeline tracker |

Local `memory/job-search/` files mirror this state when a session has the folder mounted.

---

## Resume

The canonical resume lives at `references/resume.pdf`. Every skill that needs
resume context should read this file rather than hardcoding experience details.
The candidate profile table above provides a quick reference, but the resume
is the source of truth for detailed accomplishments.

---

## Skill Invocation

| Skill | Trigger Phrases |
|-------|----------------|
| `daily-digest` | "run my job digest", "check for new roles", "job search" *(interactive only — requires macOS/osascript for Apple Notes)* |
| `why-this-company` | "why this company", "why am I applying to", "application response" |
| `cover-letter` | "cover letter", "write a cover letter for" |
| `resume-tailor` | "tailor my resume", "customize resume for" |
| `company-research` | "research this company", "tell me about [company]", "company deep dive" |
| `interview-prep` | "prep me for interview", "interview questions", "practice interview" |
| `application-tracker` | "track application", "update pipeline", "where am I with" |
| `networking-outreach` | "draft outreach", "reach out to", "networking message" |
