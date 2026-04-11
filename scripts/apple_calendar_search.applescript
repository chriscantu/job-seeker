-- apple_calendar_search.applescript
-- Searches Calendar.app for events matching keywords within a date range.
-- Returns JSON-formatted results to stdout.
--
-- Arguments (positional, space-separated, each quoted):
--   1. keywords    — comma-separated list of keywords to match (case-insensitive)
--   2. days_ahead  — number of days from now to search (e.g. "7")
--
-- Returns (stdout):
--   JSON array of matching events, each with: title, datetime, end_datetime,
--   description, calendar_name
--   "NO_EVENTS_FOUND"   — no events matched
--   "error: {message}"  — something went wrong
--
-- Timestamps are in local system time with no UTC offset. Downstream consumers
-- should be aware that these are not timezone-qualified ISO 8601 strings.
--
-- Usage (path relative to plugin root):
--   osascript scripts/apple_calendar_search.applescript "interview,screen,technical" "7"
--   The actual keyword list is driven by integrations/config/calendar-config.md.

on run argv
    -- Guard: require exactly 2 arguments
    if (count of argv) < 2 then
        return "error: Expected 2 arguments (keywords, days_ahead) but got " & (count of argv)
    end if

    set keywordString to item 1 of argv
    set daysAheadStr to item 2 of argv

    -- Validate days_ahead is non-empty and numeric
    if daysAheadStr is "" then
        return "error: days_ahead argument is empty — expected a positive integer"
    end if
    try
        set daysAhead to daysAheadStr as integer
    on error
        return "error: days_ahead argument '" & daysAheadStr & "' is not a valid integer"
    end try
    if daysAhead < 1 then
        return "error: days_ahead must be a positive integer, got " & daysAhead
    end if

    -- Validate keywords is non-empty
    if keywordString is "" then
        return "error: keywords argument is empty — expected comma-separated keyword list"
    end if

    -- Parse comma-separated keywords into a list
    set AppleScript's text item delimiters to ","
    set keywordList to text items of keywordString
    set AppleScript's text item delimiters to ""

    -- Trim whitespace from each keyword and lowercase once (avoid per-event shell calls)
    set loweredKeywords to {}
    repeat with kw in keywordList
        set trimmed to my trim(kw)
        if trimmed is not "" then
            set end of loweredKeywords to my toLower(trimmed)
        end if
    end repeat

    if (count of loweredKeywords) is 0 then
        return "error: no valid keywords after parsing — check calendar config"
    end if

    set startDate to current date
    set endDate to startDate + (daysAhead * days)

    -- Collect raw event data from Calendar, then build JSON outside the tell block.
    -- This separation ensures that helper function errors (buildJSON, jsonString)
    -- are not misattributed to Calendar IPC failures.
    set rawEvents to {}

    tell application "Calendar"
        try
            repeat with cal in calendars
                set calName to name of cal
                set evts to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
                repeat with evt in evts
                    set evtTitle to summary of evt

                    -- Description is optional — read with explicit error handling
                    set evtDescription to ""
                    try
                        set evtDescription to description of evt
                        if evtDescription is missing value then set evtDescription to ""
                    on error
                        set evtDescription to ""
                    end try

                    set searchText to my toLower(evtTitle & " " & evtDescription)

                    repeat with kw in loweredKeywords
                        if searchText contains kw then
                            set evtStart to start date of evt
                            set evtEnd to end date of evt
                            set end of rawEvents to {evtTitle, evtStart, evtEnd, evtDescription, calName}
                            exit repeat
                        end if
                    end repeat
                end repeat
            end repeat
        on error errMsg
            return "error: Calendar query failed — " & errMsg
        end try
    end tell

    if (count of rawEvents) is 0 then
        return "NO_EVENTS_FOUND"
    end if

    -- Build JSON outside the Calendar tell block so helper errors are distinct
    try
        set jsonArray to "["
        repeat with i from 1 to count of rawEvents
            set evt to item i of rawEvents
            set evtJSON to my buildJSON(item 1 of evt, item 2 of evt, item 3 of evt, item 4 of evt, item 5 of evt)
            set jsonArray to jsonArray & evtJSON
            if i < (count of rawEvents) then
                set jsonArray to jsonArray & ","
            end if
        end repeat
        set jsonArray to jsonArray & "]"
        return jsonArray
    on error errMsg
        return "error: JSON assembly failed — " & errMsg
    end try
end run

on buildJSON(evtTitle, evtStart, evtEnd, evtDescription, calName)
    set isoStart to my toISO(evtStart)
    set isoEnd to my toISO(evtEnd)
    set json to "{"
    set json to json & "\"title\":" & my jsonString(evtTitle) & ","
    set json to json & "\"datetime\":\"" & isoStart & "\","
    set json to json & "\"end_datetime\":\"" & isoEnd & "\","
    set json to json & "\"description\":" & my jsonString(evtDescription) & ","
    set json to json & "\"calendar_name\":" & my jsonString(calName)
    set json to json & "}"
    return json
end buildJSON

on jsonString(str)
    -- Escape backslashes first, then quotes and newlines for JSON
    set str to my replaceText(str, "\\", "\\\\")
    set str to my replaceText(str, "\"", "\\\"")
    set str to my replaceText(str, return, "\\n")
    set str to my replaceText(str, linefeed, "\\n")
    set str to my replaceText(str, (ASCII character 9), "\\t")
    return "\"" & str & "\""
end jsonString

on replaceText(theText, searchString, replacementString)
    set AppleScript's text item delimiters to searchString
    set theItems to text items of theText
    set AppleScript's text item delimiters to replacementString
    set theText to theItems as text
    set AppleScript's text item delimiters to ""
    return theText
end replaceText

on toLower(str)
    try
        set lowStr to do shell script "echo " & quoted form of str & " | tr '[:upper:]' '[:lower:]'"
        return lowStr
    on error errMsg
        -- If shell fails, return original string rather than crashing
        return str
    end try
end toLower

-- Timestamps are in local system time with no UTC offset.
-- AppleScript's `current date` uses the system timezone.
on toISO(d)
    set y to year of d as string
    set m to my padZero(month of d as integer)
    set dy to my padZero(day of d)
    set h to my padZero(hours of d)
    set mn to my padZero(minutes of d)
    return y & "-" & m & "-" & dy & "T" & h & ":" & mn & ":00"
end toISO

on padZero(n)
    if n < 10 then
        return "0" & (n as string)
    else
        return n as string
    end if
end padZero

on trim(str)
    repeat while str begins with " "
        set str to text 2 thru -1 of str
    end repeat
    repeat while str ends with " "
        set str to text 1 thru -2 of str
    end repeat
    return str
end trim
