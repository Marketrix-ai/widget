/**
 * `LiveDot` — the pulsing ping/core dot keyed by `index.css`'s `mtx-live-dot*` rules, worn by the header's
 * screen-share button and a video message's "Live" pill; callers vary only the wrapper's `style`.
 */
import type { CSSProperties } from 'react';

export function LiveDot({ style }: { style?: CSSProperties }) {
  return (
    <span className='mtx-live-dot' style={style}>
      <span className='mtx-live-dot-ping' />
      <span className='mtx-live-dot-core' />
    </span>
  );
}
