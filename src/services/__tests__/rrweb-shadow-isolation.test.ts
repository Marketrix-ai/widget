/**
 * Proves session recording can never capture the widget's own UI: the real `@rrweb/record` sees
 * light-DOM content but nothing inside the widget's closed shadow root.
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
