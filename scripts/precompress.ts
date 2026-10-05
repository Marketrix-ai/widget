/**
 * Writes `<file>.gz`/`<file>.br` beside a built artifact for the Dockerfile `builder` stage and for
 * `check-served.ts`'s length checks — the one home for the gzip/brotli parameters the runtime image serves.
 * It uses Bun's `node:zlib`, since the `builder` stage has no node binary.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export function precompress(path: string): void {
  const bytes = readFileSync(path);
  writeFileSync(`${path}.gz`, gzipSync(bytes, { level: 9 }));
  writeFileSync(
    `${path}.br`,
    brotliCompressSync(bytes, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length },
    }),
  );
}

if (import.meta.main) {
  const path = process.argv[2];
  if (!path) throw new Error('usage: bun run scripts/precompress.ts <path>');
  precompress(path);
}
