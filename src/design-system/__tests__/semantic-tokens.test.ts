/**
 * `createSemanticTokens` tests: every colour var derives from the tenant settings, a radius or duration
 * left in a stored settings blob is ignored, and the fixed radius and durations are emitted.
 */
import { describe, expect, it } from 'bun:test';

import { getMockWidgetConfig } from '../../test/fixtures';
import { contrastRatio } from '../../utils/color';
import { createSemanticTokens, semanticTokensToCssCustomProperties } from '../semantic-tokens';

describe('createSemanticTokens', () => {
  it('derives every colour var from the tenant settings', () => {
    const css = semanticTokensToCssCustomProperties(createSemanticTokens(getMockWidgetConfig()));

    expect(css['--card']).toBe('#111827');
    expect(css['--foreground']).toBe('#f9fafb');
    expect(css['--primary']).toBe('#3b82f6');
    expect(css['--border']).toBe('#374151');
  });

  it('ignores a radius or duration left in a stored settings blob', () => {
    const stale = { ...getMockWidgetConfig(), widget_border_radius: '99px', widget_fade_duration: '9s' };

    expect(semanticTokensToCssCustomProperties(createSemanticTokens(stale))).toEqual(
      semanticTokensToCssCustomProperties(createSemanticTokens(getMockWidgetConfig())),
    );
  });

  it('emits the fixed radius and durations', () => {
    const css = semanticTokensToCssCustomProperties(createSemanticTokens());

    expect(css['--radius']).toBe('12px');
    expect(css['--duration-animation']).toBe('300ms');
    expect(css['--duration-fade']).toBe('200ms');
  });

  it('derives a focus ring that clears 3:1 against the background regardless of the tenant accent, for both readings', () => {
    for (const widget_background_color of ['#ffffff', '#111827', '#f5f5f4', '#0a0a0a', '#fef3c7', '#1e293b']) {
      const css = semanticTokensToCssCustomProperties(
        createSemanticTokens({ widget_background_color, widget_accent_color: '#a855f7' }),
      );
      expect(contrastRatio(css['--ring']!, css['--ring-offset']!)).toBeGreaterThanOrEqual(3);
    }
  });
});
