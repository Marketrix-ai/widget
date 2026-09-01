import { readdirSync, readFileSync, statSync } from 'node:fs';

// Budgets sit ~15% above the current build so growth is actually noticed. They were 2 MB and 10 kB —
// 5.1x and 7.8x the real artifacts — which is a guard that can never fire: the bundle could quintuple
// silently. Raise a limit deliberately when a feature justifies it; do not raise it to make CI pass.
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

// Size is not the packaging contract. `formats: ['es']` with no code splitting, `cssCodeSplit: false`
// and the four React externals are what make this package embeddable: an extra chunk breaks the
// single-file script-tag bootstrap, an emitted stylesheet never reaches the closed Shadow DOM, and a
// bundled React gives the host page a SECOND React — hooks throw across that boundary. Each one leaves
// `dist/widget.mjs` present and under budget, so none of them was caught before.
const EXTERNALS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'];

const emitted = readdirSync('dist');

const extraChunks = emitted.filter(name => name.endsWith('.mjs') && name !== 'widget.mjs');
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

// Half the bundle is four dependencies and the total cap cannot see which: at 392,685 bytes against a
// 455,000 limit there is 62 kB of silent headroom, enough for a heavy import to land or an existing one
// to grow 80% unnoticed. Budgets are ~10% over the bytes measured on 2026-09-01; a package absent here
// fails outright, so a new dependency is a deliberate line rather than a number nobody reads.
const DEPENDENCY_BUDGETS = {
  '@rrweb/record': 84_000, // 75,867 (19.3%) — session recording, imported for a feature off by default
  zod: 81_000, // 73,337 (18.7%) — the generated contract's validator; two safeParse calls reach it
  '@base-ui/react': 47_000, // 42,210 (10.7%) — Dialog, plus Button
  'tailwind-merge': 32_000, // 28,386 (7.2%) — cn()
  '@base-ui/utils': 13_000, // 11,307
  '@orpc/client': 11_000, // 9,500
  '@orpc/standard-server-fetch': 4_100, // 3,693
  '@orpc/standard-server': 4_000, // 3,578
  '@orpc/shared': 3_600, // 3,235
  '@floating-ui/utils': 1_200, // 1,065
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Output bytes per source file, by walking the sourcemap segments — the only view of what is actually in the bundle. */
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
