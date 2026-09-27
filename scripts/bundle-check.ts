/**
 * Packaging gate for the built widget, run last in `bun run ci`.
 *
 * Checks the artifacts exist, stay under their byte budgets, ship as one ES module with no CSS file, no
 * dynamic require and no bundled React, and that no dependency grew past its budget. Dependency sizes come
 * from the build's `module-sizes.json`, measured before minification; budgets sit about 15% above the
 * current build so growth is noticed; raise one deliberately, never to make CI pass.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';

import { z } from 'zod';

import { REACT_EXTERNALS } from '../vite.config';

const requiredFiles = [
  { path: 'dist/widget.mjs', maxBytes: 455_000 },
  { path: 'dist/loader.js', maxBytes: 2_000 },
];

const errors = [];

for (const artifact of requiredFiles) {
  const stats = statSync(artifact.path, { throwIfNoEntry: false });
  if (!stats) errors.push(`${artifact.path} is missing`);
  else if (!stats.isFile()) errors.push(`${artifact.path} is not a file`);
  else if (stats.size <= 0) errors.push(`${artifact.path} is empty`);
  else if (stats.size > artifact.maxBytes) {
    errors.push(`${artifact.path} (${stats.size} bytes) exceeds limit ${artifact.maxBytes} bytes`);
  }
}

const emitted = readdirSync('dist');

const SERVED_SCRIPTS = ['widget.mjs', 'loader.js'];
const extraChunks = emitted.filter(name => /\.[cm]?js$/.test(name) && !SERVED_SCRIPTS.includes(name));
if (extraChunks.length > 0) {
  errors.push(`dist/ has code-split chunks beside widget.mjs: ${extraChunks.join(', ')}`);
}

const stylesheets = emitted.filter(name => name.endsWith('.css'));
if (stylesheets.length > 0) {
  errors.push(
    `dist/ emitted a stylesheet (${stylesheets.join(', ')}) — CSS must ride in the bundle via index.css?inline`,
  );
}

const bundle = readFileSync('dist/widget.mjs', 'utf8');
const notImported = REACT_EXTERNALS.filter(module => !new RegExp(`from\\s*["']${module}["']`).test(bundle));
if (notImported.length > 0) {
  errors.push(
    `dist/widget.mjs no longer imports ${notImported.join(', ')} as a bare specifier — the host's React must be the only React`,
  );
}

const DEPENDENCY_BUDGETS: Record<string, number> = {
  '@base-ui/react': 212_000,
  zod: 208_000,
  '@rrweb/record': 157_000,
  '@base-ui/utils': 31_000,
  '@orpc/client': 22_400,
  '@orpc/standard-server-fetch': 8_500,
  '@orpc/standard-server': 7_900,
  '@orpc/shared': 7_700,
  '@floating-ui/utils': 2_300,
};

const moduleSizes = z.record(z.string(), z.number()).parse(JSON.parse(readFileSync('dist/module-sizes.json', 'utf8')));

if (/\brequire\(/.test(bundle)) errors.push('dist/widget.mjs contains a dynamic require');
const inlined = Object.keys(moduleSizes).filter(id => /node_modules\/(react|react-dom)\//.test(id));
if (inlined.length > 0) {
  errors.push(
    `React was compiled into the bundle (${inlined.length} modules, e.g. ${inlined[0]}) — it is a peer dependency`,
  );
}

const perPackage = new Map<string, number>();
for (const [id, size] of Object.entries(moduleSizes)) {
  const name = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(id)?.[1];
  if (name) perPackage.set(name, (perPackage.get(name) ?? 0) + size);
}
for (const [name, size] of [...perPackage].sort((a, b) => b[1] - a[1])) {
  const budget = DEPENDENCY_BUDGETS[name];
  if (budget === undefined) {
    errors.push(`${name} is new in the bundle (${size} bytes) — add it to DEPENDENCY_BUDGETS deliberately`);
  } else if (size > budget) {
    errors.push(`${name} (${size} bytes) exceeds its budget ${budget} bytes`);
  }
}

if (errors.length > 0) {
  console.error('bundle:check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('bundle:check passed.');
