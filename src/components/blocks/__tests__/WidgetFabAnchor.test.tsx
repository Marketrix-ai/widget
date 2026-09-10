/**
 * Regression test for the resting launcher's CSS anchoring: it renders the whole widget through
 * `WidgetProviders` + `WidgetRoot` on a mock config and asserts that `.mtx-fab-anchor` carries exactly
 * the `bottom` and `right` inline offsets — never all four edges.
 *
 * A fixed box with top AND bottom set takes its height from those offsets, and `useDragSnap` feeds the
 * measured height back into top — derived from `window.innerHeight`, which is not what the browser
 * resolves top against. The two disagreed by 70px on app.marketrix.co and the launcher climbed out of
 * the viewport a step per measurement.
 */
import { describe, expect, it } from 'bun:test';

import { renderWidget } from '../../../test/renderWidget';

describe('the resting launcher anchor', () => {
  it('pins two edges, never four', () => {
    const { container } = renderWidget({}, { previewMode: false });

    const anchor = container.querySelector<HTMLElement>('.mtx-fab-anchor');
    expect(anchor).not.toBeNull();
    const pinned = (['top', 'bottom', 'left', 'right'] as const).filter(edge => anchor?.style[edge] !== '');
    expect(pinned.sort()).toEqual(['bottom', 'right']);
  });
});
