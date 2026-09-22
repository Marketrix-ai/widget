/**
 * Per-chat rrweb session recorder: captures the host page as an rrweb event stream and ships it to the
 * api as one `rrweb/metadata` command followed by `rrweb/events` batches. `index.tsx` constructs one
 * only when `widget_recording` is enabled, so this file is the whole recording feature.
 *
 * `start()` waits for the chat's stream to register (the api only accepts commands into a registered
 * chat) before posting metadata and arming rrweb; `stop()` tears rrweb down and drains what's buffered;
 * `flush()` posts one batch at a time, in order. A flush that fails is logged and requeued at the front
 * rather than dropped, since a later batch replays against the first one's snapshot.
 */
import { record } from '@rrweb/record';

import { type RrwebEvent, RrwebEventSchema } from '../sdk/contracts/common';
import { logWarn } from '../utils/log';
import { streamClient } from './StreamClient';

const FLUSH_INTERVAL_MS = 500;
const MAX_REQUEUED_EVENTS = 20_000;

export class RrwebSessionRecorder {
  private events: RrwebEvent[] = [];
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
    await streamClient.ready(this.chatId);
    if (this.stopped) return;
    await streamClient.send(
      {
        type: 'rrweb/metadata',
        rrweb_session_id: this.sessionId,
        chat_id: this.chatId,
        application_id: this.applicationId,
        url: window.location.href,
        timestamp: Date.now(),
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
      this.chatId,
    );
    if (this.stopped) return;
    this.stopRecording = record({
      emit: event => {
        this.events.push(RrwebEventSchema.parse(event));
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
        await streamClient.send({ type: 'rrweb/events', rrweb_session_id: this.sessionId, events }, this.chatId);
      } catch (error) {
        this.events = events.concat(this.events).slice(0, MAX_REQUEUED_EVENTS);
        logWarn('[RrwebSessionRecorder] Failed to record session events, requeued for retry:', error);
        if (!this.stopped) this.flushTimer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
      }
    });
    return this.flushPromise;
  }
}
