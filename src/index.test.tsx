import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { unmountWidget } from './index';
import { StreamClient } from './services/StreamClient';

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  document.head.replaceChildren();
  document.body.replaceChildren();
  window.__mtx = undefined;
});

describe('public widget lifecycle', () => {
  it('disconnects the stream on public unmount', () => {
    const disconnect = vi.spyOn(StreamClient.getInstance(), 'disconnect');

    unmountWidget();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
