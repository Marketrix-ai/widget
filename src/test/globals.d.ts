/**
 * Ambient global test API for every `*.test.ts(x)` file: `describe`/`it`/`expect`/`vi`/etc. are used
 * without an explicit `bun:test` import throughout `src/` (carried over from vitest's `test.globals`
 * option), and bun's own runtime injects those as real globals — this reference just tells the
 * type-checker they exist, matching bun-types' documented triple-slash opt-in for its globals file.
 */
/// <reference types="bun-types/test-globals" />
