-- apple_notes_list.applescript
-- Lists all note titles in a named Apple Notes folder, one per line.
-- Used by skills to check what notes already exist before read/update.
--
-- Arguments (positional, space-separated, each quoted):
--   1. folder   — Notes folder name to list (e.g. "Notes")
--
-- Returns (stdout):
--   Newline-separated list of note titles — if folder exists and has notes
--   "" (empty string)       — folder exists but is empty
--   "FOLDER_NOT_FOUND"      — folder does not exist
--   "error: {message}"      — something went wrong
--
-- Usage:
--   osascript apple_notes_list.applescript "Notes"

on run argv
    set folderName to item 1 of argv

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

        -- Step 2: Collect all note titles
        set noteList to ""
        set existingNotes to every note of targetFolder
        set noteCount to count of existingNotes

        if noteCount is 0 then
            return ""
        end if

        repeat with i from 1 to noteCount
            set n to item i of existingNotes
            try
                set noteName to name of n
                if i is 1 then
                    set noteList to noteName
                else
                    set noteList to noteList & linefeed & noteName
                end if
            on error errMsg
                -- Skip unreadable notes rather than failing the whole list
            end try
        end repeat

        return noteList

    end tell
end run
