/**
 * Packaging gate for the built widget, run last in `bun run ci`.
 *
 * `bytesPerSource` attributes bundle bytes to their source files from the source map; the script then
 * checks the artifacts exist, stay under their byte budgets, ship as one ES module with no CSS file and
 * no bundled React, and that no dependency grew past its budget. Budgets sit about 15% above the
 * current build so growth is noticed; raise one deliberately, never to make CI pass.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';

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
  '@rrweb/record': 84_000,
  '@base-ui/react': 82_000,
  '@base-ui/utils': 13_000,
  '@orpc/client': 11_000,
  '@orpc/standard-server-fetch': 4_100,
  '@orpc/standard-server': 4_000,
  '@orpc/shared': 3_600,
  '@floating-ui/utils': 1_200,
  zod: 116_000,
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesPerSource(sourceMap: { mappings: string }, bundle: string): Map<number, number> {
  const lines = bundle.split('\n');
  const bytes = new Map<number, number>();
  let source = 0;
  sourceMap.mappings.split(';').forEach((row: string, lineIndex: number) => {
    let column = 0;
    const marks: Array<[number, number]> = [];
    for (const segment of row.split(',').filter(Boolean)) {
      let shift = 0;
      let value = 0;
      const fields: number[] = [];
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
      column += fields[0] ?? 0;
      if (fields.length >= 4) source += fields[1] ?? 0;
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

type SourceMap = { mappings: string; sources?: string[]; sourcesContent?: string[] };
let sourceMap: SourceMap | null = null;
try {
  sourceMap = JSON.parse(readFileSync('dist/widget.mjs.map', 'utf8')) as SourceMap;
} catch (error) {
  errors.push(`dist/widget.mjs.map is missing or invalid: ${error instanceof Error ? error.message : String(error)}`);
}

if (sourceMap) {
  if (sourceMap.sourcesContent?.some(source => /\brequire\([^)]+\)/.test(source))) {
    errors.push('dist/widget.mjs.map contains a dynamic require');
  }
  const inlined = (sourceMap.sources ?? []).filter(source => /node_modules\/(react|react-dom)\//.test(source));
  if (inlined.length > 0) {
    errors.push(
      `React was compiled into the bundle (${inlined.length} sources, e.g. ${inlined[0]}) — it is a peer dependency`,
    );
  }

  const perPackage = new Map<string, number>();
  for (const [index, size] of bytesPerSource(sourceMap, bundle)) {
    const name = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(sourceMap.sources?.[index] ?? '')?.[1];
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
}

if (errors.length > 0) {
  console.error('bundle:check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('bundle:check passed.');
