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
} catch {
  errors.push('dist/widget.mjs.map is missing or invalid');
}

if (errors.length > 0) {
  console.error('bundle:check failed.');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('bundle:check passed.');
