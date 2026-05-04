#!/usr/bin/env python3
# Force a hard page break before the second role (Babylon Health Heading3).
# Recruiter feedback: the Babylon role title was being squeezed at the bottom
# of page 1 with the bullets wrapping to page 2. Word's keep-with-next is
# supposed to prevent that but the renderer (LibreOffice/Word) doesn't always
# honor it on tight pages, so we set <w:pageBreakBefore/> explicitly on that
# specific Heading3.
import re
import sys


def main(path: str) -> None:
    with open(path) as f:
        xml = f.read()
    new_xml = re.sub(
        r'(<w:pPr>)(<w:pStyle w:val="Heading3" />)(</w:pPr><w:r[^>]*><w:t[^>]*>Director of Front-End Platforms)',
        r'\1\2<w:pageBreakBefore/>\3',
        xml,
        count=1,
    )
    with open(path, 'w') as f:
        f.write(new_xml)


if __name__ == '__main__':
    main(sys.argv[1])
