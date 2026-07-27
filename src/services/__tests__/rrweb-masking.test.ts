import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordMock = vi.fn(() => () => {});
vi.mock('@rrweb/record', () => ({ record: (opts: unknown) => recordMock(opts as never) }));
vi.mock('../../sdk', () => ({ sdk: { widgetMessage: vi.fn().mockResolvedValue({ ok: true }) } }));

const { RrwebSessionRecorder } = await import('../RrwebSessionRecorder');

describe('rrweb capture privacy', () => {
  beforeEach(() => recordMock.mockClear());

  it('masks every input by default', async () => {
    await new RrwebSessionRecorder('chat_1', 1).start();
    expect(recordMock.mock.calls[0]?.[0]).toMatchObject({ maskAllInputs: true });
  });

  // A plain string would REPLACE rrweb's rr-* defaults, un-blocking a customer's existing .rr-block markup.
  it('honours both the mtx- and the native rr- privacy classes', async () => {
    await new RrwebSessionRecorder('chat_1', 1).start();
    const opts = recordMock.mock.calls[0]?.[0] as { maskTextClass: RegExp; blockClass: RegExp };

    for (const cls of ['rr-mask', 'mtx-mask']) expect(opts.maskTextClass.test(cls)).toBe(true);
    for (const cls of ['rr-block', 'mtx-block']) expect(opts.blockClass.test(cls)).toBe(true);
    expect(opts.maskTextClass.test('unrelated')).toBe(false);
    expect(opts.blockClass.test('unrelated')).toBe(false);
  });
});
