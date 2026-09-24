/**
 * `Spinner` — a `role=status` ring in two sizes with a visually-hidden "Loading" label, so the
 * state is announced without visible text.
 */
import type { CSSProperties } from 'react';

type SpinnerSize = 'sm' | 'lg';

const RING: Record<SpinnerSize, CSSProperties> = {
  sm: { width: '14px', height: '14px', borderWidth: '1.5px' },
  lg: { width: '24px', height: '24px', borderWidth: '2px' },
};

export function Spinner({ size, style }: { size: SpinnerSize; style?: CSSProperties }) {
  return (
    <div role='status' style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...style }}>
      <div aria-hidden='true' className='mtx-spinner-ring' style={RING[size]} />
      <span className='mtx-visually-hidden'>Loading</span>
    </div>
  );
}
