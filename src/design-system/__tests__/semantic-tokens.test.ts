import { describe, expect, it } from 'vitest';

import { getMockWidgetConfig } from '../../test/fixtures';
import { createSemanticTokens, semanticTokensToCssCustomProperties } from '../semantic-tokens';

describe('createSemanticTokens', () => {
  it('derives every colour var from the tenant settings', () => {
    const css = semanticTokensToCssCustomProperties(createSemanticTokens(getMockWidgetConfig()));

    expect(css['--background']).toBe('#111827');
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
});
