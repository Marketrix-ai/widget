/**
 * Attribute Parsing Utilities
 *
 * Pure utility functions for parsing script tag data attributes.
 * These functions validate and normalize attribute values.
 */

/**
 * Parse position attribute from script tag
 */
export function parsePositionAttribute(value: string | null): 'bottom_right' | 'bottom_left' {
  if (value === 'bottom_left' || value === 'bottom_right') {
    return value;
  }
  return 'bottom_right';
}

/**
 * Parse theme attribute from script tag
 */
export function parseThemeAttribute(value: string | null): 'light' | 'dark' {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return 'light';
}

/**
 * Parse enabled modes attribute from script tag
 */
export function parseEnabledModesAttribute(value: string | null): ('show' | 'tell' | 'do')[] {
  if (!value) {
    return ['show', 'tell', 'do'];
  }

  const modes = value.split(',').map((m) => m.trim());
  const validModes: ('show' | 'tell' | 'do')[] = [];

  for (const mode of modes) {
    if (mode === 'show' || mode === 'tell' || mode === 'do') {
      validModes.push(mode);
    }
  }

  return validModes.length > 0 ? validModes : ['show', 'tell', 'do'];
}
