// scripts/lib/trash-output.js
//
// Shared classifiers for Phase 6 Step 1 auto-trash output. Both the Apple
// Mail path (auto_trash_inbox.js → apple_mail_trash_by_sender.applescript)
// and the Gmail path (auto_trash_gmail.js → gmail.js trash-by-sender)
// print a common `trashed: pat1=M/N pat2=X/Y ...` format, so the regex
// parser and partial-failure detector live here and are shared.
//
// Issue context:
//   - PR #91 (issue #90 findings 1 + 3): hardened the regex, added the
//     anomaly path, and pulled classifyOsascriptResult out of main(). All
//     of that logic is relocated here unchanged so the Gmail-side CLI can
//     reuse it without copy-paste.
//   - Gmail-side equivalent is classifyGmailResult — identical exit code
//     slots (0/2/3/4/5), slot 4 meaning "Gmail API error" instead of
//     "osascript error".

const EXIT_OK = 0;
const EXIT_CONFIG = 2;
const EXIT_COMMA = 3;
const EXIT_OSASCRIPT = 4; // shared slot: Apple Mail meaning
const EXIT_GMAIL_API = 4; // shared slot: Gmail meaning
const EXIT_PARTIAL = 5;

// Parse "trashed: pat1=moved/matched pat2=moved/matched ..." output and
// detect partial failures (moved < matched).
//
// Returns {
//   isPartial: boolean,          // any parsed entry had moved < matched
//   failures: Array<{pattern, moved, matched}>,
//   entryCount: number,          // number of real pattern entries parsed
//   isAnomaly: boolean,          // parsed body failed an integrity check
//   anomalyReason: string|null,  // human-readable explanation when isAnomaly
// }
//
// Hardening (issue #90 finding 1):
//   - The regex anchors at whitespace/start boundaries and stops at
//     `(errors:` so error-suffix tokens like `bar=1/2` inside
//     `(errors: bar=1/2 baz)` are NOT parsed as phantom pattern entries.
//   - An `expectedPatternCount` is required. If stdout starts with
//     `trashed:` but parses zero entries, or parses a count that does
//     not match what the CLI shipped, the result is flagged as an
//     anomaly so the caller can fail non-zero instead of silently
//     returning success.
function detectPartialFailure(stdout, expectedPatternCount) {
  const empty = {
    isPartial: false,
    failures: [],
    entryCount: 0,
    isAnomaly: false,
    anomalyReason: null,
  };
  if (!stdout.startsWith('trashed:')) {
    return empty;
  }
  let body = stdout.slice('trashed:'.length).trim();
  // Strip every trailing parenthesized suffix — `(errors: ...)`,
  // `(cap-hit: ...)`, and any future annotation — before scanning for
  // pattern entries. This prevents any suffix body from being captured
  // as a phantom pattern, and lets new suffix types be added without
  // touching the parser.
  //
  // We find the first `(` preceded by whitespace (or at start) and
  // truncate. Suffix order in gmail.js's formatTrashBySenderOutput is
  // always: core entries, then `(errors: ...)`, then `(cap-hit: ...)`,
  // all space-separated — so the first `(` always begins the suffix
  // block.
  const suffixMatch = body.match(/(?:^|\s)\(/);
  if (suffixMatch) {
    body = body.slice(0, suffixMatch.index).trim();
  }

  const failures = [];
  let entryCount = 0;
  // A real pattern entry is anchored at a whitespace boundary (or start
  // of body) and its key is composed of non-whitespace characters that
  // are not `=`. This prevents the regex from walking into a substring
  // that is not actually a top-level entry.
  const entryRe = /(?:^|\s)([^\s=]+)=(\d+)\/(\d+)(?=\s|$)/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const pattern = m[1];
    const moved = parseInt(m[2], 10);
    const matched = parseInt(m[3], 10);
    entryCount += 1;
    if (moved < matched) {
      failures.push({ pattern, moved, matched });
    }
  }

  // Integrity checks.
  if (entryCount === 0) {
    return {
      isPartial: false,
      failures: [],
      entryCount: 0,
      isAnomaly: true,
      anomalyReason:
        'stdout started with "trashed:" but zero pattern entries were parsed',
    };
  }
  if (
    typeof expectedPatternCount === 'number' &&
    expectedPatternCount >= 0 &&
    entryCount !== expectedPatternCount
  ) {
    return {
      isPartial: failures.length > 0,
      failures,
      entryCount,
      isAnomaly: true,
      anomalyReason: `count mismatch: expected ${expectedPatternCount}, got ${entryCount}`,
    };
  }

  return {
    isPartial: failures.length > 0,
    failures,
    entryCount,
    isAnomaly: false,
    anomalyReason: null,
  };
}

