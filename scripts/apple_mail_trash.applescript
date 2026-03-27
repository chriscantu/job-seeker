-- apple_mail_trash.applescript
-- NOTE: Account/mailbox lookup and toLower helper are duplicated in
-- apple_mail_scan.applescript and apple_mail_read.applescript. AppleScript
-- has no cross-file imports — keep all three files in sync if the lookup
-- strategy changes.
--
-- Moves a single email message by index to the account's Trash mailbox.
-- Used by scan-email Phase 6 to clean up processed job alert emails.
--
-- Arguments (positional, space-separated, each quoted):
--   1. account_name   -- substring match for the Mail account (e.g. "iCloud")
--   2. inbox_name     -- exact mailbox name (e.g. "INBOX")
--   3. message_index  -- 1-based index of the message to trash
--
-- Returns (stdout):
--   "trashed: {index}"           -- message moved to Trash
--   "ACCOUNT_NOT_FOUND"          -- no matching account
--   "MAILBOX_NOT_FOUND"          -- inbox not found in account
--   "TRASH_NOT_FOUND"            -- Trash mailbox not found in account
--   "MESSAGE_NOT_FOUND"          -- index out of range
--   "error: {message}"           -- something went wrong
--
-- Usage:
--   osascript apple_mail_trash.applescript "iCloud" "INBOX" 3

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

            -- Step 4: Check message exists
            set msgCount to count of messages of targetMailbox
            if msgIdx > msgCount or msgIdx < 1 then
                return "MESSAGE_NOT_FOUND"
            end if

            -- Step 5: Move message to Trash
            set msg to message msgIdx of targetMailbox
            move msg to trashMailbox

            return "trashed: " & msgIdx

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
