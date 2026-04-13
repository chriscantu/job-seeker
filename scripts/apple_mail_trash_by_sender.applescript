-- apple_mail_trash_by_sender.applescript
-- NOTE: Account/mailbox lookup logic mirrors apple_mail_scan.applescript and
-- apple_mail_trash.applescript. AppleScript has no cross-file imports — keep
-- in sync if the lookup strategy changes.
--
-- Trashes all messages in an inbox whose sender matches any pattern in a
-- comma-separated list. Uses Mail's `whose sender contains` query so the
-- match is by sender substring, not by index — immune to index shifts when
-- new mail arrives mid-sequence.
--
-- Used by scan-email Phase 6 to clean up aggregator/staffing senders
-- (Lensa, Ladders, Jobgether, etc.) that should never accumulate in the
-- inbox regardless of whether their bodies were fetched.
--
-- Arguments (positional, space-separated, each quoted):
--   1. account_name      -- substring match for the Mail account (e.g. "iCloud")
--   2. inbox_name        -- exact mailbox name (e.g. "INBOX")
--   3. sender_patterns   -- comma-separated sender substrings (e.g. "lensa.com,ladders.com")
--
-- Returns (stdout):
--   "trashed: lensa.com=3/3 ladders.com=2/2 ..."  -- per-pattern moved/matched
--   The format `moved/matched` distinguishes a quiet run (pattern=0/0) from
--   a partial failure (pattern=2/5 means 5 matched, only 2 actually moved).
--   If any pattern has moved < matched, a `(errors: {last_error})` suffix is
--   appended so the caller can surface the cause.
--   Substrings must NOT contain commas (the script splits input on commas).
--   "ACCOUNT_NOT_FOUND"
--   "MAILBOX_NOT_FOUND"
--   "TRASH_NOT_FOUND"
--   "error: {message}"
--
-- Usage:
--   osascript apple_mail_trash_by_sender.applescript "iCloud" "INBOX" "lensa.com,ladders.com"

on run argv
    if (count of argv) < 3 then
        return "error: Expected 3 arguments (account_name, inbox_name, sender_patterns)"
    end if

    set accountName to item 1 of argv
    set inboxName to item 2 of argv
    set patternList to my splitOn(item 3 of argv, ",")

    tell application "Mail"
        try
            -- Locate the account
            set targetAccount to missing value
            repeat with acct in accounts
                if name of acct contains accountName then
                    set targetAccount to acct
                    exit repeat
                end if
            end repeat
            if targetAccount is missing value then return "ACCOUNT_NOT_FOUND"

            -- Locate the source mailbox
            set sourceMb to missing value
            try
                set sourceMb to mailbox inboxName of targetAccount
            on error
                repeat with mb in mailboxes of targetAccount
                    if (my toLower(name of mb)) is (my toLower(inboxName)) then
                        set sourceMb to mb
                        exit repeat
                    end if
                end repeat
            end try
            if sourceMb is missing value then return "MAILBOX_NOT_FOUND"

            -- Locate the Trash mailbox
            set trashMb to missing value
            repeat with mb in mailboxes of targetAccount
                set mbName to my toLower(name of mb)
                if mbName is "trash" or mbName is "deleted messages" or mbName is "bin" then
                    set trashMb to mb
                    exit repeat
                end if
            end repeat
            if trashMb is missing value then return "TRASH_NOT_FOUND"

            -- Trash messages matching each pattern.
            -- We track moved vs matched separately so a swallowed move failure
            -- (permissions, mailbox lock, mid-loop conflict) shows up in the
            -- output instead of being silently dropped — the whole point of
            -- this script is to NOT silently lose messages.
            set resultParts to {}
            repeat with pat in patternList
                set patStr to (contents of pat) as text
                set matched to (messages of sourceMb whose sender contains patStr)
                set matchCount to count of matched
                set movedCount to 0
                set lastError to ""
                -- Reverse order: the matched list is a snapshot reference, so
                -- moving from highest index down keeps lower indices valid.
                repeat with i from matchCount to 1 by -1
                    try
                        move (item i of matched) to trashMb
                        set movedCount to movedCount + 1
                    on error errMsg
                        set lastError to errMsg
                    end try
                end repeat
                set partResult to patStr & "=" & movedCount & "/" & matchCount
                if movedCount < matchCount then
                    set partResult to partResult & " (errors: " & lastError & ")"
                end if
                set end of resultParts to partResult
            end repeat

            return "trashed: " & my joinList(resultParts, " ")
        on error outerErr
            return "error: " & outerErr
        end try
    end tell
end run

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

on splitOn(theString, theDelim)
    set AppleScript's text item delimiters to theDelim
    set theItems to text items of theString
    set AppleScript's text item delimiters to ""
    return theItems
end splitOn

on joinList(theList, theDelim)
    set AppleScript's text item delimiters to theDelim
    set theStr to theList as text
    set AppleScript's text item delimiters to ""
    return theStr
end joinList
