import { statSync } from 'node:fs';

const requiredFiles = [
  { path: 'dist/index.mjs', maxBytes: 2_000_000 },
  { path: 'dist/standalone.mjs', maxBytes: 4_000_000 },
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
      errors.push(
        `${artifact.path} (${stats.size} bytes) exceeds limit ${artifact.maxBytes} bytes`
      );
    }
  } catch {
    errors.push(`${artifact.path} is missing`);
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
