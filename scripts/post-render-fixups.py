#!/usr/bin/env python3
"""Post-render fixups applied to the rendered docx's word/document.xml.

Pandoc's reference-doc rendering is tolerant of custom paragraph styles but
inconsistently applies inherited run-level properties (colors especially)
when the run has no explicit rPr. These fixups inject the necessary OOXML
directly so the rendered docx matches the recruiter-reviewed PDF.
"""
import re
import sys


def force_babylon_page_break(xml: str) -> str:
    """Force <w:pageBreakBefore/> on the Babylon Heading3.

    Word's keep-with-next on Heading3 + RoleMeta isn't reliably honored when
    the available space is tight enough for the heading + meta to barely fit
    while the first bullet wraps to the next page. Hard-pinning the break
    keeps the section visually intact.
    """
    return re.sub(
        r'(<w:pPr>)(<w:pStyle w:val="Heading3" />)(</w:pPr><w:r[^>]*><w:t[^>]*>Director of Front-End Platforms)',
        r'\1\2<w:pageBreakBefore/>\3',
        xml,
        count=1,
    )


def force_tagline_color(xml: str) -> str:
    """Inject <w:color w:val="153D63"/> on every run inside the Tagline
    paragraph (tagline + contact, joined by <w:br/>).

    Pandoc emits the runs without rPr, expecting Word to inherit color from
    the Tagline paragraph style. Word's renderer doesn't apply that
    inherited color reliably across all clients (Word/Pages/LibreOffice
    differ), so we set the color on each run explicitly.
    """
    def colorize_runs(match: re.Match[str]) -> str:
        body = match.group(0)
        return re.sub(
            r'<w:r>(<w:(?:t|br)\b)',
            r'<w:r><w:rPr><w:color w:val="153D63" /></w:rPr>\1',
            body,
        )

    return re.sub(
        r'<w:p\b[^>]*><w:pPr><w:pStyle w:val="Tagline" />(?:[^<]|<(?!w:p\b))*?</w:p>',
        colorize_runs,
        xml,
        flags=re.DOTALL,
    )


def main(path: str) -> None:
    with open(path) as f:
        xml = f.read()
    xml = force_babylon_page_break(xml)
    xml = force_tagline_color(xml)
    with open(path, 'w') as f:
        f.write(xml)


if __name__ == '__main__':
    main(sys.argv[1])
