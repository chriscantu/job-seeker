#!/usr/bin/env bun
import * as fs from 'fs';
import { classifyStatusEmail, ClassifyStatusEmailInput, ApplicationsData as ClassifierApplicationsData } from './lib/status-classifier';
import { parseApplicationsFile, ApplicationsData } from './lib/applications';
import { resolveStateFile } from './lib/util';

// Exit codes:
//   0  success (classification JSON or `null` on stdout)
//   2  usage error (missing/malformed args)
//   3  input error (email file missing or unreadable)
//   4  state error (applications file unreadable)
//   5  classifier error (unexpected exception in the classifier itself)
const EXIT_USAGE = 2;
const EXIT_INPUT = 3;
const EXIT_STATE = 4;
const EXIT_CLASSIFIER = 5;

interface ParsedFlags {
  email: string;
  applicationsDir: string;
}

type ParseResult =
  | { ok: true; args: ParsedFlags }
  | { ok: false; error: string };

function parseArgs(argv: string[]): ParseResult {
  let email: string | undefined;
  let applicationsDir: string | undefined;

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    const nextLooksLikeFlag = typeof next !== 'string' || next.startsWith('--');

    if (key === '--email') {
      if (nextLooksLikeFlag) return { ok: false, error: 'missing value for --email' };
      email = next;
      i++;
    } else if (key === '--applications-dir') {
      if (nextLooksLikeFlag) return { ok: false, error: 'missing value for --applications-dir' };
      applicationsDir = next;
      i++;
    }
  }

  if (!email || !applicationsDir) {
    // No detail string — preserves original "args missing" → detail: null
    // contract (distinct from --flag without value, which carries a detail).
    return { ok: false, error: '' };
  }
  return { ok: true, args: { email, applicationsDir } };
}

function usageError(detail?: string): never {
  console.error(JSON.stringify({
    error: 'usage_error',
    usage: 'classify-status-email.ts --email <file.json> --applications-dir <dir>',
    detail: detail || null,
  }));
  process.exit(EXIT_USAGE);
}

function structuredError(code: number, error: string, extra: Record<string, unknown> = {}): never {
  console.error(JSON.stringify({ error, ...extra }));
  process.exit(code);
}

// Narrows JSON-parsed unknown to a record + checks the one field
// classifyStatusEmail will reject on (sender). Catches truncated/corrupt
// email-fetch JSON before the classifier throws an opaque TypeError.
function narrowEmailData(parsed: unknown): Record<string, unknown> {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    structuredError(EXIT_INPUT, 'email_invalid_shape', {
      detail: `expected object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`,
    });
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.sender !== 'string' || !obj.sender) {
    structuredError(EXIT_INPUT, 'email_missing_sender', {
      detail: 'email JSON must contain a non-empty "sender" string',
    });
  }
  return obj;
}

function main(): void {
  const parseResult = parseArgs(process.argv);
  if (!parseResult.ok) usageError(parseResult.error || undefined);
  const { email, applicationsDir } = parseResult.args;

  let emailData: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(email, 'utf8');
    emailData = narrowEmailData(JSON.parse(raw));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_INPUT, 'email_read_failed', { file: email, detail });
  }

  let applicationsData: ApplicationsData;
  try {
    const applicationsFile = resolveStateFile(applicationsDir, 'applications');
    if (!applicationsFile) {
      console.error(`warning: no applications file found in ${applicationsDir}; classifying against empty pipeline`);
      applicationsData = { active: [], closed: [], flagged: [] };
    } else {
      applicationsData = parseApplicationsFile(applicationsFile);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_STATE, 'applications_read_failed', { dir: applicationsDir, detail });
  }

  // emailData.sender is now string-checked; the rest of ClassifyStatusEmailInput
  // is optional. classifyStatusEmail still validates field types internally.
  const input: ClassifyStatusEmailInput = {
    sender: emailData.sender as string,
    senderName: typeof emailData.senderName === 'string' ? emailData.senderName : null,
    subject: typeof emailData.subject === 'string' ? emailData.subject : null,
    body: typeof emailData.body === 'string' ? emailData.body : null,
    msgId: typeof emailData.msgId === 'string' ? emailData.msgId : undefined,
    // lib/applications.ApplicationEntry.company is string|null; classifier's
    // MatchableEntry.company is required string. Real entries always have
    // company (dedup key). Cross-type cast — runtime data overlaps.
    applicationsData: applicationsData as unknown as ClassifierApplicationsData,
  };

  let result;
  try {
    result = classifyStatusEmail(input);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_CLASSIFIER, 'classifier_failed', { detail });
  }

  console.log(JSON.stringify(result));
}

main();
