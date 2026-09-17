/**
 * Writes `<file>.gz`/`<file>.br` beside a built artifact, matching exactly what the runtime image
 * serves — the ONE home for the gzip/brotli parameters (level 9, brotli quality 11 with a size hint),
 * called from the Dockerfile `builder` stage (`bun run precompress dist/widget.mjs`) and from
 * `checkServed.ts`'s no-docker fallback server, so the two never drift into different compression
 * settings for the same negotiation `checkServed.ts` asserts against. Bun's own `node:zlib` is used
 * (no node binary exists in the `builder` stage), so this runs under `bun run`, never plain `node`.
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
