/**
 * Ambient test types: bun's `describe`/`it`/`expect` globals, and the `*?real` specifier `vi-compat.ts`
 * imports to bypass a `vi.mock`.
 */
/// <reference types="bun-types/test-globals" />

declare module '*?real' {
  const mod: Record<string, unknown>;
  export = mod;
}
