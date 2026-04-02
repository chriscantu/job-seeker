-- apple_mail_read.applescript
-- NOTE: Account/mailbox lookup and toLower helper are duplicated in
-- apple_mail_scan.applescript. AppleScript has no cross-file imports —
-- keep both files in sync if the lookup strategy changes.
--
-- Fetches the body of a single email message by index from an Apple Mail inbox.
-- Returns up to 4000 ASCII-safe characters of the message source (RFC 2822
-- format, including MIME headers and body) for URL extraction from href
-- attributes. Falls back to plaintext content if source is unavailable.
--
-- Arguments (positional, space-separated, each quoted):
--   1. account_name   -- substring match for the Mail account (e.g. "iCloud")
--   2. inbox_name     -- exact mailbox name (e.g. "INBOX")
--   3. message_index  -- 1-based index of the message to read
--
-- Returns (stdout):
--   "HTML:" followed by up to 12000 ASCII-safe chars of the MIME body
--         (headers are skipped to maximize useful content for URL extraction)
--   "TEXT:" followed by up to 12000 ASCII-safe chars of plaintext content
--   "BODY_UNAVAILABLE: {reason}"  -- body could not be retrieved
--   "ACCOUNT_NOT_FOUND"           -- no matching account
--   "MAILBOX_NOT_FOUND"           -- inbox not found in account
--   "MESSAGE_NOT_FOUND"           -- index out of range
--   "error: {message}"            -- something went wrong
--
-- Usage:
--   osascript apple_mail_read.applescript "iCloud" "INBOX" 3

on run argv
    -- Guard: require exactly 3 arguments
    if (count of argv) < 3 then
        return "error: Expected 3 arguments (account_name, inbox_name, message_index) but got " & (count of argv)
    end if

    set accountName to item 1 of argv
    set inboxName to item 2 of argv
    try
        set msgIdx to (item 3 of argv) as integer
    on error
        return "error: Argument 3 (message_index) must be an integer, got: " & item 3 of argv
    end try

    tell application "Mail"
        try
            -- Step 1: Locate the account (substring match)
            set targetAccount to missing value
            repeat with acct in accounts
                if name of acct contains accountName then
                    set targetAccount to acct
                    exit repeat
                end if
            end repeat

            if targetAccount is missing value then
                return "ACCOUNT_NOT_FOUND"
            end if

            -- Step 2: Locate the mailbox
            set targetMailbox to missing value
            try
                set targetMailbox to mailbox inboxName of targetAccount
            on error
                repeat with mb in mailboxes of targetAccount
                    if (my toLower(name of mb)) is (my toLower(inboxName)) then
                        set targetMailbox to mb
                        exit repeat
                    end if
                end repeat
            end try

            if targetMailbox is missing value then
                return "MAILBOX_NOT_FOUND"
            end if

            -- Step 3: Check message exists
            set msgCount to count of messages of targetMailbox
            if msgIdx > msgCount or msgIdx < 1 then
                return "MESSAGE_NOT_FOUND"
            end if

            set msg to message msgIdx of targetMailbox

            -- Step 4: Try source first (HTML/MIME -- needed for href URL extraction)
            -- Skip past headers to the body (first blank line separator)
            set sourceError to ""
            try
                set rawSource to source of msg
                if rawSource is not "" and rawSource is not missing value then
                    set bodyContent to my extractBody(rawSource)
                    set safeText to my sanitize(bodyContent, 12000)
                    if length of safeText > 0 then
                        return "HTML:" & safeText
                    end if
                    -- Source existed but produced no ASCII-safe content
                    set sourceError to "source contained no ASCII-safe characters after header skip"
                end if
            on error errMsg
                set sourceError to errMsg
            end try

            -- Step 5: Fall back to plaintext content
            try
                set plainContent to content of msg
                if plainContent is not "" and plainContent is not missing value then
                    set safeText to my sanitize(plainContent, 12000)
                    if length of safeText > 0 then
                        return "TEXT:" & safeText
                    end if
                end if
            on error errMsg
                if sourceError is not "" then
                    return "BODY_UNAVAILABLE: source failed (" & sourceError & "), content also failed -- " & errMsg
                end if
                return "BODY_UNAVAILABLE: content fetch failed -- " & errMsg
            end try

            if sourceError is not "" then
                return "BODY_UNAVAILABLE: source failed (" & sourceError & "), content was empty"
            end if
            return "BODY_UNAVAILABLE: both source and content were empty or non-ASCII"

        on error outerErr
            return "error: Unexpected Mail error -- " & outerErr
        end try
    end tell
