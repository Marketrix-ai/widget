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
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WidgetProviders } from '../../../context/WidgetProviders';
import { getMockWidgetConfig } from '../../../test/fixtures';
import { WidgetRoot } from '../../WidgetRoot';

describe('the resting launcher anchor', () => {
  it('pins two edges, never four', () => {
    const { container } = render(
      <WidgetProviders>
        <WidgetRoot config={getMockWidgetConfig()} />
      </WidgetProviders>,
    );

    const anchor = container.querySelector<HTMLElement>('.mtx-fab-anchor');
    expect(anchor).not.toBeNull();
    const pinned = (['top', 'bottom', 'left', 'right'] as const).filter(edge => anchor?.style[edge] !== '');
    expect(pinned.sort()).toEqual(['bottom', 'right']);
  });
});
