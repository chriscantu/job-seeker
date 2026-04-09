# Daily Digest — Scoring Rules

## Star Ratings

- ⭐⭐⭐⭐⭐ = Perfect match (title, comp, mission, remote all align)
- ⭐⭐⭐⭐ = Strong match (one dimension is a stretch but worth pursuing)
- ⭐⭐⭐ = Worth considering (interesting company but notable gaps)

## Comp Evaluation

Use the "Comp Floor" field from `config/search.md`:
- Roles that meet or exceed the comp floor → include in main digest section
- Roles below comp floor but otherwise strong → include in "Noted But Below
  Comp Target" section
- Roles significantly below comp floor with no mission offset → exclude

## Below-Comp Section

Roles below the comp target but with strong mission alignment or other
compelling factors get a separate section in the digest. Use this judgment:
- Would the candidate consider this role if the mission resonated strongly?
- Is the comp gap narrow enough that negotiation could close it?

## HTML Output Template

The `html_body` uses Apple Notes-compatible HTML so the same content works in
both `output/` and Apple Notes — every line wrapped in `<div>` tags.

Substitute `{Name from config/candidate.md}` with the `Name` field value read
from `config/candidate.md` before constructing the HTML body.

```html
<div><b><span style="font-size: 21px">Executive Job Digest — {Month Day, Year}</span></b></div>
<div><span style="font-size: 11px">Good morning {Name from config/candidate.md} — here are today's executive engineering leadership opportunities:</span></div>
<div><span style="font-size: 11px"><br></span></div>
<div><b><span style="font-size: 15px">🏢 {Company Name}</span></b></div>
<div><b><span style="font-size: 11px">📍 Location:</span></b><span style="font-size: 11px"> {Location}</span></div>
<div><b><span style="font-size: 11px">🎯 Mission:</span></b><span style="font-size: 11px"> {1-sentence company mission}</span></div>
<div><b><span style="font-size: 11px">💰 Comp:</span></b><span style="font-size: 11px"> {Comp range or estimate}</span></div>
<div><b><span style="font-size: 11px">⭐ Fit:</span></b><span style="font-size: 11px"> {⭐⭐⭐⭐⭐ / ⭐⭐⭐⭐ / ⭐⭐⭐} — {one-word reason}</span></div>
<div><b><span style="font-size: 11px">📅 Posted:</span></b><span style="font-size: 11px"> {date posted, e.g. "March 20" or "3 days ago"} {omit line if date unknown}</span></div>
<div><b><span style="font-size: 11px">🔗 Link:</span></b><span style="font-size: 11px"> </span><a href="{DIRECT_COMPANY_URL}"><u><span style="font-size: 11px">View Posting</span></u></a></div>
<div><b><span style="font-size: 11px">Why this fits:</span></b><span style="font-size: 11px"> {1-2 sentences tied to the candidate's specific background}</span></div>
<div><span style="font-size: 11px"><br></span></div>
<!-- Repeat role block above for each role -->

<!-- Below-comp section (if applicable) -->
<div><b><span style="font-size: 15px">📋 Noted But Below Comp Target</span></b></div>
<div><b><span style="font-size: 11px">🏢 {Company}</span></b><span style="font-size: 11px"> — {Title}</span></div>
<div><span style="font-size: 11px">📍 {Location} | 🎯 {Mission} | 💰 ~{Comp}</span></div>
<div><span style="font-size: 11px">🔗 </span><a href="{DIRECT_URL}"><u><span style="font-size: 11px">View Posting</span></u></a></div>
<div><i><span style="font-size: 11px">Worth a look if the mission resonates enough to offset the comp gap.</span></i></div>
<div><span style="font-size: 11px"><br></span></div>

<!-- Monday-only: Manual check reminder -->
<div><b><span style="font-size: 15px">📌 Weekly Reminder — Check These Manually</span></b></div>
<div><span style="font-size: 11px">• LinkedIn Jobs — log in and search "VP Engineering" + "Senior Director Engineering" remote</span></div>
<div><span style="font-size: 11px">• ExecThread — peer-shared confidential roles</span></div>
<div><span style="font-size: 11px">• ExecuNet — members-only executive community</span></div>
<div><span style="font-size: 11px">• Ivy Exec — curated VP/Director postings</span></div>
<div><span style="font-size: 11px">• Korn Ferry — retained executive search</span></div>
<div><span style="font-size: 11px">• BlueSteps/AESC — global executive search network</span></div>
<div><span style="font-size: 11px"><br></span></div>
<div><i><span style="font-size: 11px">Automated by Claude Code | Adjust criteria anytime</span></i></div>
```

### HTML Rules (non-negotiable)

- **Wrap EVERY line in `<div>` tags** — without them, all text collapses into one block
- **Use `<div><span style="font-size: 11px"><br></span></div>`** for blank lines between role cards
- **NEVER put `<a href="">` inside `<table>` cells** — Apple Notes strips those links
- **Use `<a href="URL"><u><span>View Posting</span></u></a>`** for links
- **No `<h1>`/`<h2>`/`<h3>`** — use `<b><span style="font-size: Xpx">` instead
- **No CSS classes, `<style>` blocks, or external stylesheets**
- **Weekly reminder links** — render as plain text with `•` bullets (not `<ul>`/`<li>`)
