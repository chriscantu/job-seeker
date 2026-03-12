-- apple_notes_create.applescript
-- Creates a note in a named Apple Notes folder.
-- If a note with the same title already exists in that folder, it is deleted
-- and recreated (digest always reflects the latest run — no stale content).
--
-- Arguments (positional, space-separated, each quoted):
--   1. title       — note title (must be unique within the folder)
--   2. html_body   — note body as HTML string (Apple Notes HTML rules apply)
--   3. folder      — target Notes folder name (e.g. "Notes")
--
-- Returns (stdout):
--   "success: {title}"   — note created (or replaced)
--   "error: {message}"   — something went wrong
--
-- Usage:
--   osascript apple_notes_create.applescript "Daily Digest 2026-03-11" "<div>...</div>" "Notes"
--
-- Apple Notes HTML rules (enforced by caller, not this script):
--   - Every line wrapped in <div>...</div>
--   - No <a href="..."> inside table cells
--   - Use <span style="font-size: Xpx"> for sizing (no <h1>/<h2>/<h3>)
--   - HTML is passed as a single quoted argument — caller must escape quotes

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
            -- Step 1: Locate the target folder; create it if missing
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

            -- Step 2: Dedup check — delete existing note with the same title
            --         (case-insensitive, whitespace-trimmed via AppleScript's `is`)
            set existingNotes to every note of targetFolder
            repeat with n in existingNotes
                if (my trim(name of n)) is (my trim(noteTitle)) then
                    try
                        delete n
                    on error errMsg
                        return "error: Could not delete existing note '" & noteTitle & "' — " & errMsg
                    end try
                    exit repeat
                end if
            end repeat

            -- Step 3: Create the note
            try
                make new note at targetFolder with properties {name: noteTitle, body: noteBody}
                return "success: " & noteTitle
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
