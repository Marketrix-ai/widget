import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useResize } from './useResize';

const sizeFor = (width: string | undefined, height: string | undefined) =>
  renderHook(() => useResize(width, height, 'tenant', false)).result.current;

describe('the panel size a dashboard setting produces', () => {
  it('uses a px setting as written', () => {
    expect(sizeFor('400px', '500px')).toMatchObject({ widthPx: '400px', heightPx: '500px' });
  });

  it('keeps the default for a length it cannot convert to px', () => {
    expect(sizeFor('20rem', '30em')).toMatchObject({ widthPx: '360px', heightPx: '450px' });
  });

  it('holds a setting outside the drag range to the same bounds a drag has', () => {
    expect(sizeFor('20px', '10px')).toMatchObject({ widthPx: '280px', heightPx: '320px' });
    expect(sizeFor('900px', undefined)).toMatchObject({ widthPx: '600px' });
  });
});
