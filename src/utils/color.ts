/**
 * Color utility functions for widget theming
 */

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

/**
 * Calculates the relative luminance of a color (0-1)
 * Based on WCAG formula
 */
function getLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0.5; // Default to medium luminance if parsing fails

  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastingColor(color: string): string {
  const luminance = getLuminance(color);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Adds opacity to a color
 * Supports hex colors (with or without #) and rgb/rgba strings
 */
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

  // Handle gradient strings - return as-is with reduced opacity
  if (color.includes('gradient') || color.includes('linear-gradient')) {
    // For gradients, we can't easily add opacity, so return a semi-transparent version
    // by wrapping in rgba or returning as-is
    return color;
  }

  // Fallback: return color as-is
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
