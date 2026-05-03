# Resume Tailor — Render Contract

The render layer bridges tailored markdown to `.docx` via `pandoc --reference-doc`.
Styling lives in `references/resume-template.docx`. No styling in markdown.

## Why pandoc, not anthropic-skills:docx

Spec originally named `anthropic-skills:docx` as the renderer. The installed
skill exposes no markdown→docx API — its write path is `docx-js` programmatic
constructors, which would force a custom markdown→docx-js converter (the very
thing the spec wanted to avoid). `pandoc --reference-doc=template.docx` honors
the original three rationales (no custom parser, no Python in repo, maintained
upstream) and preserves named styles from the reference template directly.
See `docs/superpowers/specs/2026-05-01-ats-resume-template-design.md:42` and
commit `aaf1fee`.

## Style Mapping

Pandoc with `--reference-doc=template.docx` maps markdown elements to the
reference template's named styles. The template must define:

| Markdown element | Style name in template |
|---|---|
| `# H1` | `Heading 1` (overridden as name banner) |
| `**bold-only line** under H1` | inline bold run (paragraph styled as Body) |
| Plain paragraph after tagline | `Body Text` or default paragraph |
| `## H2` | `Heading 2` (section dividers) |
| `### H3` | `Heading 3` (role title \| company) |
| `*italic line*` | inline italic run |
| Bullet list `- ...` | `List Bullet` |
| Skills line (single para after `## Skills`) | default paragraph (single-line via composer) |
| Accomplishment line (bullets after `## Key Accomplishments`) | `List Bullet` |
| `**bold run** within paragraph` | inline bold run, no style |

Pandoc honors paragraph-level styles via the reference doc. Inline runs (bold,
italic) emit as character formatting per pandoc defaults.

## Sub-Role Lines

`As Director of Engineering (...):` and `As Senior Software Engineering
Manager (...):` lines (Vrbo block) emit as bare paragraphs. They sit between
the role's H3 heading and the bullet list. If visual emphasis is needed,
update `resume-template.docx` to make the default paragraph style after H3
slightly bolder/italic, or pre-format these specific lines via inline `*…*`
in the canonical resume.

## Invocation

```typescript
import { renderResume } from 'src/resume-tailor/render';

await renderResume({
  markdownPath: 'output/{slug}/{Name}_Resume_{Co}.md',
  templatePath: 'references/resume-template.docx',
  outputPath:   'output/{slug}/{Name}_Resume_{Co}.docx',
});
```

The TS bridge spawns `scripts/render-resume.fish`, which preflights `pandoc`
(exit 4 with `brew install pandoc` instruction if missing), validates the
markdown and template paths (exit 1), runs pandoc (surfaces stderr on exit 2),
and verifies the output file was produced (exit 3).

## Page Count

```typescript
import { pageCount } from 'src/resume-tailor/page-count';

const pages = await pageCount('output/.../resume.docx');
```

Wraps `scripts/resume-page-count.fish` (`soffice` + `pdfinfo`).

## Restyling

Edit named styles in `references/resume-template.docx` (Word → Styles pane). Save.
No code change needed. The next render picks up the new visuals.