end run

-- Helper: extract body from RFC 2822 source by skipping past headers.
-- Headers end at the first blank line (CRLF+CRLF or LF+LF).
-- Returns the body portion, or the full source if no separator is found.
on extractBody(src)
    -- Try CRLF first (standard RFC 2822), then bare LF
    set crlfSep to (ASCII character 13) & (ASCII character 10) & (ASCII character 13) & (ASCII character 10)
    set lfSep to (ASCII character 10) & (ASCII character 10)

    set bodyStart to 0
    try
        set AppleScript's text item delimiters to crlfSep
        set parts to text items of src
        set AppleScript's text item delimiters to ""
        if (count of parts) > 1 then
            -- Skip the first part (headers), rejoin the rest
            set bodyParts to items 2 thru -1 of parts
            set AppleScript's text item delimiters to crlfSep
            set bodyText to bodyParts as text
            set AppleScript's text item delimiters to ""
            return bodyText
        end if
    on error
        set AppleScript's text item delimiters to ""
    end try

    -- Try bare LF separator
    try
        set AppleScript's text item delimiters to lfSep
        set parts to text items of src
        set AppleScript's text item delimiters to ""
        if (count of parts) > 1 then
            set bodyParts to items 2 thru -1 of parts
            set AppleScript's text item delimiters to lfSep
            set bodyText to bodyParts as text
            set AppleScript's text item delimiters to ""
            return bodyText
        end if
    on error
        set AppleScript's text item delimiters to ""
    end try

    -- No blank line found — return full source as fallback
    return src
end extractBody

-- Helper: strip non-ASCII characters (keep codepoints 32-126 plus tab/CR/LF)
-- and cap at charLimit characters. Prevents serialization errors from embedded
-- images (U+FFFC object replacement char) and other non-printable characters.
-- Output may be shorter than charLimit for content with heavy non-ASCII characters.
on sanitize(str, charLimit)
    set safeText to ""
    set strLen to length of str
    if strLen < charLimit then set charLimit to strLen
    set safeCount to 0
    set i to 1
    -- Scan up to charLimit * 2 raw chars to collect charLimit safe chars
    set scanLimit to charLimit * 2
    if scanLimit > strLen then set scanLimit to strLen
    repeat while i is less than or equal to scanLimit and safeCount < charLimit
        set ch to character i of str
        set cp to id of ch
        if cp is greater than or equal to 32 and cp is less than or equal to 126 then
            set safeText to safeText & ch
            set safeCount to safeCount + 1
        else if cp is 10 or cp is 13 or cp is 9 then
            -- Preserve newlines and tabs (useful for parsing)
            set safeText to safeText & ch
            set safeCount to safeCount + 1
        end if
        set i to i + 1
    end repeat
    return safeText
end sanitize

-- Helper: lowercase a string for case-insensitive comparison.
on toLower(str)
    set lowered to ""
    repeat with i from 1 to length of str
        set ch to character i of str
        set cp to id of ch
        if cp is greater than or equal to 65 and cp is less than or equal to 90 then
            set lowered to lowered & (character id (cp + 32))
        else
            set lowered to lowered & ch
        end if
    end repeat
    return lowered
end toLower
