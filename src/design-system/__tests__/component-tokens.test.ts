/**
 * Component token tests: the radius scale gives each value exactly one name, `getElevationStyle` turns a
 * shadow token into a style object or nothing, and the fixed toast palette clears WCAG contrast.
 * No tenant setting reaches a toast, so each rendered pair is measured with axe-core's own contrast
 * maths, a translucent background flattened over black as its worst host page.
 */
import axe from 'axe-core';
import { describe, expect, it } from 'bun:test';

import { getElevationStyle, notificationToneStyles, RADIUS } from '../component-tokens';

declare module 'axe-core' {
  interface AxeColor {
    parseString(value: string): AxeColor;
  }
  interface Commons {
    color: {
      Color: new () => AxeColor;
      flattenColors(foreground: AxeColor, background: AxeColor): AxeColor;
      getContrast(background: AxeColor, foreground: AxeColor): number;
    };
  }
}

const { Color, flattenColors, getContrast } = axe.commons.color;
const colorOf = (value: string) => new Color().parseString(value);

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

describe('the fixed notification palette', () => {
  it('clears text at 4.5:1 and the close icon at 3:1 against each tone background', () => {
    for (const colors of Object.values(notificationToneStyles)) {
      const background = flattenColors(colorOf(colors.background), colorOf('#000000'));
      expect(getContrast(background, colorOf(colors.titleColor))).toBeGreaterThanOrEqual(4.5);
      expect(getContrast(background, colorOf(colors.bodyColor))).toBeGreaterThanOrEqual(4.5);
      expect(getContrast(background, colorOf(colors.closeColor))).toBeGreaterThanOrEqual(3);
    }
  });
});
