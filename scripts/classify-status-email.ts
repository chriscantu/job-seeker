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

// Shape of the email-fetch JSON that the upstream phase-2 fetch step writes.
// `sender` is required (classifier throws without it); the others are
// optional / nullable per the classifier's input contract. msgId is
// `undefined` (not null) to match `ClassifyStatusEmailInput.msgId?: string`.
interface EmailData {
  sender: string;
  senderName: string | null;
  subject: string | null;
  body: string | null;
  msgId: string | undefined;
}

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

// Reads and parses the email-fetch JSON file at `path` into a fully-typed
// `EmailData`. All shape validation lives here so callers consume a known
// type. Throws via `structuredError` on read / parse / shape failure.
function parseEmailFile(filePath: string): EmailData {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_INPUT, 'email_read_failed', { file: filePath, detail });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_INPUT, 'email_read_failed', { file: filePath, detail });
  }

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

  // String-or-null narrowing in one place; downstream consumes EmailData
  // without further runtime checks.
  const stringOrNull = (v: unknown): string | null => typeof v === 'string' ? v : null;
  return {
    sender: obj.sender,
    senderName: stringOrNull(obj.senderName),
    subject: stringOrNull(obj.subject),
    body: stringOrNull(obj.body),
    msgId: typeof obj.msgId === 'string' ? obj.msgId : undefined,
  };
}

function loadApplicationsData(applicationsDir: string): ApplicationsData {
  try {
    const applicationsFile = resolveStateFile(applicationsDir, 'applications');
    if (!applicationsFile) {
      console.error(`warning: no applications file found in ${applicationsDir}; classifying against empty pipeline`);
      return { active: [], closed: [], flagged: [] };
    }
    return parseApplicationsFile(applicationsFile);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_STATE, 'applications_read_failed', { dir: applicationsDir, detail });
  }
}

function main(): void {
  const parseResult = parseArgs(process.argv);
  if (!parseResult.ok) usageError(parseResult.error || undefined);
  const { email, applicationsDir } = parseResult.args;

  const emailData = parseEmailFile(email);
  const applicationsData = loadApplicationsData(applicationsDir);

  const input: ClassifyStatusEmailInput = {
    ...emailData,
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
