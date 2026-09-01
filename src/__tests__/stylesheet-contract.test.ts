/**
 * Two `index.css` invariants that fail SILENTLY — the class simply never ships, or the rule matches
 * nothing — so neither tsc, eslint, prettier nor a rendering test can see them.
 *
 * 1. `resolveLayoutClasses` interpolates `p-*`/`gap-*`/`inset-*` from `SPACING_SCALE`, which Tailwind's
 *    source scanner cannot see; the `@source inline(...)` safelist is the only thing that emits them.
 * 2. A shadow-tree stylesheet's `:root` matches nothing, so every host-level rule needs `:host` too.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SPACING_SCALE } from '../components/base/layoutProps';

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');

/** The two `{a,b}` groups of `@source inline("{p,px,…}-{0,0.5,…}")`, as prefixes and suffixes. */
function safelist(): { prefixes: string[]; suffixes: string[] } {
  const directive = /@source inline\("\{([^}]+)\}-\{([^}]+)\}"\)/.exec(css);
  if (!directive) throw new Error('index.css has no `@source inline("{…}-{…}")` safelist');
  return { prefixes: directive[1].split(','), suffixes: directive[2].split(',') };
}

describe('the Tailwind safelist covers every interpolated layout class', () => {
  it('emits a class for every spacing token', () => {
    const missing = Object.values(SPACING_SCALE).filter(value => !safelist().suffixes.includes(value));
    expect(missing, 'widen @source inline(...) in index.css or the class silently never ships').toEqual([]);
  });

  it('carries no suffix the scale cannot produce', () => {
    const values = new Set<string>(Object.values(SPACING_SCALE));
    const dead = safelist().suffixes.filter(suffix => !values.has(suffix));
    expect(dead, 'these safelisted classes ship in the bundle and nothing can ever apply them').toEqual([]);
  });
});

it('scopes every host-level rule to :host as well as :root', () => {
  // A `:root` selector in a shadow-tree stylesheet matches nothing at all; `:host` is what carries the
  // tenant tokens inside the closed root, and `:root` only covers the non-shadow dev preview.
  const unpaired = [...css.matchAll(/(?:^|[{};])\s*([^{};]*?)\s*\{/g)]
    .map(match => match[1])
    .filter(selectors => /(^|,)\s*:root\b/.test(selectors) && !selectors.includes(':host'));
  expect(unpaired, ':root alone matches nothing inside the closed shadow root — pair it with :host').toEqual([]);
});
