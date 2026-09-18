/**
 * Tests that `index.css` stays internally consistent: every animation names a real keyframe,
 * host-level rules are scoped to `:host` as well as `:root`, every class a component uses has a
 * matching rule and vice versa, and the reset selector never outranks component classes.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'bun:test';

import { resolveLayoutStyle } from '../components/base/layoutProps';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../index.css'), 'utf8');

const definedKeyframes = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(match => match[1]));

describe('every animation resolves to a keyframe this stylesheet defines', () => {
  it.each(['spin', 'ping', 'fadeIn'] as const)('layout prop animate: %s', token => {
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
    .map(match => match[1] ?? '')
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
    (match[2] ?? '').trim(),
  );
  expect(hazards, 'wrap these reset selectors in :where() or they outrank the component classes').toEqual([]);
});
