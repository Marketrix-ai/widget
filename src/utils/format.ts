/**
 * Color utility functions for widget theming
 */

/**
 * Converts hex color to RGB
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

/**
 * Converts RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Calculates the relative luminance of a color (0-1)
 * Based on WCAG formula
 */
function getLuminance(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0.5; // Default to medium luminance if parsing fails

  const [r, g, b] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((val) => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Gets a contrasting color (white or black) based on the background color
 */
export function getContrastingColor(color: string): string {
  const luminance = getLuminance(color);
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Adds opacity to a color
 * Supports hex colors (with or without #) and rgb/rgba strings
 */
export function addOpacity(color: string, opacity: number): string {
  // Handle rgba/rgb strings
  if (color.startsWith('rgba') || color.startsWith('rgb')) {
    // Extract RGB values
    const match = color.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }

  // Handle hex colors
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

/**
 * Darkens a color by a specified amount (0-1)
 */
export function darkenColor(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = 1 - amount;
  return rgbToHex(
    Math.round(rgb.r * factor),
    Math.round(rgb.g * factor),
    Math.round(rgb.b * factor)
  );
}

/**
 * Lightens a color by a specified amount (0-1)
 */
export function lightenColor(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = 1 + amount;
  return rgbToHex(
    Math.min(255, Math.round(rgb.r * factor)),
    Math.min(255, Math.round(rgb.g * factor)),
    Math.min(255, Math.round(rgb.b * factor))
  );
}

/**
 * Extracts the first color from a gradient string, or returns the color as-is
 */
export function extractColorFromGradient(color: string): string {
  // Try to extract hex color from gradient
  const hexMatch = color.match(/#[0-9A-Fa-f]{6}/);
  if (hexMatch) {
    return hexMatch[0];
  }

  // Try to extract rgb color
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    return rgbToHex(r, g, b);
  }

  // Return as-is if no color found
  return color;
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

export const getModeDescription = (mode: 'show' | 'tell' | 'do'): string => {
  switch (mode) {
    case 'show':
      return "I'll show you how to do this";
    case 'tell':
      return "I'll explain this to you";
    case 'do':
      return "I'll do this for you";
    default:
      return '';
  }
};
