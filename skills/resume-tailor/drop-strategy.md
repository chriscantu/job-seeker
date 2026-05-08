# Resume Tailor — Drop Strategy

When a tailored resume exceeds 2 pages, drop bullets per this rule.

## Drop Pool

Eligible:
- Bullets in roles 2..N (oldest first)

Protected:
- Header (name, tagline, contact)
- Summary
- Key Accomplishments (all 6)
- Skills line (10 entries)
- Education
- Current role (role index 0) — never drop
- Mandate line (plain text under meta, one per role) — never drop

## Selection Order

1. Identify the oldest role with eligible bullets.
2. Within that role, sort bullets by ascending JD-relevance score.
3. Tiebreak: bottom of the role section first.
4. If oldest role exhausted, advance to second-oldest.
5. Continue until pages ≤ 2 OR drop pool exhausted.

## Hard Failures

- **Drop pool exhausted with pages > 2** — surface `output/{slug}/{Name}_Resume_{Co}.docx`
  + decisions.md to user; suggest "template visual budget likely too verbose; reduce
  font, tighten margins, or audit Word styles."
- **Iteration > 5** — surface "drop loop did not converge" with diagnostics.

## Decisions Log

For every drop, append a row to `decisions.md`:

```
1. Vrbo / Sr Manager / "<bullet text first 50 chars...>" — score 1.2/5, oldest role bottom
```

The decisions log is the audit trail for why each tailored resume looks the way it does.
