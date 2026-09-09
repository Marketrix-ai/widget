/**
 * Colour handling for tenant widget settings: the one home for reading a settings colour into channels,
 * picking text that reads over it, and re-emitting it with an alpha.
 *
 * `toRgb` parses a hex (3- or 6-digit, leading `#` optional — the dashboard accepts both spellings) or an
 * `rgb()`/`rgba()` string into channels, and returns null for anything else. Only those two notations are
 * read: a named colour, `hsl()` or a `var(--…)` custom property is unreadable here by design, and a channel
 * above 255 is refused rather than clamped, so a malformed setting never silently becomes a valid colour.
 * `getContrastingColor` picks the black or white foreground for a background from that colour's WCAG
 * relative luminance — sRGB gamma-decoded per channel, weighted .2126/.7152/.0722, split at 0.5. An
 * unreadable background falls back to BLACK, never white: tenant surfaces skew light, so black stays
 * legible where white would vanish. `addOpacity` re-emits a colour as `rgba()` at the given alpha and
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
  if (hex) {
    const digits = hex[1];
    const pairs =
      digits.length === 3
        ? [digits[0] + digits[0], digits[1] + digits[1], digits[2] + digits[2]]
        : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
    const [r, g, b] = pairs.map(pair => parseInt(pair, 16));
    return { r, g, b };
  }
  const rgb = RGB.exec(color.trim());
  if (!rgb) return null;
  const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  return r > 255 || g > 255 || b > 255 ? null : { r, g, b };
}

export function getContrastingColor(color: string): string {
  const rgb = toRgb(color);
  if (!rgb) return '#000000';
  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#000000' : '#ffffff';
}

export function addOpacity(color: string, opacity: number): string {
  const rgb = toRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
}

export function backgroundGradient(color: string): string {
  return color.includes('gradient') ? color : `linear-gradient(135deg, ${color} 0%, ${color} 100%)`;
}
