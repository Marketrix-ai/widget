/**
 * `themeCssProperties` tests: every colour var derives from the tenant settings, a radius or duration
 * left in a stored settings blob is ignored, the fixed radius and durations are emitted, and the focus
 * ring follows the background rather than the accent.
 */
import { describe, expect, it } from 'bun:test';

import { getMockWidgetConfig } from '../../test/fixtures';
import { getContrastingColor } from '../../utils/color';
import { themeCssProperties } from '../semantic-tokens';

describe('themeCssProperties', () => {
  it('derives every colour var from the tenant settings', () => {
    const css = themeCssProperties(getMockWidgetConfig());

    expect(css['--card']).toBe('#111827');
    expect(css['--foreground']).toBe('#f9fafb');
    expect(css['--primary']).toBe('#3b82f6');
    expect(css['--border']).toBe('#374151');
  });

  it('ignores a radius or duration left in a stored settings blob', () => {
    const stale = { ...getMockWidgetConfig(), widget_border_radius: '99px', widget_fade_duration: '9s' };

    expect(themeCssProperties(stale)).toEqual(themeCssProperties(getMockWidgetConfig()));
  });

  it('pins the exact opacity of every derived muted/faint/hover variant', () => {
    const css = themeCssProperties(getMockWidgetConfig());

    expect(css['--foreground-muted']).toBe('rgba(249, 250, 251, 0.6)');
    expect(css['--foreground-faint']).toBe('rgba(249, 250, 251, 0.4)');
    expect(css['--primary-hover']).toBe('rgba(59, 130, 246, 0.85)');
    expect(css['--secondary-bg']).toBe('rgba(107, 114, 128, 0.2)');
    expect(css['--secondary-hover']).toBe('rgba(107, 114, 128, 0.3)');
  });

  it('emits the fixed radius and durations', () => {
    const css = themeCssProperties(getMockWidgetConfig());

    expect(css['--radius']).toBe('12px');
    expect(css['--duration-animation']).toBe('300ms');
    expect(css['--duration-fade']).toBe('200ms');
  });

  it('derives the focus ring from the background regardless of the tenant accent, for both readings', () => {
    for (const widget_background_color of ['#ffffff', '#111827', '#f5f5f4', '#0a0a0a', '#fef3c7', '#1e293b']) {
      const css = themeCssProperties(getMockWidgetConfig({ widget_background_color, widget_accent_color: '#a855f7' }));
      expect(css['--ring-offset']).toBe(widget_background_color);
      expect(css['--ring']).toBe(getContrastingColor(widget_background_color));
    }
  });
});
