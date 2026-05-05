# Preflight — Config Validation & Standard Reads

Every skill executes this module before doing any work.

## Step 1: Validate Configuration

Run `bun scripts/validate-config.ts` — if it exits non-zero, stop and show the
error to the user. Do not proceed with any subsequent phase. (If the orchestrator
explicitly overrides this behavior, follow the orchestrator's instruction instead.)

## Step 2: Read Core Files

Read these files in parallel (single message, all reads at once):

1. **`PRINCIPLES.md`** — quality standards, voice guidelines, privacy constraints.
   These govern all output produced by the skill.
2. **`config/candidate.md`** — candidate name, current role, target roles, core
   strengths, accomplishments, education, location, email.
3. **`config/search.md`** — target role titles, comp floor, location constraints,
   company types, company stage floor, companies to skip, sources, remote
   preference.

All three reads are required. If any file is missing, `validate-config.js` will
have already caught it in Step 1.
