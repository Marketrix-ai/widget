/**
 * Colour tests: the text colour a background gets is readable on every spelling of white and black and
 * falls back to black (never white) for an unreadable value; a scan across the whole luminance range
 * pins the actual invariant — every synthesized foreground clears WCAG AA (4.5:1) — which a literal
 * `luminance > 0.5` split silently fails for roughly a third of the range (the black/white contrast
 * crossover sits at luminance ≈0.179); the one parser reads shorthand hex, refuses out-of-range channels,
 * and `addOpacity` gets the same reach; `backgroundGradient` passes a gradient setting through and
 * expands a flat colour, so panel and transcript paint the same thing.
 */
import { describe, expect, it } from 'bun:test';

import { addOpacity, backgroundGradient, contrastRatio, getContrastingColor } from '../color';

describe('the text colour a widget background gets', () => {
  it('is readable on every spelling of white, not only the six-digit one', () => {
    for (const white of ['#ffffff', '#fff', '#FFF', '#FFFFFF', 'rgb(255, 255, 255)', 'rgba(255,255,255,1)']) {
      expect(getContrastingColor(white)).toBe('#000000');
    }
  });

  it('is readable on every spelling of black', () => {
    for (const black of ['#000000', '#000', 'rgb(0,0,0)']) {
      expect(getContrastingColor(black)).toBe('#ffffff');
    }
  });

  it('falls back to black for a colour it cannot read, never to white', () => {
    for (const unreadable of ['white', 'hsl(0 0% 100%)', 'var(--brand)', '', 'nonsense']) {
      expect(getContrastingColor(unreadable)).toBe('#000000');
    }
  });

  it('clears WCAG AA (4.5:1) against every background, including the luminance band a naive 0.5 split misreads', () => {
    for (let gray = 0; gray <= 255; gray += 5) {
      const bg = `rgb(${gray}, ${gray}, ${gray})`;
      const fg = getContrastingColor(bg);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(getContrastingColor('#3b82f6'), '#3b82f6')).toBeGreaterThanOrEqual(4.5);
  });

  it('computes the exact WCAG ratio in the low-luminance linear branch, pinning its divisor and offset', () => {
    expect(contrastRatio('rgb(10, 10, 10)', '#000000')).toBeCloseTo(1.0607053967097675, 10);
  });
});

describe('the one colour parser', () => {
  it('reads the shorthand hex the widget settings accept', () => {
    expect(addOpacity('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(addOpacity('#0a0', 1)).toBe('rgba(0, 170, 0, 1)');
    expect(addOpacity('4287f5', 1)).toBe('rgba(66, 135, 245, 1)');
  });

  it('refuses a channel outside the byte range rather than emitting it', () => {
    expect(addOpacity('rgb(300, 0, 0)', 0.5)).toBe('rgb(300, 0, 0)');
  });

  it('gives contrastRatio null if EITHER side is unreadable, not only if both are', () => {
    expect(contrastRatio('not-a-color', '#ffffff')).toBeNull();
    expect(contrastRatio('#ffffff', 'not-a-color')).toBeNull();
  });

  it('gives addOpacity the same reach, so a shorthand hex is no longer passed through opaque', () => {
    expect(addOpacity('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(addOpacity('rgb(1, 2, 3)', 0.25)).toBe('rgba(1, 2, 3, 0.25)');
    expect(addOpacity('var(--brand)', 0.5)).toBe('var(--brand)');
  });
});

describe('the widget background as a backgroundImage', () => {
  it('passes a gradient setting through, since it is already legal as backgroundImage', () => {
    const gradient = 'linear-gradient(90deg, #fff 0%, #000 100%)';
    expect(backgroundGradient(gradient)).toBe(gradient);
    expect(backgroundGradient('radial-gradient(#fff, #000)')).toBe('radial-gradient(#fff, #000)');
  });

  it('expands a flat colour to a same-stop gradient, so one declaration covers both spellings', () => {
    expect(backgroundGradient('#ffffff')).toBe('linear-gradient(135deg, #ffffff 0%, #ffffff 100%)');
  });
});
