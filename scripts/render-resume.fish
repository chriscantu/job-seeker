#!/usr/bin/env fish
# Usage: render-resume.fish <markdown-path> <template-path> <output-path>
# Renders markdown to docx via pandoc using the reference template.
# Exit codes: 0 success | 1 missing arg or input file | 2 pandoc non-zero exit | 3 pandoc produced no output | 4 pandoc not installed

if test (count $argv) -lt 3
    echo "usage: render-resume.fish <markdown-path> <template-path> <output-path>" >&2
    exit 1
end

if not which pandoc > /dev/null 2>&1
    echo "pandoc not found; install with: brew install pandoc" >&2
    exit 4
end

set md $argv[1]
set template $argv[2]
set out $argv[3]

if not test -f "$md"
    echo "markdown not found: $md" >&2
    exit 1
end

if not test -f "$template"
    echo "template not found: $template" >&2
    exit 1
end

set lua_filter (dirname (status filename))/strip-bookmarks.lua
set tmperr (mktemp)
pandoc "$md" --reference-doc="$template" --lua-filter="$lua_filter" -o "$out" 2> "$tmperr"
set pandoc_status $status

if test $pandoc_status -ne 0
    cat "$tmperr" >&2
    rm -f "$tmperr"
    exit 2
end

rm -f "$tmperr"

if not test -f "$out"
    echo "pandoc produced no output" >&2
    exit 3
end

# Post-process: force explicit centering on Tagline + SkillsLine paragraphs.
# Pandoc emits <w:pPr><w:pStyle .../></w:pPr> without explicit jc, and some
# Word readers don't apply the style's jc=center reliably on paragraphs that
# contain <w:br/> line breaks. Inject the alignment directly.
set tmpdir (mktemp -d)
unzip -q "$out" -d "$tmpdir"
set doc "$tmpdir/word/document.xml"
sed -i '' \
    -e 's|<w:pStyle w:val="Tagline" /></w:pPr>|<w:pStyle w:val="Tagline" /><w:jc w:val="center" /></w:pPr>|g' \
    -e 's|<w:pStyle w:val="Contact" /></w:pPr>|<w:pStyle w:val="Contact" /><w:jc w:val="center" /></w:pPr>|g' \
    "$doc"
set tmp_out (mktemp -u).docx
cd "$tmpdir"; zip -qr -X "$tmp_out" . -x ".*"; cd -
mv "$tmp_out" "$out"
rm -rf "$tmpdir"

exit 0
