#!/bin/bash
# PII Guard — PreToolUse hook for Write and Edit
#
# Reads the tool call JSON from stdin. If the file_path is outside output/
# and the content contains PII patterns (email, phone, address), block the
# write with a non-zero exit code and a warning message.
#
# This hook is a safety net for the repo-public-eventually plan — prevents
# accidentally writing PII into committed files.

# Read tool input from stdin
input=$(cat)

# Extract file_path from the JSON
file_path=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Handle both Write (file_path) and Edit (file_path) tool inputs
    print(d.get('tool_input', {}).get('file_path', ''))
except:
    print('')
" 2>/dev/null)

# If we can't determine the file path, allow the write
if [ -z "$file_path" ]; then
    exit 0
fi

# Allow writes to output/ (gitignored, expected to contain PII)
if echo "$file_path" | grep -q "/output/"; then
    exit 0
fi

# Allow writes to references/ (gitignored, expected to contain PII)
if echo "$file_path" | grep -q "/references/"; then
    exit 0
fi

# Allow writes to config/ (gitignored personal config)
if echo "$file_path" | grep -q "/config/candidate\.md\|/config/search\.md"; then
    exit 0
fi

# Allow writes to memory/ (gitignored)
if echo "$file_path" | grep -q "/.claude/"; then
    exit 0
fi

# Allow writes to /tmp/
if echo "$file_path" | grep -q "^/tmp/\|^/private/tmp/"; then
    exit 0
fi

# Extract content to check (new_string for Edit, content for Write)
content=$(echo "$input" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ti = d.get('tool_input', {})
    # Edit uses new_string, Write uses content
    print(ti.get('content', '') or ti.get('new_string', ''))
except:
    print('')
" 2>/dev/null)

# If no content to check, allow
if [ -z "$content" ]; then
    exit 0
fi

# Check for PII patterns
# Phone numbers (various formats)
if echo "$content" | grep -qE '\b[0-9]{3}[-.]?[0-9]{3}[-.]?[0-9]{4}\b'; then
    echo "⚠️  PII guard: content appears to contain a phone number. File: $file_path"
    echo "This file is not gitignored. Move PII to output/ or references/ instead."
    exit 2
fi

# Street addresses (number + street name pattern)
if echo "$content" | grep -qiE '\b[0-9]+\s+(N\.|S\.|E\.|W\.|North|South|East|West|NE|NW|SE|SW)?\s*[A-Z][a-z]+\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place)\b'; then
    echo "⚠️  PII guard: content appears to contain a street address. File: $file_path"
    echo "This file is not gitignored. Move PII to output/ or references/ instead."
    exit 2
fi

# All checks passed
exit 0
