/**
 * Colour handling for tenant widget settings: reading a settings colour into channels, picking text
 * that reads legibly over it, and re-emitting it with an alpha.
 *
 * `toRgb` parses a hex or `rgb()`/`rgba()` string into channels, or null for anything else — a named
 * colour or `hsl()` setting is unreadable by design. `getContrastingColor` picks whichever of black or
 * white has the higher WCAG contrast ratio against a colour.
 * `addOpacity` re-emits a colour at a given alpha. `backgroundGradient` turns a tenant's background
 * setting, which may already be a gradient, into a `backgroundImage` value either way.
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
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255);
}

function contrastRatio(a: string, b: string): number | null {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);
  if (!rgbA || !rgbB) return null;
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

export function getContrastingColor(color: string): string {
  if (!toRgb(color)) return '#000000';
  return (contrastRatio(color, '#000000') ?? 0) >= (contrastRatio(color, '#ffffff') ?? 0) ? '#000000' : '#ffffff';
}

export function addOpacity(color: string, opacity: number): string {
  const rgb = toRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
}

export function backgroundGradient(color: string): string {
  return color.includes('gradient') ? color : `linear-gradient(135deg, ${color} 0%, ${color} 100%)`;
}
