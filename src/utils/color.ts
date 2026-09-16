/**
 * Colour handling for tenant widget settings: the one home for reading a settings colour into channels,
 * picking text that reads over it, and re-emitting it with an alpha.
 *
 * `toRgb` parses a hex (3- or 6-digit, leading `#` optional — the dashboard accepts both spellings) or an
 * `rgb()`/`rgba()` string into channels, and returns null for anything else. Only those two notations are
 * read: a named colour, `hsl()` or a `var(--…)` custom property is unreadable here by design, and a channel
 * above 255 is refused rather than clamped, so a malformed setting never silently becomes a valid colour.
 * `getContrastingColor` picks whichever of black or white has the higher WCAG contrast ratio against
 * that background — relative luminance is sRGB gamma-decoded per channel, weighted .2126/.7152/.0722,
 * and the ratio is `(lighter + 0.05) / (darker + 0.05)`. This is the single place a tenant colour without
 * its own paired foreground setting (a button's accent, a status pill) gets one synthesized: the higher
 * of the two ratios is never below ~4.6:1 (the black/white crossover sits at luminance ≈0.179, not 0.5 —
 * a literal `luminance > 0.5` split picks the wrong colour for roughly a third of the luminance range and
 * silently fails the AA 4.5:1 text threshold there), so every synthesized foreground clears AA by
 * construction. An unreadable background falls back to BLACK, never white: tenant surfaces skew light,
 * so black stays legible where white would vanish. `addOpacity` re-emits a colour as `rgba()` at the
 * given alpha and
 * passes an unreadable one through UNCHANGED — it stays a CSS value the browser can still resolve, where
 * an `rgba(NaN, …)` would render nothing.
 *
 * `backgroundGradient` is the one home for `widget_background_color` as a `backgroundImage`: the setting may
 * already be a gradient, which is legal only as `backgroundImage`, so a flat colour is emitted as a same-stop
 * gradient and one declaration covers both spellings. Panel and transcript both paint through it, so there is
 * no second expansion to drift from.
 */

type Rgb = { r: number; g: number; b: number };

const HEX = /^#?([a-f\d]{3}|[a-f\d]{6})$/i;
const RGB = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i;

export function toRgb(color: string): Rgb | null {
  const hex = HEX.exec(color.trim());
  const digits = hex?.[1];
  if (digits) {
    const [p0, p1, p2] =
      digits.length === 3
        ? [
            digits.charAt(0) + digits.charAt(0),
            digits.charAt(1) + digits.charAt(1),
            digits.charAt(2) + digits.charAt(2),
          ]
        : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
    const r = parseInt(p0 ?? '', 16);
    const g = parseInt(p1 ?? '', 16);
    const b = parseInt(p2 ?? '', 16);
    return { r, g, b };
  }
  const rgb = RGB.exec(color.trim());
  if (!rgb) return null;
  const r = Number(rgb[1]);
  const g = Number(rgb[2]);
  const b = Number(rgb[3]);
  return r > 255 || g > 255 || b > 255 ? null : { r, g, b };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const linearize = (channel: number): number =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255);
}

export function contrastRatio(a: string, b: string): number | null {
  const rgbA = toRgb(a);
  const rgbB = toRgb(b);
  if (!rgbA || !rgbB) return null;
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05);
}

export function getContrastingColor(color: string): string {
  const rgb = toRgb(color);
  if (!rgb) return '#000000';
  const l = relativeLuminance(rgb);
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#ffffff';
}

export function addOpacity(color: string, opacity: number): string {
  const rgb = toRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
}

export function backgroundGradient(color: string): string {
  return color.includes('gradient') ? color : `linear-gradient(135deg, ${color} 0%, ${color} 100%)`;
}
