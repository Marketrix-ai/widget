/**
 * The radius scale gives each value exactly one name, so no two tokens are silent synonyms.
 */
import { describe, expect, it } from 'vitest';

import { RADIUS } from '../component-tokens';

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
