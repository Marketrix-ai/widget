/**
 * The radius scale gives each value exactly one name, so no two tokens are silent synonyms. Every
 * `notificationToneStyles` colour is fixed (no tenant setting reaches a toast), so each rendered pair is
 * measured here against the WCAG threshold it actually needs, pinning the palette against a future edit
 * that reads fine by eye but regresses the ratio.
 */
import { describe, expect, it } from 'bun:test';

import { contrastRatio } from '../../utils/color';
import { notificationToneStyles, RADIUS } from '../component-tokens';

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

describe('the fixed notification palette', () => {
  it('clears text at 4.5:1 and the close icon at 3:1 against each tone background', () => {
    for (const [tone, colors] of Object.entries(notificationToneStyles)) {
      const bg = tone === 'neutral' ? '#ffffff' : colors.background; // neutral's bg carries alpha; approximate its lightest case
      expect(contrastRatio(colors.titleColor, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.bodyColor, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.closeColor, bg)).toBeGreaterThanOrEqual(3);
    }
  });
});
