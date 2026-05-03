#!/usr/bin/env fish
# Usage: resume-page-count.fish <docx-path>
# Outputs integer page count on success.
# Exit codes: 0 success | 1 missing arg or file not found | 2 soffice failed (incl. silent no-output) | 3 pdfinfo failed

if test (count $argv) -lt 1
    echo "usage: resume-page-count.fish <docx-path>" >&2
    exit 1
end

set docx $argv[1]

if not test -f "$docx"
    echo "file not found: $docx" >&2
    exit 1
end

set tmpdir (mktemp -d)
soffice --headless --convert-to pdf --outdir "$tmpdir" "$docx" > /dev/null 2>&1
or begin
    rm -rf "$tmpdir"
    echo "soffice conversion failed for $docx" >&2
    exit 2
end

set pdf "$tmpdir"/(basename "$docx" .docx).pdf

# soffice can exit 0 without producing the PDF on malformed input; verify presence.
if not test -f "$pdf"
    rm -rf "$tmpdir"
    echo "soffice produced no output for $docx" >&2
    exit 2
end

set pages (pdfinfo "$pdf" 2>/dev/null | grep -E '^Pages:' | awk '{print $2}')
rm -rf "$tmpdir"

if test -z "$pages"
    echo "pdfinfo could not read page count" >&2
    exit 3
end

echo $pages
