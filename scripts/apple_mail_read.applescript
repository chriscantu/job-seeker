-- apple_mail_read.applescript
-- Fetches the body of a single email message by index from an Apple Mail inbox.
-- Returns the raw MIME source (for URL extraction from HTML) with ASCII-safe
-- filtering, or falls back to plaintext content.
--
-- Arguments (positional, space-separated, each quoted):
--   1. account_name   — substring match for the Mail account (e.g. "iCloud")
--   2. inbox_name     — exact mailbox name (e.g. "INBOX")
--   3. message_index  — 1-based index of the message to read
--
-- Returns (stdout):
--   "HTML:" followed by up to 4000 ASCII-safe chars of MIME source
--   "TEXT:" followed by up to 4000 ASCII-safe chars of plaintext content
--   "BODY_UNAVAILABLE: {reason}"  — body could not be retrieved
--   "ACCOUNT_NOT_FOUND"           — no matching account
--   "MAILBOX_NOT_FOUND"           — inbox not found in account
--   "MESSAGE_NOT_FOUND"           — index out of range
--   "error: {message}"            — something went wrong
--
-- Usage:
--   osascript apple_mail_read.applescript "iCloud" "INBOX" 3

on run argv
	-- Guard: require exactly 3 arguments
	if (count of argv) < 3 then
		return "error: Expected 3 arguments (account_name, inbox_name, message_index) but got " & (count of argv)
	end if

	set accountName to item 1 of argv
	set inboxName to item 2 of argv
	set msgIdx to (item 3 of argv) as integer

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

			-- Step 3: Check message exists
			set msgCount to count of messages of targetMailbox
			if msgIdx > msgCount or msgIdx < 1 then
				return "MESSAGE_NOT_FOUND"
			end if

			set msg to message msgIdx of targetMailbox

			-- Step 4: Try source first (HTML/MIME — needed for href URL extraction)
			try
				set rawSource to source of msg
				if rawSource is not "" and rawSource is not missing value then
					set safeText to my sanitize(rawSource, 4000)
					if length of safeText > 0 then
						return "HTML:" & safeText
					end if
				end if
			end try

			-- Step 5: Fall back to plaintext content
			try
				set plainContent to content of msg
				if plainContent is not "" and plainContent is not missing value then
					set safeText to my sanitize(plainContent, 4000)
					if length of safeText > 0 then
						return "TEXT:" & safeText
					end if
				end if
			on error errMsg
				return "BODY_UNAVAILABLE: content fetch failed — " & errMsg
			end try

			return "BODY_UNAVAILABLE: both source and content were empty"

		on error outerErr
			return "error: Unexpected Mail error — " & outerErr
		end try
	end tell
end run

-- Helper: strip non-ASCII characters (keep codepoints 32-126) and cap at
-- charLimit characters. Prevents serialization errors from embedded images
-- (U+FFFC object replacement char) and other non-printable characters.
on sanitize(str, charLimit)
	set safeText to ""
	set strLen to length of str
	if strLen < charLimit then set charLimit to strLen
	set safeCount to 0
	set i to 1
	-- Scan up to charLimit * 2 raw chars to collect charLimit safe chars
	set scanLimit to charLimit * 2
	if scanLimit > strLen then set scanLimit to strLen
	repeat while i ≤ scanLimit and safeCount < charLimit
		set ch to character i of str
		set cp to id of ch
		if cp ≥ 32 and cp ≤ 126 then
			set safeText to safeText & ch
			set safeCount to safeCount + 1
		else if cp is 10 or cp is 13 or cp is 9 then
			-- Preserve newlines and tabs (useful for parsing)
			set safeText to safeText & ch
			set safeCount to safeCount + 1
		end if
		set i to i + 1
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
