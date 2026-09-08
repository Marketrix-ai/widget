/**
 * Per-chat rrweb session recorder: captures the host page as an rrweb event stream and ships it to the api as
 * one `rrweb/metadata` command followed by `rrweb/events` batches, all correlated by the client-minted
 * `rrweb_session_id` (the user-facing "Session"). `index.tsx` constructs one only when `widget_recording` is
 * enabled, so this file is the whole recording feature.
 *
 * `start()` first awaits `StreamClient.ready(chatId)` — the api accepts commands only into a chat its stream
 * has registered — then posts the metadata (url, user agent and viewport, captured once for playback fidelity)
 * and finally arms rrweb, whose `emit` appends to `events` and arms a 500ms coalescing timer. `stopped` is
 * re-checked after every await so a `stop()` racing an in-flight start never arms rrweb against a chat nobody
 * is listening to any more; a recorder is single-use, since `start()` is a no-op once recording or once
 * stopped. `stop()` tears down rrweb and the timer and drains whatever is buffered. `flush()` posts one batch
 * and chains onto `flushPromise` so batches reach the api in emit order and never overlap.
 *
 * The privacy classes are REGEXPs, not plain strings: a bare 'mtx-*' would REPLACE rrweb's rr-* defaults and
 * un-block elements a customer blocks with .rr-block.
 *
 * A rejected flush is degraded-but-handled rather than swallowed — logged, then the batch is requeued at the
 * FRONT and the overflow trimmed off the TAIL, because the head carries the Meta and FullSnapshot every later
 * incremental event replays against and dropping it would leave an unplayable recording; the next timer retries.
 */
import { record } from '@rrweb/record';
import type { eventWithTime } from '@rrweb/types';

import { sdk } from '../sdk';
import { StreamClient } from './StreamClient';

const FLUSH_INTERVAL_MS = 500;
const MAX_REQUEUED_EVENTS = 20_000;

export class RrwebSessionRecorder {
  private events: eventWithTime[] = [];
  private readonly sessionId = globalThis.crypto.randomUUID();
  private stopRecording: ReturnType<typeof record> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise = Promise.resolve();
  private stopped = false;

  constructor(
    private readonly chatId: string,
    private readonly applicationId: number,
  ) {}

  async start(): Promise<void> {
    if (this.stopRecording || this.stopped) return;
    await StreamClient.getInstance().ready(this.chatId);
    if (this.stopped) return;
    await sdk.widgetMessagePost({
      chat_id: this.chatId,
      command: {
        type: 'rrweb/metadata',
        rrweb_session_id: this.sessionId,
        chat_id: this.chatId,
        application_id: this.applicationId,
        url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: Date.now(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
    });
    if (this.stopped) return;
    this.stopRecording = record({
      emit: event => {
        this.events.push(event as eventWithTime);
        if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
      },
      maskAllInputs: true,
      maskTextClass: /^(rr-mask|mtx-mask)$/,
      blockClass: /^(rr-block|mtx-block)$/,
    });
  }

  stop(): void {
    this.stopped = true;
    this.stopRecording?.();
    this.stopRecording = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    void this.flush();
  }

  private flush(): Promise<void> {
    this.flushPromise = this.flushPromise.then(async () => {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = null;
      const events = this.events.splice(0);
      if (!events.length) return;
      try {
        await sdk.widgetMessagePost({
          chat_id: this.chatId,
          command: { type: 'rrweb/events', rrweb_session_id: this.sessionId, events },
        });
      } catch (error) {
        this.events = events.concat(this.events).slice(0, MAX_REQUEUED_EVENTS);
        console.error('Failed to record session events:', error);
      }
    });
    return this.flushPromise;
  }
}
