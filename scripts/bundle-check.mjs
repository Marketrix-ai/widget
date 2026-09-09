/**
 * The byte budget and packaging contract on `dist/`, run as the last step of `npm run ci`.
 *
 * BUDGETS sit ~15% above the current build so growth is actually noticed. They were 2 MB and 10 kB —
 * 5.1x and 7.8x the real artifacts — which is a guard that can never fire: the bundle could quintuple
 * silently. Raise a limit deliberately when a feature justifies it; never to make CI pass.
 *
 * SIZE IS NOT THE PACKAGING CONTRACT. `formats: ['es']` with no code splitting, `cssCodeSplit: false`
 * and the four React externals are what make this package embeddable: an extra chunk breaks the
 * single-file script-tag bootstrap, an emitted stylesheet never reaches the closed Shadow DOM, and a
 * bundled React gives the host page a SECOND React, across which hooks throw. Each of those leaves
 * `dist/widget.mjs` present and under budget, so none of them was caught before.
 *
 * The output allowlist is every file the runtime image serves, matched by name rather than by
 * extension: `type: "module"` makes rolldown name split chunks `[name]-[hash].js`, so matching only
 * `.mjs` let a genuinely split build pass.
 *
 * `DEPENDENCY_BUDGETS` exists because half the bundle is a handful of dependencies and the total cap
 * cannot see which. The build sits far enough under that cap for a heavy import to land, or an existing
 * one to grow substantially, without tripping it — the per-package table is what catches that. Each budget
 * is ~10% over the bytes measured on 2026-09-01, and a package ABSENT from the table fails outright, so a
 * new dependency is a deliberate line rather than a number nobody reads. The largest two are session
 * recording, imported for a feature that is off by default, and the Dialog/Button/Tabs/Toast primitives.
 *
 * Per-package bytes come from walking the sourcemap segments, which is the only view of what each source
 * file actually contributed to the output.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';

const requiredFiles = [
  { path: 'dist/widget.mjs', maxBytes: 455_000 },
  { path: 'dist/loader.js', maxBytes: 2_000 },
];

const errors = [];

for (const artifact of requiredFiles) {
  try {
    const stats = statSync(artifact.path);
    if (!stats.isFile()) {
      errors.push(`${artifact.path} is not a file`);
      continue;
    }
    if (stats.size <= 0) {
      errors.push(`${artifact.path} is empty`);
      continue;
    }
    if (stats.size > artifact.maxBytes) {
      errors.push(`${artifact.path} (${stats.size} bytes) exceeds limit ${artifact.maxBytes} bytes`);
    }
  } catch {
    errors.push(`${artifact.path} is missing`);
  }
}

const EXTERNALS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'];

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

try {
  const bundle = readFileSync('dist/widget.mjs', 'utf8');
  const notImported = EXTERNALS.filter(module => !new RegExp(`from\\s*["']${module}["']`).test(bundle));
  if (notImported.length > 0) {
    errors.push(
      `dist/widget.mjs no longer imports ${notImported.join(', ')} as a bare specifier — the host's React must be the only React`,
    );
  }
} catch {
  errors.push('dist/widget.mjs is unreadable');
}

const DEPENDENCY_BUDGETS = {
  '@rrweb/record': 84_000,
  '@base-ui/react': 82_000,
  '@base-ui/utils': 13_000,
  '@orpc/client': 11_000,
  '@orpc/standard-server-fetch': 4_100,
  '@orpc/standard-server': 4_000,
  '@orpc/shared': 3_600,
  '@floating-ui/utils': 1_200,
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesPerSource(sourceMap, bundle) {
  const lines = bundle.split('\n');
  const bytes = new Map();
  let source = 0;
  sourceMap.mappings.split(';').forEach((row, lineIndex) => {
    let column = 0;
    const marks = [];
    for (const segment of row.split(',').filter(Boolean)) {
      let shift = 0;
      let value = 0;
      const fields = [];
      for (const character of segment) {
        const digit = B64.indexOf(character);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
          continue;
        }
        fields.push(value & 1 ? -(value >> 1) : value >> 1);
        value = 0;
        shift = 0;
      }
      column += fields[0];
      if (fields.length >= 4) source += fields[1];
      marks.push([column, fields.length >= 4 ? source : -1]);
    }
    const lineLength = (lines[lineIndex] ?? '').length + 1;
    marks.forEach(([start, index], position) => {
      const end = marks[position + 1]?.[0] ?? lineLength;
      if (index >= 0) bytes.set(index, (bytes.get(index) ?? 0) + Math.max(0, end - start));
    });
  });
  return bytes;
}

try {
  const sourceMap = JSON.parse(readFileSync('dist/widget.mjs.map', 'utf8'));
  if (sourceMap.sourcesContent?.some(source => /\brequire\([^)]+\)/.test(source))) {
    errors.push('dist/widget.mjs.map contains a dynamic require');
  }
  const inlined = (sourceMap.sources ?? []).filter(source => /node_modules\/(react|react-dom)\//.test(source));
  if (inlined.length > 0) {
    errors.push(
      `React was compiled into the bundle (${inlined.length} sources, e.g. ${inlined[0]}) — it is a peer dependency`,
    );
  }

  const perPackage = new Map();
  for (const [index, size] of bytesPerSource(sourceMap, readFileSync('dist/widget.mjs', 'utf8'))) {
    const name = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(sourceMap.sources[index] ?? '')?.[1];
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
} catch (error) {
  errors.push(`dist/widget.mjs.map is missing or invalid: ${error.message}`);
}

if (errors.length > 0) {
  console.error('bundle:check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('bundle:check passed.');
