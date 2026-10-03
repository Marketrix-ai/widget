/**
 * Proves session recording can never capture the widget's own UI: the real `@rrweb/record` sees
 * light-DOM content but nothing inside the widget's closed shadow root.
 */
import { record } from '@rrweb/record';
import type { eventWithTime } from '@rrweb/types';
import { describe, expect, it } from 'bun:test';

describe('rrweb cannot see into the widget-s own closed shadow root', () => {
  it('captures light-DOM content but never a closed shadow root sitting beside it', async () => {
    document.body.innerHTML = '<div id="host-page-content">host page marker</div><div id="widget-host"></div>';
    const widgetHost = document.getElementById('widget-host');
    if (!(widgetHost instanceof HTMLDivElement)) throw new Error('expected the widget host div');
    const shadow = widgetHost.attachShadow({ mode: 'closed' });
    shadow.innerHTML = '<div>visitor typed: my email is user@example.com</div>';

    const events: eventWithTime[] = [];
    const stop = record<eventWithTime>({ emit: event => events.push(event) });
    await new Promise(resolve => setTimeout(resolve, 20));
    stop?.();

    const serialized = JSON.stringify(events);
    expect(serialized).toContain('host page marker');
    expect(serialized).not.toContain('visitor typed');
    expect(serialized).not.toContain('user@example.com');
  });
});
