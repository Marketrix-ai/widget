import { render } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import { Video } from '../Video';

describe('Video', () => {
  it('renders a video element', () => {
    const { container } = render(<Video />);
    expect(container.querySelector('video')).toBeTruthy();
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLVideoElement>();
    render(<Video ref={ref} />);
    expect(ref.current?.tagName).toBe('VIDEO');
  });

  it('merges className', () => {
    const { container } = render(<Video className='w-full rounded' />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.classList.contains('w-full')).toBe(true);
    expect(video.classList.contains('rounded')).toBe(true);
  });

  it('passes through video attributes', () => {
    const { container } = render(<Video autoPlay controls muted />);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.controls).toBe(true);
  });
});
