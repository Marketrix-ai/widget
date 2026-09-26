/**
 * Colour handling for tenant settings: `toRgb` reads hex or `rgb()`/`rgba()` (anything else is unreadable by
 * design), `getContrastingColor` picks black or white by WCAG contrast, `addOpacity` re-emits a colour with an
 * alpha, and `backgroundGradient` turns a background setting, possibly already a gradient, into a
 * `backgroundImage`.
 */

type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([a-f\d]{3}|[a-f\d]{6})$/i;
const RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i;

function toRgb(color: string): Rgb | null {
  const digits = HEX.exec(color.trim())?.[1];
  if (digits) {
    const n = parseInt(digits.length === 3 ? [...digits].map(c => c + c).join('') : digits, 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgb = RGB.exec(color.trim());
  if (!rgb) return null;
  const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return r > 255 || g > 255 || b > 255 ? null : { r, g, b };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const linearize = (channel: number): number =>
    channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255);
}

export function getContrastingColor(color: string): string {
  const rgb = toRgb(color);
  if (!rgb) return '#000000';
  const lum = relativeLuminance(rgb);
  return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? '#000000' : '#ffffff';
}

export function addOpacity(color: string, opacity: number): string {
  const rgb = toRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
}

export function backgroundGradient(color: string): string {
  return color.includes('gradient') ? color : `linear-gradient(135deg, ${color} 0%, ${color} 100%)`;
}
