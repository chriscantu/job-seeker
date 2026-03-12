-- apple_notes_read.applescript
-- Reads the plaintext body of a named note from an Apple Notes folder.
-- Returns the full note body as plaintext (HTML tags stripped by Notes).
--
-- Arguments (positional, space-separated, each quoted):
--   1. title    — exact note title to look up (case-insensitive match)
--   2. folder   — source Notes folder name (e.g. "Notes")
--
-- Returns (stdout):
--   Note plaintext body     — if found
--   "NOTE_NOT_FOUND"        — note does not exist in that folder
--   "FOLDER_NOT_FOUND"      — folder does not exist
--   "error: {message}"      — something went wrong
--
-- Usage:
--   osascript apple_notes_read.applescript "Job Search - Seen Postings" "Notes"

on run argv
    set noteTitle  to item 1 of argv
    set folderName to item 2 of argv

    tell application "Notes"

        -- Step 1: Locate the folder
        set targetFolder to missing value
        repeat with f in folders
            if name of f is folderName then
                set targetFolder to f
                exit repeat
            end if
        end repeat

        if targetFolder is missing value then
            return "FOLDER_NOT_FOUND"
        end if

        -- Step 2: Find the note by title (case-insensitive, trimmed)
        set existingNotes to every note of targetFolder
        repeat with n in existingNotes
            if (my trim(name of n)) is (my trim(noteTitle)) then
                try
                    return plaintext of n
                on error errMsg
                    return "error: Could not read note '" & noteTitle & "' — " & errMsg
                end try
            end if
        end repeat

        return "NOTE_NOT_FOUND"

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
