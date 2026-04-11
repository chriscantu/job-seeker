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
-- Usage:
--   osascript apple_calendar_search.applescript "interview,screen,technical,hiring manager,recruiter,panel,culture fit,final round,onsite,phone screen" "7"

on run argv
    if (count of argv) < 2 then
        return "error: Expected 2 arguments (keywords, days_ahead) but got " & (count of argv)
    end if

    set keywordString to item 1 of argv
    set daysAhead to (item 2 of argv) as integer

    -- Parse comma-separated keywords into a list
    set AppleScript's text item delimiters to ","
    set keywordList to text items of keywordString
    set AppleScript's text item delimiters to ""

    -- Trim whitespace from each keyword
    set trimmedKeywords to {}
    repeat with kw in keywordList
        set end of trimmedKeywords to my trim(kw)
    end repeat

    set startDate to current date
    set endDate to startDate + (daysAhead * days)

    set matchedEvents to {}

    tell application "Calendar"
        try
            repeat with cal in calendars
                set calName to name of cal
                set evts to (every event of cal whose start date ≥ startDate and start date ≤ endDate)
                repeat with evt in evts
                    set evtTitle to summary of evt
                    set evtDescription to ""
                    try
                        set evtDescription to description of evt
                    end try
                    if evtDescription is missing value then set evtDescription to ""

                    set searchText to my toLower(evtTitle & " " & evtDescription)

                    repeat with kw in trimmedKeywords
                        if searchText contains my toLower(kw) then
                            set evtStart to start date of evt
                            set evtEnd to end date of evt
                            set evtJSON to my buildJSON(evtTitle, evtStart, evtEnd, evtDescription, calName)
                            set end of matchedEvents to evtJSON
                            exit repeat
                        end if
                    end repeat
                end repeat
            end repeat

            if (count of matchedEvents) is 0 then
                return "NO_EVENTS_FOUND"
            end if

            -- Build JSON array
            set jsonArray to "["
            repeat with i from 1 to count of matchedEvents
                set jsonArray to jsonArray & item i of matchedEvents
                if i < (count of matchedEvents) then
                    set jsonArray to jsonArray & ","
                end if
            end repeat
            set jsonArray to jsonArray & "]"
            return jsonArray

        on error errMsg
            return "error: Calendar search failed — " & errMsg
        end try
    end tell
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
    -- Escape backslashes, quotes, and newlines for JSON
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
    set lowStr to do shell script "echo " & quoted form of str & " | tr '[:upper:]' '[:lower:]'"
    return lowStr
end toLower

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
