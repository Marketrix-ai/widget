/**
 * Pins the mechanical gotchas documented in this repo's and the root `CLAUDE.md` that eslint/tsc cannot
 * express (package.json/tsconfig/Dockerfile content, filesystem shape, cross-file text agreement) — fs +
 * regex, no mocks, no rendering. A check expressible as an eslint rule lives in eslint.config.mjs
 * instead, and one already covered by a real behavior test elsewhere is not duplicated here.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'bun:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const src = resolve(here, '..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const srcFiles = walk(src).filter(f => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__'));
const nonTestSrcFiles = srcFiles.filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
const contentsExcept = (files: string[], predicate: (f: string) => boolean): { file: string; text: string }[] =>
  files.filter(predicate).map(file => ({ file, text: readFileSync(file, 'utf8') }));

describe('package.json', () => {
  const pkg = JSON.parse(read('package.json'));

  it('has no vitest family in devDependencies — bun test is the only runner', () => {
    const dev = Object.keys(pkg.devDependencies ?? {});
    expect(dev.filter(name => name === 'vitest' || name.includes('vitest'))).toEqual([]);
  });

  it('publishes exactly the dist allowlist, with no .npmignore to complicate it', () => {
    expect(pkg.files).toEqual(['dist', '!dist/**/*.map']);
    expect(() => read('.npmignore')).toThrow();
  });

  it('bakes --isolate into every bun test script', () => {
    for (const script of ['test', 'test:watch', 'test:coverage']) {
      expect(pkg.scripts[script]).toContain('--isolate');
    }
  });

  it('pins the same bun version as the Dockerfile base image — one drifts, CI and local diverge', () => {
    const bunVersion = (pkg.packageManager as string).replace(/^bun@/, '');
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toContain(`FROM oven/bun:${bunVersion}-alpine AS base`);
  });

  it('runs check:comments before build, and code:check before check:comments, in the ci script', () => {
    const ci = pkg.scripts['ci'] ?? '';
    const at = (needle: string) => ci.indexOf(needle);
    expect(at('code:check')).toBeGreaterThanOrEqual(0);
    expect(at('check:comments')).toBeGreaterThanOrEqual(0);
    expect(at('build')).toBeGreaterThanOrEqual(0);
    expect(at('code:check')).toBeLessThan(at('check:comments'));
    expect(at('check:comments')).toBeLessThan(at('build'));
  });

  it('has no tailwind/classnames dependency — cn() calls are eslint-banned instead', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).some(name => /tailwind|classnames/i.test(name))).toBe(false);
  });
});

describe('bundle:check dependency budgets', () => {
  const script = read('scripts/bundle-check.ts');

  it('budgets the two dependencies that are half the bundle', () => {
    expect(script).toMatch(/'@base-ui\/react':\s*\d/);
    expect(script).toMatch(/'@rrweb\/record':\s*\d/);
  });
});

describe('tsconfig.build.json', () => {
  const tsconfig = JSON.parse(read('tsconfig.build.json'));

  it('excludes src/test and test files from the published declarations', () => {
    expect(tsconfig.exclude).toContain('src/test');
    expect(tsconfig.exclude.some((p: string) => p.includes('*.test.'))).toBe(true);
  });
});

describe('tsconfig.json strict flags', () => {
  const tsconfig = JSON.parse(read('tsconfig.json'));

  it('keeps every measured strictness flag on — a regression here is a silent type-safety loss', () => {
    for (const flag of [
      'strict',
      'noUncheckedIndexedAccess',
      'exactOptionalPropertyTypes',
      'noImplicitOverride',
      'noPropertyAccessFromIndexSignature',
      'noFallthroughCasesInSwitch',
      'verbatimModuleSyntax',
    ]) {
      expect(tsconfig.compilerOptions[flag]).toBe(true);
    }
    expect(tsconfig.compilerOptions.useUnknownInCatchVariables).not.toBe(false);
  });
});

describe('Vite externals', () => {
  const config = read('vite.config.ts');

  it('externalizes exactly the four React entry points', () => {
    const match = config.match(/external:\s*\[([^\]]*)\]/);
    if (!match?.[1]) throw new Error('vite.config.ts no longer declares a rollup `external` array — update this check');
    const externals = match[1].match(/'[^']+'/g)?.map(s => s.slice(1, -1)) ?? [];
    expect(new Set(externals)).toEqual(new Set(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']));
  });
});

describe('window.__mtx singleton guard', () => {
  const indexTsx = read('src/index.tsx');

  it("only ever declares and assigns the 'initializing' | 'active' states", () => {
    expect(indexTsx).toMatch(/__mtx\?:\s*\{\s*state\?:\s*'initializing'\s*\|\s*'active'\s*\}/);
    const assigned = [...indexTsx.matchAll(/window\.__mtx\s*=\s*\{\s*state:\s*'([^']+)'/g)].map(m => m[1]);
    expect(new Set(assigned)).toEqual(new Set(['initializing', 'active']));
  });
});

describe('Shadow DOM attachment', () => {
  it('is always attached closed, never open', () => {
    const calls = contentsExcept(nonTestSrcFiles, f => /\.attachShadow\(/.test(readFileSync(f, 'utf8')));
    expect(calls.length).toBeGreaterThan(0);
    for (const { text } of calls) {
      for (const call of text.matchAll(/\.attachShadow\(([^)]*)\)/g)) {
        expect(call[1]).toContain("mode: 'closed'");
      }
    }
  });
});

describe('z-index', () => {
  it('ShowModeService reads z-index off LAYER_TOKENS, never a raw number', () => {
    const showMode = read('src/services/ShowModeService.ts');
    const zIndexUses = [...showMode.matchAll(/z-index:\s*\$?\{?(LAYER_TOKENS\.\w+|\d+)/g)].map(m => m[1]);
    expect(zIndexUses.length).toBeGreaterThan(0);
    for (const use of zIndexUses) expect((use ?? '').startsWith('LAYER_TOKENS.')).toBe(true);
  });
});

describe('no CSS framework', () => {
  it('index.css has no dark-mode selector', () => {
    const css = read('src/index.css');
    expect(css).not.toMatch(/\.dark\s*[,{]|\bdark:[a-z-]/);
  });
});

describe('src/hooks/', () => {
  it('holds only hooks with 2+ consumers', () => {
    const files = readdirSync(resolve(src, 'hooks')).filter(f => !f.includes('__tests__'));
    expect(files.sort()).toEqual(['useLatest.ts', 'useWidget.ts']);
  });
});
