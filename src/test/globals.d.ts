/**
 * Ambient global test API for every `*.test.ts(x)` file: `describe`/`it`/`expect`/`vi`/etc. are used
 * without an explicit `bun:test` import throughout `src/` (carried over from vitest's `test.globals`
 * option), and bun's own runtime injects those as real globals — this reference just tells the
 * type-checker they exist, matching bun-types' documented triple-slash opt-in for its globals file.
 *
 * The `*?real` wildcard module matches `restoreModuleAfterAll`'s `?real`-suffixed dynamic import
 * (`../sdk/index.ts?real`) in `vi-compat.ts` — a specifier bun resolves at runtime to bypass a
 * `vi.mock`, but that TypeScript has no real file for, so it needs an ambient shape instead.
 */
/// <reference types="bun-types/test-globals" />

declare module '*?real' {
  const mod: Record<string, unknown>;
  export = mod;
}
