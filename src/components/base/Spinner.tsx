import type { CSSProperties, Ref } from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

const RING: Record<SpinnerSize, CSSProperties> = {
  sm: { width: '14px', height: '14px', borderWidth: '1.5px' },
  md: { width: '20px', height: '20px', borderWidth: '2px' },
  lg: { width: '24px', height: '24px', borderWidth: '2px' },
};

export function Spinner({ size = 'md', style, ref }: SpinnerProps) {
  return (
    <div
      ref={ref}
      data-size={size}
      role='status'
      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...style }}
    >
      <div aria-hidden='true' className='mtx-spinner-ring' style={RING[size]} />
      <span className='mtx-visually-hidden'>Loading</span>
    </div>
  );
}