// Pure classifier for the result of an osascript trash call. Returns the
// CLI exit code. Broken out from main() (issue #90 findings 1 + 3 + #5)
// so the five branches — non-zero status, three sentinel strings,
// `error:` prefix, stderr-with-status-0, partial failure, and the
// detectPartialFailure anomaly path — can be unit tested directly.
function classifyOsascriptResult({
  stdout,
  stderr,
  status,
  expectedPatternCount,
}) {
  if (status !== 0) {
    return EXIT_OSASCRIPT;
  }
  // Issue #90 finding 3: osascript can write real problems to stderr
  // (AppleEvent timeouts, "System Events got an error: ...", permission
  // prompts) while still exiting 0 with seemingly-valid stdout. Treating
  // that as success is how silent failures creep back in.
  if (stderr && stderr.length > 0) {
    return EXIT_OSASCRIPT;
  }
  const sentinelErrors = [
    'ACCOUNT_NOT_FOUND',
    'MAILBOX_NOT_FOUND',
    'TRASH_NOT_FOUND',
  ];
  for (const sentinel of sentinelErrors) {
    if (stdout.includes(sentinel)) {
      return EXIT_OSASCRIPT;
    }
  }
  if (stdout.startsWith('error:')) {
    return EXIT_OSASCRIPT;
  }
  const parse = detectPartialFailure(stdout, expectedPatternCount);
  if (parse.isAnomaly) {
    return EXIT_OSASCRIPT;
  }
  if (parse.isPartial) {
    return EXIT_PARTIAL;
  }
  return EXIT_OK;
}

// Pure classifier for the result of a `gmail.js trash-by-sender` call.
// Mirrors classifyOsascriptResult; slot 4 means "Gmail API error" instead
// of "osascript error". Stdout format is identical ("trashed: pat=M/N ...")
// so detectPartialFailure is reused unchanged.
//
// Branches:
//   - child exit status != 0 → EXIT_GMAIL_API
//   - stderr non-empty with status 0 → EXIT_GMAIL_API (parallel to the
//     issue #90 finding 3 rule for osascript)
//   - stdout contains AUTH_REQUIRED or GMAIL_ERROR sentinel → EXIT_GMAIL_API
//   - stdout starts with "error:" → EXIT_GMAIL_API
//   - detectPartialFailure anomaly → EXIT_GMAIL_API
//   - detectPartialFailure isPartial → EXIT_PARTIAL
//   - otherwise → EXIT_OK
function classifyGmailResult({
  stdout,
  stderr,
  status,
  expectedPatternCount,
}) {
  if (status !== 0) {
    return EXIT_GMAIL_API;
  }
  if (stderr && stderr.length > 0) {
    return EXIT_GMAIL_API;
  }
  const sentinelErrors = ['AUTH_REQUIRED', 'GMAIL_ERROR'];
  for (const sentinel of sentinelErrors) {
    if (stdout.includes(sentinel)) {
      return EXIT_GMAIL_API;
    }
  }
  if (stdout.startsWith('error:')) {
    return EXIT_GMAIL_API;
  }
  const parse = detectPartialFailure(stdout, expectedPatternCount);
  if (parse.isAnomaly) {
    return EXIT_GMAIL_API;
  }
  if (parse.isPartial) {
    return EXIT_PARTIAL;
  }
  return EXIT_OK;
}

module.exports = {
  detectPartialFailure,
  classifyOsascriptResult,
  classifyGmailResult,
  EXIT_OK,
  EXIT_CONFIG,
  EXIT_COMMA,
  EXIT_OSASCRIPT,
  EXIT_GMAIL_API,
  EXIT_PARTIAL,
};
