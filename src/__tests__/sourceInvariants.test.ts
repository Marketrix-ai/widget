/**
 * Pins what eslint and tsc cannot express: the published package's contents and test script, and text that must agree
 * across files (the loader's import map, z-index tokens, the stylesheet, the hooks folder). fs + regex, no rendering.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'bun:test';

import { REACT_EXTERNALS } from '../../vite.config';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const src = resolve(here, '..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');

describe('package.json', () => {
  const pkg = JSON.parse(read('package.json'));

  it('publishes exactly the dist allowlist, with no .npmignore to complicate it', () => {
    expect(pkg.files).toEqual(['dist', '!dist/**/*.map', '!dist/module-sizes.json']);
    expect(() => read('.npmignore')).toThrow();
  });

  it("runs every test file isolated, so one file's module mocks never leak into another", () => {
    expect(pkg.scripts.test).toContain('--isolate');
  });
});

describe('tsconfig.build.json', () => {
  const tsconfig = JSON.parse(read('tsconfig.build.json'));

  it('excludes src/test and test files from the published declarations', () => {
    expect(tsconfig.exclude).toContain('src/test');
    expect(tsconfig.exclude.some((p: string) => p.includes('*.test.'))).toBe(true);
  });
});

describe('React externals', () => {
  it("the loader's import map supplies exactly the React specifiers the bundle leaves external", () => {
    const loader = read('public/loader.js');
    const block = loader.match(/var imports = \{([^}]*)\}/)?.[1];
    if (!block) throw new Error('public/loader.js no longer declares `var imports = {…}` — update this check');
    const mapped = [...block.matchAll(/^\s*'?([\w/-]+)'?:/gm)].map(match => match[1]);
    expect(new Set(mapped)).toEqual(new Set(REACT_EXTERNALS));
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
    expect(files.sort()).toEqual(['useWidget.ts']);
  });
});
