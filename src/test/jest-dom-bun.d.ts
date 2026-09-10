/**
 * Ambient type augmentation only: `@testing-library/jest-dom` ships a `bun:test`-specific `Matchers`
 * interface merge at `types/bun.d.ts`, but its `package.json` `exports` map has no subpath for it (only
 * `.`, `./matchers`, `./vitest`, `./jest-globals` are published) — this file's relative import reaches
 * it directly, side-stepping the missing export entry, purely to pull the type merge into the program.
 */
import '@testing-library/jest-dom/types/bun.d.ts';
