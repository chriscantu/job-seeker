-- apple_mail_scan.applescript
-- Batch metadata extraction from an Apple Mail inbox.
-- Returns subject, sender, date received, and message index for a range of messages.
-- Designed for 10-message batches to avoid osascript timeouts.
--
-- Arguments (positional, space-separated, each quoted):
--   1. account_name  — substring match for the Mail account (e.g. "iCloud")
--   2. inbox_name    — exact mailbox name (e.g. "INBOX")
--   3. start_index   — first message to fetch (1-based, most recent = 1)
--   4. end_index     — last message to fetch
--
-- Returns (stdout):
--   Newline-delimited records, each: subject|||sender|||date_received|||message_index
--   "NO_MESSAGES"        — mailbox has fewer messages than start_index
--   "ACCOUNT_NOT_FOUND"  — no matching account
--   "MAILBOX_NOT_FOUND"  — inbox not found in account
--   "error: {message}"   — something went wrong
--
-- Usage:
--   osascript apple_mail_scan.applescript "iCloud" "INBOX" 1 10

on run argv
	-- Guard: require exactly 4 arguments
	if (count of argv) < 4 then
		return "error: Expected 4 arguments (account_name, inbox_name, start_index, end_index) but got " & (count of argv)
	end if

	set accountName to item 1 of argv
	set inboxName to item 2 of argv
	set startIdx to (item 3 of argv) as integer
	set endIdx to (item 4 of argv) as integer

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

			-- Step 2: Locate the mailbox
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

			-- Step 3: Check message count
			set msgCount to count of messages of targetMailbox
			if msgCount < startIdx then
				return "NO_MESSAGES"
			end if

			-- Cap end index to actual message count
			if endIdx > msgCount then
				set endIdx to msgCount
			end if

			-- Step 4: Extract metadata for the range
			set results to {}
			repeat with i from startIdx to endIdx
				try
					set msg to message i of targetMailbox
					set msgSubject to my sanitize(subject of msg)
					set msgSender to my sanitize(sender of msg)
					set msgDate to (date received of msg) as string
					set msgIndex to i as string
					set end of results to msgSubject & "|||" & msgSender & "|||" & msgDate & "|||" & msgIndex
				on error errMsg
					-- Skip unreadable messages, continue with next
					set end of results to "(unreadable)|||unknown|||unknown|||" & (i as string)
				end try
			end repeat

			-- Join results with newlines
			set AppleScript's text item delimiters to linefeed
			set resultText to results as text
			set AppleScript's text item delimiters to ""
			return resultText

		on error outerErr
			return "error: Unexpected Mail error — " & outerErr
		end try
	end tell
end run

-- Helper: strip non-ASCII characters (keep codepoints 32-126) to prevent
-- serialization errors in the tool response pipeline.
on sanitize(str)
	set safeText to ""
	set charLimit to length of str
	if charLimit > 500 then set charLimit to 500
	repeat with i from 1 to charLimit
		set ch to character i of str
		set cp to id of ch
		if cp ≥ 32 and cp ≤ 126 then
			set safeText to safeText & ch
		end if
	end repeat
	return safeText
end sanitize

-- Helper: lowercase a string for case-insensitive comparison.
on toLower(str)
	set lowered to ""
	repeat with i from 1 to length of str
		set ch to character i of str
		set cp to id of ch
		if cp ≥ 65 and cp ≤ 90 then
			set lowered to lowered & (character id (cp + 32))
		else
			set lowered to lowered & ch
		end if
	end repeat
	return lowered
end toLower

-- Helper: trim leading/trailing whitespace.
on trim(str)
	repeat while str begins with " "
		set str to text 2 thru -1 of str
	end repeat
	repeat while str ends with " "
		set str to text 1 thru -2 of str
	end repeat
	return str
end trim
