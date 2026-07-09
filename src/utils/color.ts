export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

// Relative luminance (0-1) per the WCAG formula.
function getLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0.5; // medium luminance if parsing fails

  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastingColor(color: string): string {
  const luminance = getLuminance(color);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Adds opacity to a hex or rgb/rgba color.
export function addOpacity(color: string, opacity: number): string {
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }

  const rgb = hexToRgb(color);
  if (rgb) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }

  // Gradients can't take an opacity channel — return unchanged.
  if (color.includes('gradient') || color.includes('linear-gradient')) {
    return color;
  }

  return color;
}

export function darkenColor(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = 1 - amount;
  return rgbToHex(Math.round(rgb.r * factor), Math.round(rgb.g * factor), Math.round(rgb.b * factor));
}

export const formatMessageTime = (date: Date | undefined): string => {
  if (!date) {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const getModeDisplayName = (mode: 'show' | 'tell' | 'do'): string => {
  switch (mode) {
    case 'show':
      return 'Show';
    case 'tell':
      return 'Tell';
    case 'do':
      return 'Do';
    default:
      return mode;
  }
};
