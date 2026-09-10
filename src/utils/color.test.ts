/**
 * Colour tests: the text colour a background gets is readable on every spelling of white and black and
 * falls back to black (never white) for an unreadable value; the one parser reads shorthand hex, refuses
 * out-of-range channels, and `addOpacity` gets the same reach; `backgroundGradient` passes a gradient
 * setting through and expands a flat colour, so panel and transcript paint the same thing.
 */
import { describe, expect, it } from 'bun:test';

import { addOpacity, backgroundGradient, getContrastingColor, toRgb } from './color';

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
});

describe('the one colour parser', () => {
  it('reads the shorthand hex the widget settings accept', () => {
    expect(toRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(toRgb('#0a0')).toEqual({ r: 0, g: 170, b: 0 });
    expect(toRgb('4287f5')).toEqual({ r: 66, g: 135, b: 245 });
  });

  it('refuses a channel outside the byte range rather than emitting it', () => {
    expect(toRgb('rgb(300, 0, 0)')).toBeNull();
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
