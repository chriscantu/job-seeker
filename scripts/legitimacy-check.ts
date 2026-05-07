#!/usr/bin/env bun
// Posting legitimacy check CLI — see skills/_shared/legitimacy-check.md
//
// Usage:
//   bun scripts/legitimacy-check.ts '<json>'
//   bun scripts/legitimacy-check.ts < input.json
//
// Input: JSON object — single role or array of roles. Each role:
//   { url?: string, company?: string, title?: string, posted?: string|null }
// Optional top-level: { dir?: string, today?: string, roles: [...] }
// (when passing roles array, wrap as { roles: [...] }).
//
// Output: JSON to stdout — same shape as input but with `legitimacy`
// attached to each role: { tier, reasons, signals }.
// Exit codes: 0 = success, 1 = bad input or runtime error.

import * as path from 'path';
import { computeLegitimacyTier } from './lib/legitimacy';
import { countReposts } from './lib/seen-postings';
import { errorMessage, getTodayUtc } from './lib/util';

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DIR = process.env.OUTPUT_DIR || path.join(ROOT, 'output');

interface RoleInput {
  url?: string | null;
  company?: string | null;
  title?: string | null;
  posted?: string | null;
}

interface BatchInput {
  dir?: string;
  today?: string;
  roles: RoleInput[];
}

function usage(): never {
  console.error(`Usage: bun scripts/legitimacy-check.ts '<json>'
       bun scripts/legitimacy-check.ts < input.json

Input shapes:
  Single role:    {"url": "...", "company": "...", "title": "...", "posted": "YYYY-MM-DD"}
  Array of roles: [ {role}, {role}, ... ]
  Batch:          {"dir": "output", "today": "YYYY-MM-DD", "roles": [ {role}, ... ]}`);
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks).toString('utf8');
}

function normalizeInput(parsed: unknown): BatchInput {
  if (Array.isArray(parsed)) {
    return { roles: parsed as RoleInput[] };
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.roles)) {
      return {
        dir: typeof obj.dir === 'string' ? obj.dir : undefined,
        today: typeof obj.today === 'string' ? obj.today : undefined,
        roles: obj.roles as RoleInput[],
      };
    }
    return { roles: [obj as RoleInput] };
  }
  throw new Error('input must be a role object, array of roles, or { roles: [...] }');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let raw: string;

  if (args.length === 1) {
    raw = args[0];
  } else if (args.length === 0 && !process.stdin.isTTY) {
    raw = await readStdin();
  } else {
    usage();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON: ${errorMessage(err)}`);
    process.exit(1);
  }

  const batch = normalizeInput(parsed);
  const dir = batch.dir || DEFAULT_DIR;
  const today = batch.today || getTodayUtc();

  const out = batch.roles.map((role) => {
    const repostCount = countReposts(dir, {
      url: role.url ?? null,
      company: role.company ?? null,
      title: role.title ?? null,
      today,
    });
    const result = computeLegitimacyTier({
      posted: role.posted ?? null,
      today,
      repostCount,
    });
    return { ...role, legitimacy: result };
  });

  process.stdout.write(JSON.stringify(out.length === 1 ? out[0] : out) + '\n');
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});
