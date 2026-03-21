import { statSync } from 'node:fs';

const requiredFiles = ['dist/widget.mjs', 'dist/loader.js'];

const missing = [];
for (const file of requiredFiles) {
  try {
    const stats = statSync(file);
    if (!stats.isFile() || stats.size <= 0) {
      missing.push(`${file} (empty or invalid)`);
    }
  } catch {
    missing.push(file);
  }
}

if (missing.length > 0) {
  console.error('visual:check failed. Missing required UI artifacts:');
  for (const entry of missing) {
    console.error(`- ${entry}`);
  }
  process.exit(1);
}

console.log('visual:check passed.');
