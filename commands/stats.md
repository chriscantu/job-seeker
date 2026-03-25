---
name: stats
description: >
  Show search effectiveness stats — which sources find the best roles,
  TheirStack credit usage, and digest run history. Triggers: /stats,
  "search stats", "source effectiveness", "how are my searches doing"
allowed-tools: Read, Glob
---

# Search Effectiveness Stats

Summarize source performance and search history from the preferences
state file.

## Steps

1. Glob `output/*-preferences.md`, sort descending, read the most recent file.
   If no file exists, report: "No search history found. Run the daily
   digest at least once to start collecting stats."

2. Parse the `### Source Effectiveness` sections across all date entries.
   Aggregate by source name.

3. Parse the `### TheirStack Credits` section if it exists. Sum credits
   used this month and show remaining budget.

4. Count the number of digest runs (distinct date headers in the file).

5. Glob `output/*-seen-postings.md`, sort descending, read the most recent.
   Count total unique roles surfaced and how many are marked CLOSED.

6. Render a stats summary:

```
Search Stats — {date}
─────────────────────────────────────────────────
Source Effectiveness (last 30 days)
  TheirStack API        {N} roles found
  Greenhouse boards     {N} roles found
  Tech Jobs for Good    {N} roles found
  Lever                 {N} roles found
  WebSearch fallback    {N} roles found

TheirStack Budget
  This month: {used}/{limit} credits ({remaining} remaining)
  Daily budget: {daily_credit_budget} credits

Search History
  Total digest runs: {N}
  Last run: {date}
  Roles surfaced: {N} total ({N} open, {N} closed)
─────────────────────────────────────────────────
```

7. If one source significantly outperforms others, note it:
   "Top source: {source} — consider increasing search weight."
