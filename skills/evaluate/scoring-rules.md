# Evaluate — Scoring Rules

## Global Score

Compute a global score 1–5 as a weighted average across three positive dimensions,
then apply a red flag deduction:

- **CV Match** — 40% weight (most important)
- **Growth Signal** — 35% weight
- **Comp Alignment** — 25% weight
- **Red Flag deduction** — reduces score by 0–0.5 depending on severity

Global = (CV_Match × 0.40) + (Growth × 0.35) + (Comp × 0.25) − Red_Flag_Deduction

Round to one decimal place. Display as: `Score: X.X / 5.0`

## Recommendation Thresholds

| Score | Recommendation | Meaning |
|---|---|---|
| 4.0–5.0 | **Apply** | Strong fit — prioritize |
| 3.5–3.9 | **Apply** | Good fit — worth pursuing |
| 3.0–3.4 | **Borderline** | Proceed only if mission or growth signal is compelling |
| < 3.0 | **Pass** | Structural fit problems — not worth the tailoring investment |

## Dimension Scales

### CV Match (1–5)

| Score | Meaning |
|---|---|
| 5 | All hard requirements have Direct resume matches; gaps are Nice-to-haves only |
| 4 | Most hard requirements are Direct or Adjacent; 1–2 gaps with clear mitigation |
| 3 | Several Adjacent matches; 2–3 gaps, at least one Hard blocker with a mitigation path |
| 2 | Multiple Hard blocker gaps; or key requirements have no match |
| 1 | Fundamental mismatch — wrong domain, wrong function, or wrong seniority tier |

**Match types:**
- **Direct** — exact skill or keyword present in the resume
- **Adjacent** — related experience that demonstrates the capability
- **Gap** — no clear match; classify as Hard blocker or Nice-to-have

### Growth Signal (1–5)

| Score | Meaning |
|---|---|
| 5 | Clear step up: larger scope, higher title, or stronger strategic mandate |
| 4 | Lateral with meaningful upside (better company stage, mission, equity) |
| 3 | Roughly equivalent scope — no clear step back |
| 2 | Narrower scope than last role — smaller team or reduced strategic influence |
| 1 | Clear step back — smaller company, lower title, or reduced scope |

### Comp Alignment (1–5)

| Score | Meaning |
|---|---|
| 5 | Estimated comp is well above the floor (20%+ above) |
| 4 | Estimate meets or slightly exceeds the floor |
| 3 | Estimate is at the floor; within negotiation range |
| 2 | Estimate is below the floor; significant negotiation required |
| 1 | Estimate is materially below floor |

**When data is insufficient** (common for VP roles): default to 3 and note
"Insufficient public data — scored conservatively." Never fabricate a range.

### Red Flag Deduction (0.0–0.5)

| Flags | Deduction | Examples |
|---|---|---|
| None | 0.0 | Clean posting, positive signals throughout |
| Minor | 0.1 | One concern (below-average Glassdoor, unclear reporting) |
| Moderate | 0.2–0.3 | Multiple concerns or one significant flag (recent layoffs nearby) |
| Serious | 0.4–0.5 | Hard blockers — relocation required, hiring freeze confirmed, posting >90 days old with no activity |

### Hard-Blocker Override

If the Red Flag Deduction is **Serious (0.4–0.5)**, clamp the recommendation to
**PASS** regardless of the computed global score. A hard blocker — citizenship or
residency requirement, confirmed hiring freeze, role already closed — makes the
application structurally non-viable. The score may still be computed and displayed
for reference, but the recommendation line must read `PASS`.

Example: score 3.0 with a UK residency requirement → display `3.0 / 5.0`,
recommendation: **PASS** (hard blocker — citizenship/residency required).
