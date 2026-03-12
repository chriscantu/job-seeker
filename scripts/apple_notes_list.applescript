-- apple_notes_list.applescript
-- Lists all note titles in a named Apple Notes folder, one per line.
-- Used by skills to check what notes already exist before read/update.
--
-- Arguments (positional, space-separated, each quoted):
--   1. folder   — Notes folder name to list (e.g. "Notes")
--
-- Returns (stdout):
--   Newline-separated list of note titles — if folder exists and has notes
--   "SKIPPED_UNREADABLE:{N}" appended   — if N notes could not be read (partial result)
--   "" (empty string)                   — folder exists but is empty
--   "FOLDER_NOT_FOUND"                  — folder does not exist
--   "error: {message}"                  — something went wrong
--
-- Callers MUST check for lines beginning with "SKIPPED_UNREADABLE:" to detect
-- partial results. If a state note (e.g. "Job Search - Seen Postings") is absent
-- from the list, it may have been skipped rather than truly missing.
--
-- Usage:
--   osascript apple_notes_list.applescript "Notes"

on run argv
    -- Guard: require exactly 1 argument
    if (count of argv) < 1 then
        return "error: Expected 1 argument (folder) but got " & (count of argv)
    end if

    set folderName to item 1 of argv

    tell application "Notes"
        try
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
            set skippedCount to 0
            set existingNotes to every note of targetFolder
            set noteCount to count of existingNotes

            if noteCount is 0 then
                return ""
            end if

            repeat with i from 1 to noteCount
                set n to item i of existingNotes
                try
                    set noteName to name of n
                    if noteList is "" then
                        set noteList to noteName
                    else
                        set noteList to noteList & linefeed & noteName
                    end if
                on error
                    -- Count skipped notes; sentinel appended after loop so callers
                    -- can detect data loss rather than silently receiving a short list
                    set skippedCount to skippedCount + 1
                end try
            end repeat

            -- Surface partial-result warning when any note could not be read
            if skippedCount > 0 then
                if noteList is "" then
                    set noteList to "SKIPPED_UNREADABLE:" & skippedCount
                else
                    set noteList to noteList & linefeed & "SKIPPED_UNREADABLE:" & skippedCount
                end if
            end if

            return noteList

        on error outerErr
            -- Catch any runtime error not handled by inner try blocks
            -- (e.g. iCloud sync timeout, Notes IPC failure, sandboxing denial)
            return "error: Unexpected Notes error — " & outerErr
        end try
    end tell
end run
