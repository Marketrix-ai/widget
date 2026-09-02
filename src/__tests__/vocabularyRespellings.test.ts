import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'sdk') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx'))
      out.push(full);
  }
  return out;
}

function canonicalVocabularies(): Map<string, string> {
  const dir = join(srcDir, 'sdk/contracts');
  const vocab = new Map<string, string>();
  for (const file of readdirSync(dir).filter(f => f.endsWith('.ts'))) {
    const source = readFileSync(join(dir, file), 'utf8');
    for (const match of source.matchAll(/export const (\w+) = z\.enum\(\[([^\]]*)\]\)/g)) {
      const values = (match[2] ?? '')
        .split(',')
        .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(v => /^[a-zA-Z0-9_]+$/.test(v));
      if (values.length < 2) continue;
      vocab.set([...values].sort().join('|'), `${match[1]} (src/sdk/contracts/${file})`);
    }
  }
  return vocab;
}

describe('contract enum vocabularies', () => {
  it('no hand-written string-literal union respells a canonical src/sdk vocabulary', () => {
    const vocab = canonicalVocabularies();
    const offenders: string[] = [];

    for (const file of listFiles(srcDir)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/'[a-zA-Z0-9_]+'(?:\s*\|\s*'[a-zA-Z0-9_]+')+/g)) {
        const values = match[0].split('|').map(v => v.trim().replace(/^'|'$/g, ''));
        const home = vocab.get([...values].sort().join('|'));
        if (!home) continue;
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${file.slice(srcDir.length + 1)}:${line} respells ${home} as '${values.join("' | '")}'`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
