#!/usr/bin/env node
// check-contract-drift.mjs — structural drift gate for the oRPC contract mirrors.
//
// The app/widget SDK files (`src/sdk/routes.ts`, `src/sdk/schema.ts`) are
// hand-maintained mirrors of the source of truth in the `api` repo
// (`api/routes.ts`, `api/schema.ts`). They are intentionally NOT byte-identical:
// the mirrors trim some comments and use different import paths, and the widget
// mirror is a strict SUBSET — it omits the dashboard-only `simulationIssue*`
// routes and the `SimulationIssue*` schemas. This script compares STRUCTURE
// (presence of routes / schemas / discriminated-union event tags) while ignoring
// comments, import lines, and whitespace, and fails on any structural difference
// other than the known widget subset allowlist.
//
// WHAT IT CHECKS (presence-level drift):
//   --kind routes : the set of top-level route keys in `const contract = { ... }`
//                   (e.g. `getIndex:`, `authMe:`).
//   --kind schema : the set of top-level `export const|type|interface <Name>`
//                   identifiers, PLUS the set of `type: z.literal('<tag>')`
//                   member tags inside discriminated unions (AppEventSchema,
//                   WidgetEventSchema, WidgetCommandSchema, SSEEventSchema, ...).
//
// KNOWN GAP (documented, not checked): FIELD-LEVEL type drift inside a schema —
//   e.g. a field changing from `z.string()` to `z.number()`, or a field being
//   added/removed inside an existing object — is NOT detected. Only the presence
//   of routes, exported schema identifiers, and union member tags is compared.
//   A future iteration could parse the Zod AST for field-level coverage.
//
// USAGE:
//   node scripts/check-contract-drift.mjs \
//     --api <path-to-api-file> --mirror <path-to-local-mirror> \
//     --kind routes|schema [--allow-subset]
//
// `--allow-subset` (widget only) tolerates identifiers that are ABSENT from the
// mirror as long as they match the widget allowlist (the `simulationIssue*`
// routes and `SimulationIssue*` schemas). Anything else absent is still drift.
// Identifiers ADDED in the mirror but missing from the api source are ALWAYS
// drift, subset mode or not.
//
// Exit codes: 0 = in sync, 1 = structural drift, 2 = bad invocation / IO error.
// Pure Node, no dependencies.

import { readFileSync } from 'node:fs';

// Widget is a strict subset of the api contract. These identifiers MAY be
// absent from the widget mirror under --allow-subset. Matched case-insensitively
// by prefix so both routes (`simulationIssuePersonaCounts`, lowercase-camel) and
// schemas (`SimulationIssueEntitySchema`, PascalCase) are covered.
const WIDGET_SUBSET_PREFIX = 'simulationissue';

function parseArgs(argv) {
  const args = { allowSubset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--api') args.api = argv[++i];
    else if (a === '--mirror') args.mirror = argv[++i];
    else if (a === '--kind') args.kind = argv[++i];
    else if (a === '--allow-subset') args.allowSubset = true;
    else {
      console.error(`Unknown argument: ${a}`);
      return null;
    }
  }
  if (!args.api || !args.mirror || !args.kind) {
    console.error('Missing required arg. Need --api <file> --mirror <file> --kind routes|schema');
    return null;
  }
  if (args.kind !== 'routes' && args.kind !== 'schema') {
    console.error(`--kind must be "routes" or "schema", got "${args.kind}"`);
    return null;
  }
  return args;
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    console.error(`Cannot read ${path}: ${err.message}`);
    process.exit(2);
  }
}

// Top-level route keys are the keys of the single `const contract = { ... }`
// object literal — lines like `  getIndex: oc` at exactly 2-space indent.
function extractRouteKeys(src) {
  const set = new Set();
  const re = /^ {2}([A-Za-z][A-Za-z0-9_]*)\s*:\s*oc\b/gm;
  let m;
  while ((m = re.exec(src)) !== null) set.add(m[1]);
  return set;
}

