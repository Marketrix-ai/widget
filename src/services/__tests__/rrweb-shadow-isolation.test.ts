/**
 * Embed-hygiene invariant: session recording can never capture the widget's own UI, whatever the
 * text on screen (a visitor's chat transcript, an agent's reply). Nothing in `RrwebSessionRecorder.ts`
 * enforces this — it holds by construction, because `WidgetRoot` mounts inside a CLOSED shadow root
 * (`bootstrap.tsx`'s `attachShadowMount`), and per the DOM spec a closed root's `.shadowRoot` reads
 * `null` from any caller without the exact reference `attachShadow()` returned, which is exactly how
 * `record()`'s own DOM walk reaches into a page. Proved here against the REAL `@rrweb/record`, not the
 * `vi.mock` every other rrweb test uses (`rrweb-masking.test.ts`, `RrwebSessionRecorder.test.ts`) — that
 * mock replaces the module for the whole `bun test` process by resolved path (root `CLAUDE.md`'s
 * cross-file mechanism) and neither test restores it afterward, so importing `@rrweb/record` directly
 * here would silently receive whichever mock last ran. The `?real`-suffixed dynamic import is the same
 * escape hatch `vi-compat.ts`'s `restoreModuleAfterAll` uses to bypass that mock on purpose.
 */
import type { record as RecordFn } from '@rrweb/record';
import { describe, expect, it } from 'bun:test';

describe('rrweb cannot see into the widget-s own closed shadow root', () => {
  it('captures light-DOM content but never a closed shadow root sitting beside it', async () => {
    const { record } = (await import('@rrweb/record?real')) as unknown as { record: typeof RecordFn };

    document.body.innerHTML = '<div id="host-page-content">host page marker</div><div id="widget-host"></div>';
    const widgetHost = document.getElementById('widget-host') as HTMLDivElement;
    const shadow = widgetHost.attachShadow({ mode: 'closed' });
    shadow.innerHTML = '<div>visitor typed: my email is user@example.com</div>';

    const events: unknown[] = [];
    const stop = record({ emit: event => events.push(event) });
    await new Promise(resolve => setTimeout(resolve, 20));
    stop?.();

    const serialized = JSON.stringify(events);
    expect(serialized).toContain('host page marker');
    expect(serialized).not.toContain('visitor typed');
    expect(serialized).not.toContain('user@example.com');
  });
});
