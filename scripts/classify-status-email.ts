#!/usr/bin/env bun
import * as fs from 'fs';
import { classifyStatusEmail, ClassifyStatusEmailInput } from './lib/status-classifier';
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

interface ParsedArgs {
  email?: string;
  applicationsDir?: string;
  error?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    const nextLooksLikeFlag = typeof next !== 'string' || next.startsWith('--');

    if (key === '--email') {
      if (nextLooksLikeFlag) return { error: 'missing value for --email' };
      args.email = next;
      i++;
    } else if (key === '--applications-dir') {
      if (nextLooksLikeFlag) return { error: 'missing value for --applications-dir' };
      args.applicationsDir = next;
      i++;
    }
  }
  return args;
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

function main(): void {
  const args = parseArgs(process.argv);
  if (args.error) usageError(args.error);
  const { email, applicationsDir } = args;
  if (!email || !applicationsDir) usageError();

  let emailData: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(email, 'utf8');
    emailData = JSON.parse(raw) as Record<string, unknown>;
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

  let result;
  try {
    result = classifyStatusEmail({ ...emailData, applicationsData } as unknown as ClassifyStatusEmailInput);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    structuredError(EXIT_CLASSIFIER, 'classifier_failed', { detail });
  }

  console.log(JSON.stringify(result));
}

main();
