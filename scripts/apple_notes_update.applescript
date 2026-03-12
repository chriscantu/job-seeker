-- apple_notes_update.applescript
-- Updates the body of an existing note in an Apple Notes folder.
-- If the note does not exist, it is created (upsert semantics).
-- This is the right script for state notes (Seen Postings, Preferences,
-- Applications) where you always want the latest content without deleting
-- and recreating the note identity.
--
-- Arguments (positional, space-separated, each quoted):
--   1. title       — note title to find or create (case-insensitive match)
--   2. html_body   — new note body as HTML string
--   3. folder      — target Notes folder name (e.g. "Notes")
--
-- Returns (stdout):
--   "updated: {title}"    — existing note body replaced
--   "created: {title}"    — note did not exist; created fresh
--   "error: {message}"    — something went wrong
--
-- Usage:
--   osascript apple_notes_update.applescript "Job Search - Seen Postings" "<div>...</div>" "Notes"

on run argv
    -- Guard: require exactly 3 arguments
    if (count of argv) < 3 then
        return "error: Expected 3 arguments (title, body, folder) but got " & (count of argv)
    end if

    set noteTitle  to item 1 of argv
    set noteBody   to item 2 of argv
    set folderName to item 3 of argv

    tell application "Notes"
        try
            -- Step 1: Locate the folder; create if missing
            set targetFolder to missing value
            repeat with f in folders
                if name of f is folderName then
                    set targetFolder to f
                    exit repeat
                end if
            end repeat

            if targetFolder is missing value then
                try
                    set targetFolder to make new folder with properties {name: folderName}
                on error errMsg
                    return "error: Could not create folder '" & folderName & "' — " & errMsg
                end try
            end if

            -- Step 2: Look for an existing note (case-insensitive, trimmed)
            -- AppleScript's `is` operator is case-insensitive by default,
            -- so no manual lowercasing is needed.
            set existingNotes to every note of targetFolder
            repeat with n in existingNotes
                if (my trim(name of n)) is (my trim(noteTitle)) then
                    try
                        set body of n to noteBody
                        set name of n to noteTitle   -- prevents Notes from re-deriving title from body
                        return "updated: " & noteTitle
                    on error errMsg
                        return "error: Could not update note '" & noteTitle & "' — " & errMsg
                    end try
                end if
            end repeat

            -- Step 3: Note not found — create it (upsert)
            try
                make new note at targetFolder with properties {name: noteTitle, body: noteBody}
                return "created: " & noteTitle
            on error errMsg
                return "error: " & errMsg
            end try

        on error outerErr
            -- Catch any runtime error not handled by inner try blocks
            -- (e.g. iCloud sync timeout, Notes IPC failure, sandboxing denial)
            return "error: Unexpected Notes error — " & outerErr
        end try
    end tell
end run

-- Helper: trim leading/trailing whitespace from a string.
-- AppleScript's `is` operator is case-insensitive by default,
-- so no manual lowercasing is needed.
on trim(str)
    repeat while str begins with " "
        set str to text 2 thru -1 of str
    end repeat
    repeat while str ends with " "
        set str to text 1 thru -2 of str
    end repeat
    return str
end trim
