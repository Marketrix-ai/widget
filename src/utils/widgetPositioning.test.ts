import { describe, expect, it } from 'vitest';

import type { WidgetPosition } from '../types';
import {
  getAnchorTopLeft,
  getNearestCornerByTranslation,
  getPanelPositionStyle,
  getPositionClasses,
} from './widgetPositioning';

const CORNERS: WidgetPosition[] = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
const [VW, VH, W, H] = [1280, 800, 56, 56];

// The launcher is positioned by Tailwind class (`bottom-5`, `right-5`, …) and the panel by an inline px
// style — the two run through separate code paths (a scanner-visible class string vs. a runtime
// constant) that cannot share one declaration, so this pins them to the same offset instead. Tailwind's
// default scale here is 1 step = 0.25rem = 4px (`--spacing` in index.css).
describe('the panel px offset stays in lockstep with the Tailwind corner classes', () => {
  it('getPanelPositionStyle matches the scale index baked into getPositionClasses', () => {
    for (const position of CORNERS) {
      const scaleIndex = Number(/-(\d+(?:\.\d+)?)\b/.exec(getPositionClasses(position))?.[1]);
      const style = getPanelPositionStyle(position);
      const px = Number(String(Object.values(style)[0]).replace('px', ''));
      expect(px).toBe(scaleIndex * 4);
    }
  });
});

describe('getNearestCornerByTranslation', () => {
  it('picks the corner the drag actually lands on, from every starting corner', () => {
    for (const from of CORNERS) {
      const start = getAnchorTopLeft(from, VW, VH, W, H);
      for (const to of CORNERS) {
        const target = getAnchorTopLeft(to, VW, VH, W, H);
        const translation = { dx: target.x - start.x, dy: target.y - start.y };
        expect(getNearestCornerByTranslation(translation, from, VW, VH, W, H)).toBe(to);
      }
    }
  });

  it('keeps the current corner when the drag barely moves', () => {
    for (const from of CORNERS) {
      expect(getNearestCornerByTranslation({ dx: 3, dy: -3 }, from, VW, VH, W, H)).toBe(from);
    }
  });

  it('snaps by proximity, not by axis', () => {
    expect(getNearestCornerByTranslation({ dx: -900, dy: -600 }, 'bottom_right', VW, VH, W, H)).toBe('top_left');
    expect(getNearestCornerByTranslation({ dx: 0, dy: -600 }, 'bottom_right', VW, VH, W, H)).toBe('top_right');
    expect(getNearestCornerByTranslation({ dx: 900, dy: 0 }, 'bottom_left', VW, VH, W, H)).toBe('bottom_right');
  });
});
