-- apple_mail_trash.applescript
-- NOTE: Account/mailbox lookup and toLower helper are duplicated in
-- apple_mail_scan.applescript and apple_mail_read.applescript. AppleScript
-- has no cross-file imports — keep all three files in sync if the lookup
-- strategy changes.
--
-- Moves a single email message to the account's Trash mailbox.
-- Used by scan-email Phase 6 to clean up processed job alert emails.
--
-- Two lookup modes:
--   • By index (legacy)        — fast but UNSAFE: indices shift when new mail
--                                arrives between scan and trash, causing silent
--                                wrong-message trashes. Avoid for multi-step flows.
--   • By message-ID (preferred) — stable across mailbox reorders. Use the
--                                 message_id field from apple_mail_scan output.
--
-- Arguments (positional, space-separated, each quoted):
--   By-index mode:
--     1. account_name   -- substring match for the Mail account (e.g. "iCloud")
--     2. inbox_name     -- exact mailbox name (e.g. "INBOX")
--     3. message_index  -- 1-based index of the message to trash
--
--   By-id mode:
--     1. account_name
--     2. inbox_name
--     3. "--by-id"
--     4. message_id     -- RFC822 Message-ID (with or without angle brackets)
--
-- Returns (stdout):
--   "trashed: {index}"           -- by-index mode success
--   "trashed-by-id: {id}"        -- by-id mode success
--   "ACCOUNT_NOT_FOUND"
--   "MAILBOX_NOT_FOUND"
--   "TRASH_NOT_FOUND"
--   "MESSAGE_NOT_FOUND"          -- index out of range OR message-id not found
--   "error: {message}"
--
-- Usage:
--   osascript apple_mail_trash.applescript "iCloud" "INBOX" 3
--   osascript apple_mail_trash.applescript "iCloud" "INBOX" --by-id "<abc123@mail.gmail.com>"

on run argv
    if (count of argv) < 3 then
        return "error: Expected 3+ arguments (account_name, inbox_name, message_index | --by-id message_id) but got " & (count of argv)
    end if

    set accountName to item 1 of argv
    set inboxName to item 2 of argv

    -- Detect lookup mode
    set lookupMode to "index"
    set msgIdx to 0
    set msgIdValue to ""
    if (item 3 of argv) is "--by-id" then
        if (count of argv) < 4 then
            return "error: --by-id requires a message_id argument"
        end if
        set lookupMode to "id"
        set msgIdValue to item 4 of argv
    else
        try
            set msgIdx to (item 3 of argv) as integer
        on error
            return "error: Argument 3 must be an integer index or --by-id, got: " & item 3 of argv
        end try
    end if

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

            -- Step 2: Locate the source mailbox
            set targetMailbox to missing value
            try
                set targetMailbox to mailbox inboxName of targetAccount
            on error
                -- Try case-insensitive search
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

            -- Step 3: Locate the Trash mailbox
            set trashMailbox to missing value
            repeat with mb in mailboxes of targetAccount
                set mbName to my toLower(name of mb)
                if mbName is "trash" or mbName is "deleted messages" or mbName is "bin" then
                    set trashMailbox to mb
                    exit repeat
                end if
            end repeat

            if trashMailbox is missing value then
                return "TRASH_NOT_FOUND"
            end if

            -- Step 4: Locate message by index OR message-id
            if lookupMode is "index" then
                set msgCount to count of messages of targetMailbox
                if msgIdx > msgCount or msgIdx < 1 then
                    return "MESSAGE_NOT_FOUND"
                end if
                set msg to message msgIdx of targetMailbox
                move msg to trashMailbox
                return "trashed: " & msgIdx
            else
                -- By-id mode: try with and without angle brackets, since callers may
                -- pass either form. Mail's `message id` property includes the brackets.
                set normalizedId to msgIdValue
                if normalizedId does not start with "<" then
                    set normalizedId to "<" & normalizedId & ">"
                end if
                set bareId to normalizedId
                if bareId starts with "<" then set bareId to text 2 thru -2 of bareId
                set foundMsgs to (messages of targetMailbox whose message id is normalizedId)
                if (count of foundMsgs) is 0 then
                    set foundMsgs to (messages of targetMailbox whose message id is bareId)
                end if
                if (count of foundMsgs) is 0 then
                    return "MESSAGE_NOT_FOUND"
                end if
                move (item 1 of foundMsgs) to trashMailbox
                return "trashed-by-id: " & msgIdValue
            end if

        on error outerErr
            return "error: Unexpected Mail error -- " & outerErr
        end try
    end tell
end run

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
