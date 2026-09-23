/**
 * Colour tests: the text colour a background gets, across every spelling and the whole grey ramp; the
 * one parser's reach through `addOpacity`; and `backgroundGradient` for flat and gradient settings.
 * The WCAG black/white crossover sits at luminance 0.179 (grey 118), not at a naive 0.5 split.
 */
import { describe, expect, it } from 'bun:test';

import { addOpacity, backgroundGradient, getContrastingColor } from '../color';

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

  it('switches from white to black at the WCAG crossover, not at a naive 0.5 luminance split', () => {
    for (let gray = 0; gray <= 255; gray++) {
      expect(getContrastingColor(`rgb(${gray}, ${gray}, ${gray})`)).toBe(gray < 118 ? '#ffffff' : '#000000');
    }
    expect(getContrastingColor('#3b82f6')).toBe('#000000');
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