// Top-level exported identifiers: `export const|type|interface <Name>`.
function extractSchemaExports(src) {
  const set = new Set();
  const re = /^export\s+(?:const|type|interface)\s+([A-Za-z][A-Za-z0-9_]*)/gm;
  let m;
  while ((m = re.exec(src)) !== null) set.add(m[1]);
  return set;
}

// Discriminated-union member tags: `type: z.literal('<tag>')`. Prefixed with
// `tag:` so they live in the same comparison space as exports without colliding
// with a same-named export.
function extractEventTags(src) {
  const set = new Set();
  const re = /\btype:\s*z\.literal\(\s*'([^']+)'\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) set.add(`tag:${m[1]}`);
  return set;
}

function isAllowlisted(name) {
  return name.toLowerCase().startsWith(WIDGET_SUBSET_PREFIX);
}

function diffSets(apiSet, mirrorSet) {
  const removed = []; // in api, missing from mirror
  const added = []; // in mirror, missing from api
  for (const name of apiSet) if (!mirrorSet.has(name)) removed.push(name);
  for (const name of mirrorSet) if (!apiSet.has(name)) added.push(name);
  removed.sort();
  added.sort();
  return { removed, added };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) process.exit(2);

  const apiSrc = read(args.api);
  const mirrorSrc = read(args.mirror);

  let apiSet;
  let mirrorSet;
  if (args.kind === 'routes') {
    apiSet = extractRouteKeys(apiSrc);
    mirrorSet = extractRouteKeys(mirrorSrc);
  } else {
    apiSet = new Set([...extractSchemaExports(apiSrc), ...extractEventTags(apiSrc)]);
    mirrorSet = new Set([...extractSchemaExports(mirrorSrc), ...extractEventTags(mirrorSrc)]);
  }

  if (apiSet.size === 0) {
    console.error(
      `No ${args.kind} identifiers extracted from api source ${args.api}. ` +
        `The file format may have changed — refusing to pass vacuously.`,
    );
    process.exit(2);
  }

  let { removed, added } = diffSets(apiSet, mirrorSet);

  // Under --allow-subset, identifiers ABSENT from the mirror are tolerated only
  // if they are on the widget allowlist. Anything else removed is still drift.
  const allowedAbsent = [];
  if (args.allowSubset) {
    const stillRemoved = [];
    for (const name of removed) {
      if (isAllowlisted(name)) allowedAbsent.push(name);
      else stillRemoved.push(name);
    }
    removed = stillRemoved;
  }

  // Added-in-mirror is always drift. Pair removed+added of equal count as a hint
  // that a rename happened (one removed + one added), purely for the message.
  const renameHint = removed.length === 1 && added.length === 1;

  const label = `${args.kind}${args.allowSubset ? ' (subset mode)' : ''}`;

  if (removed.length === 0 && added.length === 0) {
    const note = allowedAbsent.length
      ? ` (${allowedAbsent.length} allowlisted subset identifier(s) intentionally absent: ${allowedAbsent.join(', ')})`
      : '';
    console.log(`OK: ${label} in sync — ${apiSet.size} identifiers match.${note}`);
    process.exit(0);
  }

  console.error(`DRIFT DETECTED in ${label}:`);
  console.error(`  api source : ${args.api}`);
  console.error(`  mirror     : ${args.mirror}`);
  if (renameHint) {
    console.error(`  likely RENAME: "${removed[0]}" -> "${added[0]}"`);
  }
  if (removed.length) {
    console.error(`  MISSING from mirror (present in api, ${removed.length}): ${removed.join(', ')}`);
    if (!args.allowSubset && removed.some(isAllowlisted)) {
      console.error(
        `    hint: these look like widget-subset identifiers — pass --allow-subset only in the widget repo.`,
      );
    }
  }
  if (added.length) {
    console.error(`  EXTRA in mirror (absent in api, ${added.length}): ${added.join(', ')}`);
  }
  if (allowedAbsent.length) {
    console.error(`  (allowlisted subset, ignored: ${allowedAbsent.join(', ')})`);
  }
  console.error(`\nFix: re-run the sync-contracts skill to bring the mirror back in line with api ${args.kind}.`);
  process.exit(1);
}

main();
