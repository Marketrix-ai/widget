/**
 * Component token tests: the radius scale gives each value exactly one name, and `getElevationStyle`
 * turns a shadow token into a style object or nothing.
 */
import { describe, expect, it } from 'bun:test';

import { getElevationStyle, RADIUS } from '../component-tokens';

describe('the radius scale', () => {
  it('gives each value exactly one name, so no two tokens are silent synonyms', () => {
    const byValue = new Map<string, string[]>();
    for (const [name, value] of Object.entries(RADIUS)) {
      byValue.set(value, [...(byValue.get(value) ?? []), name]);
    }
    const synonyms = [...byValue.values()].filter(names => names.length > 1);
    expect(synonyms).toEqual([]);
  });
});

describe('getElevationStyle', () => {
  it('returns undefined for a "none" token, not a boxShadow: "none" style object', () => {
    expect(getElevationStyle('none')).toBeUndefined();
  });

  it('returns undefined for no token at all', () => {
    expect(getElevationStyle(undefined)).toBeUndefined();
    expect(getElevationStyle(null)).toBeUndefined();
  });

  it('turns a real token into its boxShadow value', () => {
    expect(getElevationStyle('card')).toEqual({ boxShadow: '0 1px 4px rgba(0,0,0,0.1)' });
  });
});
