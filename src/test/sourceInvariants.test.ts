/**
 * Pins the MECHANICAL gotchas out of the root `CLAUDE.md` and this repo's `CLAUDE.md` that are cheap to
 * assert straight from source/config text — one small `it` per gotcha, fs + regex, no mocks, no rendering.
 * A PROSE-ONLY gotcha (release mechanics, npm-publish idempotence, a design rationale) has no assertable
 * artifact and stays prose in `CLAUDE.md` instead of a fake green check here.
 *
 * Pins: no vitest family in devDependencies · `packageManager`'s bun version matches the Dockerfile
 * `oven/bun` base image tag · published `files` allowlist + no `.npmignore` · `bundle:check`
 * budgets `@base-ui/react` and `@rrweb/record` by name · `tsconfig.build.json` excludes `src/test` and test
 * files · Vite's externals are exactly the four React entry points · the `WidgetEvent`/`WidgetCommand`
 * discriminated-union literals match the documented wire vocabulary · `StreamClient`'s backoff constants
 * (1000ms initial, 30000ms cap, 10 max attempts) and its `request_id === 'auth'` give-up branch · `FINISH_TOOL`
 * is defined once and every other reference imports the constant rather than re-literalling `'finish'` ·
 * `window.__mtx` only ever takes `'initializing'` / `'active'` · Shadow DOM is attached `{ mode: 'closed' }`
 * everywhere it's attached · `localStorage` is read/written only through `StorageService` · no
 * `console.log`/`info`/`debug` and no bare `console.warn` outside `utils/log.ts` · `LAYER_TOKENS` (not a raw
 * number) is what `ShowModeService` z-indexes with · the four db-V247-retired settings never reappear in
 * `src/` · no schema from `sdk` is imported as a VALUE outside `src/sdk/` and `src/test/` · no CSS framework
 * (`tailwind`/`classnames` deps, `cn(` calls) and no dark-mode selector in `index.css` · `src/hooks/` holds
 * only the shared `useWidget` hook · `document.activeElement`/`shadowRoot.activeElement` are eslint-banned
 * and `activeElementIn` is their one reader · there is no `sdk/routes.ts` or `sdk/schema.ts` · no bare
 * `<div>`/`<span>` carries an `onClick` without a `role` — every clickable is a `Button`/`IconButton`, a
 * native `<button>`, or an explicitly-roled element with its own keyboard handling · `tsconfig.json` keeps
 * `strict` plus every measured strictness flag (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
 * `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`,
 * `verbatimModuleSyntax`) on, so a later pass can't silently drop one back off · the three narrowing
 * casts a type guard replaced (`disabledReason`'s `'disabled' in el`, `stripLayoutProps`'s `isLayoutKey`,
 * `MessengerShell`'s `isWidgetView`) never reappear. `expectNoOffendersExcept` asserts no file outside
 * its `exemptPaths` (repo-root-relative) matches `pattern`. `useUnknownInCatchVariables` has no separate
 * strictness-flag entry: `strict: true` already implies it and it is never overridden, so its absence
 * from that list is not a gap.
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

const expectNoOffendersExcept = (pattern: RegExp, ...exemptPaths: string[]) => {
  const exempt = exemptPaths.map(p => resolve(src, p));
  const offenders = contentsExcept(nonTestSrcFiles, f => !exempt.includes(f) && pattern.test(readFileSync(f, 'utf8')));
  expect(offenders.map(o => o.file)).toEqual([]);
};

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
});

describe('bundle:check dependency budgets', () => {
  const script = read('scripts/bundle-check.mjs');

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

describe('widget <-> api wire vocabulary', () => {
  const widget = read('src/sdk/contracts/widget.ts');
  const literalsAfter = (label: string): string[] => {
    const idx = widget.indexOf(`export const ${label} = z.discriminatedUnion('type', [`);
    if (idx < 0) throw new Error(`${label} not found in src/sdk/contracts/widget.ts — update this check`);
    const end = widget.indexOf(']);', idx);
    return [...widget.slice(idx, end).matchAll(/type:\s*z\.literal\('([^']+)'\)/g)].map(m => m[1] as string);
  };

  it('WidgetEventSchema carries exactly the documented event types', () => {
    expect(literalsAfter('WidgetEventSchema')).toEqual([
      'registered',
      'heartbeat',
      'chat/response',
      'chat/delta',
      'chat/error',
      'task/status',
      'tool/call',
    ]);
  });

  it('WidgetCommandSchema carries exactly the documented command types', () => {
    expect(literalsAfter('WidgetCommandSchema')).toEqual([
      'chat/tell',
      'chat/show',
      'chat/do',
      'chat/stop',
      'tool/response',
      'rrweb/metadata',
      'rrweb/events',
    ]);
  });
});

describe('StreamClient reconnect', () => {
  const streamClient = read('src/services/StreamClient.ts');

  it('keeps the documented backoff constants', () => {
    expect(streamClient).toMatch(/INITIAL_RECONNECT_DELAY_MS\s*=\s*1000/);
    expect(streamClient).toMatch(/maxReconnectAttempts\s*=\s*10\b/);
    expect(streamClient).toMatch(/maxReconnectDelay\s*=\s*30000/);
  });

  it("treats a chat/error with request_id === 'auth' as non-retriable", () => {
    expect(streamClient).toMatch(/event\.type === 'chat\/error'\s*&&\s*event\.request_id === 'auth'/);
  });
});

describe('FINISH_TOOL is a single source of truth', () => {
  it('is defined once, and every other reference imports the constant', () => {
    const defs = contentsExcept(nonTestSrcFiles, f =>
      /export const FINISH_TOOL = 'finish';/.test(readFileSync(f, 'utf8')),
    );
    expect(defs.map(d => d.file)).toEqual([resolve(src, 'services/BrowserToolService.ts')]);

    const strayLiteral = nonTestSrcFiles.filter(f => {
      if (f === resolve(src, 'services/BrowserToolService.ts')) return false;
      return /['"]finish['"]/.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
    });
    expect(strayLiteral).toEqual([]);
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

describe('localStorage access', () => {
  it('is confined to StorageService.readLocal / writeLocal', () => {
    expectNoOffendersExcept(/\blocalStorage\./, 'services/StorageService.ts');
  });
});

describe('console usage', () => {
  it('never calls console.log/info/debug in src/', () => {
    expectNoOffendersExcept(/console\.(log|info|debug)\(/);
  });

  it('routes every warn through utils/log.ts logWarn — no bare console.warn elsewhere', () => {
    expectNoOffendersExcept(/console\.warn\(/, 'utils/log.ts');
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

describe('retired settings (db-V247)', () => {
  it('never reappear in src/', () => {
    const retired = ['widget_device', 'widget_bounce_effect', 'widget_shadow', 'widget_feature_human'];
    const offenders = nonTestSrcFiles.filter(f => retired.some(name => readFileSync(f, 'utf8').includes(name)));
    expect(offenders).toEqual([]);
  });
});

describe('zod schema value-import boundary', () => {
  it('is never imported as a value outside src/sdk/ and src/test/', () => {
    const guarded = nonTestSrcFiles.filter(f => !f.includes('/sdk/') && !f.includes('/test/'));
    const offenders = guarded.filter(f => {
      const line = readFileSync(f, 'utf8')
        .split('\n')
        .find(l => l.includes('WidgetSettingsDataSchema') && l.trimStart().startsWith('import'));
      return line !== undefined && !line.includes('import type');
    });
    expect(offenders).toEqual([]);
  });
});

describe('no CSS framework', () => {
  const pkg = JSON.parse(read('package.json'));

  it('has no tailwind/classnames dependency and no cn( helper calls', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).some(name => /tailwind|classnames/i.test(name))).toBe(false);
    const offenders = nonTestSrcFiles.filter(f =>
      /\bcn\(/.test(
        readFileSync(f, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/`cn\(\)`/g, ''),
      ),
    );
    expect(offenders).toEqual([]);
  });

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

describe('document.activeElement retargeting', () => {
  it('is eslint-banned outside the one activeElementIn reader', () => {
    const eslintConfig = readdirSync(root).find(f => f.startsWith('eslint.config.'));
    if (!eslintConfig) throw new Error('no eslint.config.* at repo root — update this check');
    expect(read(eslintConfig)).toMatch(/no-restricted-properties/);

    expectNoOffendersExcept(/document\.activeElement\b/, 'components/navigation/MessengerShell.tsx');
  });
});

describe('sdk mirror shape', () => {
  it('has no hand-written routes.ts or schema.ts', () => {
    const sdkFiles = walk(resolve(src, 'sdk')).map(f => f.split('/').pop());
    expect(sdkFiles).not.toContain('routes.ts');
    expect(sdkFiles).not.toContain('schema.ts');
  });
});

describe('interactive elements', () => {
  it('never puts onClick on an unroled div or span', () => {
    const offenders: { file: string; tag: string }[] = [];
    for (const file of nonTestSrcFiles) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/<(div|span)\b[\s\S]*?>/g)) {
        if (/onClick=/.test(match[0]) && !/\brole=/.test(match[0])) {
          offenders.push({ file, tag: match[0].slice(0, 80).replace(/\s+/g, ' ') });
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('as-cast floor', () => {
  it('never reintroduces the three narrowing casts a type guard replaced', () => {
    const banned = [
      /\(el as HTMLButtonElement\)\.disabled/,
      /LAYOUT_KEYS\.has\(key as keyof LayoutProps\)/,
      /setActiveView\(value as WidgetView\)/,
    ];
    const offenders = contentsExcept(nonTestSrcFiles, f => banned.some(re => re.test(readFileSync(f, 'utf8'))));
    expect(offenders.map(o => o.file)).toEqual([]);
  });
});
