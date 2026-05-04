#!/usr/bin/env fish
# Usage: render-resume.fish <markdown-path> <template-path> <output-path>
# Renders markdown to docx via pandoc using the reference template, then
# applies post-render fixups (TS module: src/resume-tailor/post-render-fixups.ts)
# to inject styling pandoc doesn't emit reliably (centering, color cascade,
# Babylon page break, bookmark strip).
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

set tmperr (mktemp)
pandoc "$md" --reference-doc="$template" -o "$out" 2> "$tmperr"
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

set fixups_module (dirname (status filename))/../src/resume-tailor/post-render-fixups.ts
bun run "$fixups_module" "$out"

exit 0
