/**
 * `index.css` invariants that fail SILENTLY — the rule matches nothing, the animation resolves to no
 * keyframe, the class has no rule — so neither tsc, eslint, prettier nor a rendering test can see them.
 *
 * The old safelist invariant is gone with Tailwind: layout props now resolve to a style object, so
 * there is no interpolated class for a scanner to miss. What replaces it is the animation contract —
 * `resolveLayoutStyle` and the component classes name keyframes this file must actually define.
 *
 * `definedKeyframes` parses the `@keyframes` set once and is shared by every suite below.
 *
 * - "every animation resolves to a keyframe this stylesheet defines" walks the contract both ways: an
 *   `it.each` over the four `animate` tokens asserts the first word of `resolveLayoutStyle`'s
 *   `animation` shorthand is a defined keyframe, and a companion test asserts the same of every
 *   `animation:` named in a CSS rule.
 * - "scopes every host-level rule to :host as well as :root" flags a selector list carrying `:root`
 *   without `:host`. A `:root` selector in a shadow-tree stylesheet matches nothing at all; `:host` is
 *   what carries the tenant tokens inside the closed root, and `:root` only covers the non-shadow dev
 *   preview.
 * - "the component tree and the stylesheet name the same classes" walks `../components` with
 *   `sourceFiles` (recursive readdir, non-test `.ts`/`.tsx`) and asserts the `.mtx-*` rules and the
 *   `mtx-*` string literals cover each other in both directions — a class no rule matches renders
 *   unstyled, and a rule nothing references is dead weight shipped to every host page. Referenced
 *   names are filtered against `definedKeyframes` because an animation shorthand names a keyframe,
 *   not a class — the animation suite above already covers those.
 * - "keeps the reset at zero specificity so component classes always win" flags an unwrapped
 *   `[data-marketrix-widget] <tag>` reset selector: it scores (0,1,1) and outranks `.mtx-button`
 *   (0,1,0) — that is how `font: inherit` flattened every button to weight 400 and `border-radius: 0`
 *   un-rounded the icon buttons. `:where()` drops the reset to zero, so this must stay green.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { resolveLayoutStyle } from '../components/base/layoutProps';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../index.css'), 'utf8');

const definedKeyframes = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1]));

describe('every animation resolves to a keyframe this stylesheet defines', () => {
  it.each(['spin', 'ping', 'pulse', 'fadeIn'] as const)('layout prop animate: %s', token => {
    const name = String(resolveLayoutStyle({ animate: token }).animation).split(' ')[0];
    expect(definedKeyframes, `resolveLayoutStyle emits ${name}, which index.css never defines`).toContain(name);
  });

  it('every animation named in a CSS rule is defined in the same file', () => {
    const used = [...css.matchAll(/(?:^|[;{\s])animation:\s*([A-Za-z][\w-]*)/gm)].map(match => match[1]);
    const undefinedNames = [...new Set(used)].filter(name => !definedKeyframes.has(name));
    expect(undefinedNames, 'these animations name a keyframe that does not exist').toEqual([]);
  });
});

it('scopes every host-level rule to :host as well as :root', () => {
  const unpaired = [...css.matchAll(/(?:^|[{};])\s*([^{};]*?)\s*\{/g)]
    .map(match => match[1])
    .filter(selectors => /(^|,)\s*:root\b/.test(selectors) && !selectors.includes(':host'));
  expect(unpaired, ':root alone matches nothing inside the closed shadow root — pair it with :host').toEqual([]);
});

describe('the component tree and the stylesheet name the same classes', () => {
  function sourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) sourceFiles(path, acc);
      else if (/\.tsx?$/.test(path) && !/__tests__|\.test\./.test(path)) acc.push(path);
    }
    return acc;
  }

  const defined = new Set([...css.matchAll(/\.(mtx-[\w-]+)/g)].map(match => match[1]));
  const referenced = new Set(
    sourceFiles(resolve(here, '../components'))
      .flatMap(file => [...readFileSync(file, 'utf8').matchAll(/['`](mtx-[\w-]+)[\s'`]/g)].map(match => match[1]))
      .filter(name => !definedKeyframes.has(name)),
  );

  it('every class a component puts on an element has a rule', () => {
    expect([...referenced].filter(name => !defined.has(name))).toEqual([]);
  });

  it('every rule in the stylesheet is reachable from a component', () => {
    expect([...defined].filter(name => !referenced.has(name))).toEqual([]);
  });
});

it('keeps the reset at zero specificity so component classes always win', () => {
  const hazards = [...css.matchAll(/(^|[,}])\s*(\[data-marketrix-widget\]\s+(?!:where)[a-z][\w-]*)/gm)].map(match =>
    match[2].trim(),
  );
  expect(hazards, 'wrap these reset selectors in :where() or they outrank the component classes').toEqual([]);
});
