/**
 * rrweb privacy tests: every input is masked by default, and both the `mtx-` and native `rr-` privacy
 * classes are honoured.
 */
import type { record as recordFn } from '@rrweb/record';
import { beforeEach, describe, expect, it, vi } from 'bun:test';

import type { WidgetClient } from '../../sdk';
import { mockSdk } from '../../test/vi-compat';

const recordMock = vi.fn<(...args: Parameters<typeof recordFn>) => ReturnType<typeof recordFn>>(() => () => {});
vi.mock('@rrweb/record', () => ({ record: recordMock }));
mockSdk({ widgetMessagePost: vi.fn<WidgetClient['widgetMessagePost']>().mockResolvedValue({ success: true }) });

const { RrwebSessionRecorder } = await import('../RrwebSessionRecorder');
const { streamClient } = await import('../StreamClient');

describe('rrweb capture privacy', () => {
  beforeEach(() => {
    recordMock.mockClear();
    vi.spyOn(streamClient, 'ready').mockResolvedValue();
  });

  it('masks every input by default', async () => {
    await new RrwebSessionRecorder('chat_1').start();
    expect(recordMock.mock.calls[0]?.[0]).toMatchObject({ maskAllInputs: true });
  });

  it('honours both the mtx- and the native rr- privacy classes', async () => {
    await new RrwebSessionRecorder('chat_1').start();
    const { maskTextClass, blockClass } = recordMock.mock.calls[0]?.[0] ?? {};
    if (!(maskTextClass instanceof RegExp) || !(blockClass instanceof RegExp))
      throw new Error('expected rrweb privacy classes as patterns');

    for (const cls of ['rr-mask', 'mtx-mask']) expect(maskTextClass.test(cls)).toBe(true);
    for (const cls of ['rr-block', 'mtx-block']) expect(blockClass.test(cls)).toBe(true);
    expect(maskTextClass.test('unrelated')).toBe(false);
    expect(blockClass.test('unrelated')).toBe(false);
  });
});
