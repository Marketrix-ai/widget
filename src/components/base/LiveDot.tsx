/**
 * `LiveDot` — the ping/core span pair that keys `index.css`'s `mtx-live-dot*` rules, the pulsing dot the
 * header's screen-share button and a video message's "Live" pill both wear. The markup contract is fixed
 * by the CSS (an `mtx-live-dot` wrapper around an `mtx-live-dot-ping` and an `mtx-live-dot-core`); only
 * `style` on the wrapper varies per caller (positioning it absolutely over an icon, or tinting it via
 * `currentColor`).
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
