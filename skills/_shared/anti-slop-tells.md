# Anti-Slop Tells — Shared Voice Guard

Applies to every piece of prose this plugin generates in the candidate's voice —
cover letters, LinkedIn posts/articles, "why this company" responses, outreach
messages. Read and apply this module BEFORE presenting any draft. It pairs with
`references/voice-guide.md` (the abstract rules) and the real writing samples in
`references/writing-samples/` (the concrete texture to imitate).

## Study the real samples, not just the abstract guide

`voice-guide.md` *describes* the voice; the blog samples in
`references/writing-samples/*.md` (skip `README.md`) **are** the voice. Read the
samples and match their sentence-level texture, not just their gist: "we" over "I",
problems named plainly ("Building a trusting organization is a nebulous task"), dry
one-line asides ("The list of people I naturally trust is tiny."), the concrete
number before the meaning. The abstract guide alone is weak calibration — if the
samples directory is empty, say so rather than silently falling back.

## Structural AI Tells — Ban These

Buzzwords are the obvious problem; these structural patterns are what actually make
writing read as machine-generated. They are the LLM house style. Chris's blog posts
contain almost none of them. Hunt them down before presenting. Each appeared in real
generated output; the arrow shows the fix.

- **Cleft sentences** — "What made it stick *was*…", "What draws me to X *is* that…".
  Just say the thing. → "It stuck because we measured adoption weekly."
- **Antithesis flourish** — "measure adoption — *not* announcements", "this isn't
  procurement — *it's* mapping the duplication". One per piece, maximum; zero is
  better. The em-dash-reversal is the single loudest tell. → "We measured adoption
  weekly and cut anything nobody used."
- **Rule-of-three imperative cadence** — "pick the problem, build the platform, and
  measure the outcome." Reads like a TED talk. Break the rhythm or cut to one verb.
- **Aphoristic closer with italics for punch** — "adoption *is* the product", "the
  playbook is the same." Delete. State the fact plainly instead.
- **Crutch metaphors reused across pieces** — "path of least resistance," "playbook,"
  "load-bearing," "the pattern repeats," "force-multiplier," "at scale." If it shows
  up in two pieces, it's a tell. Describe what actually happened.
- **Em-dash sandwich for gravitas** — "That problem — turning X into Y — is exactly
  the shape of this." Rewrite as plain sentences.
- **"Same X, same Y" parallelism** — "same fragmentation pattern, same modernization
  opportunity." Pick the one real parallel and state it once.
- **Hedge preambles before an admission** — "I want to be honest," "I want to be
  straight about one gap," "To be candid," "Truthfully." Cut the preamble entirely
  and state the thing. → not "I want to be honest: I haven't shipped X," just "I
  haven't shipped X."

## Cadence — don't over-correct into choppiness

Stripping the tells above must not leave staccato, clipped prose. Per
`voice-guide.md`, Chris writes *medium-length, connected sentences — not clipped, not
meandering.* Two short declaratives glued with a semicolon ("The technical solution
came first; the work sat on top of it") read as stilted, not surgical. Let sentences
breathe and connect with "and," "but," "so," "where," "though" — the way the blog
posts do. Prose that sounds like a telegram has only traded one machine register for
another.

## Voice anchors to imitate instead

Start a paragraph with context, not "I." Use a dry one-line aside when it lands.
Default to "we" for team work, "I" for personal decisions. Lead with the concrete
number, then the meaning. Name a hard thing as hard rather than dressing it up.
