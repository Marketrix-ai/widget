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

// WCAG relative luminance, or null for a colour this cannot read.
function getLuminance(color: string): number | null {
  const rgb = toRgb(color);
  if (!rgb) return null;

  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const TEXT_ON_UNREADABLE_BACKGROUND = '#000000';

export function getContrastingColor(color: string): string {
  const luminance = getLuminance(color);
  if (luminance === null) return TEXT_ON_UNREADABLE_BACKGROUND;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function addOpacity(color: string, opacity: number): string {
  const rgb = toRgb(color);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
}
