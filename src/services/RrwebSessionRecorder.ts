/**
 * Per-chat rrweb session recorder: captures the host page as an rrweb event stream and ships it to the
 * api as one `rrweb/metadata` command followed by `rrweb/events` batches. `mount.tsx` constructs one
 * only when `widget_recording` is enabled, so this file is the whole recording feature.
 *
 * `start()` waits for the chat's stream to register (the api only accepts commands into a registered
 * chat) before posting metadata and arming rrweb, and a cleared chat's new thread gets a fresh recording
 * session starting from a full snapshot; `stop()` tears rrweb down and drains what's buffered;
 * `flush()` posts one batch at a time, in order. A flush that fails is logged and requeued at the front
 * rather than dropped, since a later batch replays against the first one's snapshot, and retried on a doubling
 * delay; once the stream gives up, retries wait for it to register again rather than polling a dead api. The
 * buffer is capped, keeping the oldest events, so a recording that cannot flush truncates instead of growing.
 */
import { record } from '@rrweb/record';

import type { WidgetEvent } from '../sdk';
import { type RrwebEvent, RrwebEventSchema } from '../sdk/contracts/rrweb';
import { logWarn } from '../utils/log';
import { randomId } from '../utils/randomId';
import { streamClient, StreamGaveUpError } from './StreamClient';

const FLUSH_INTERVAL_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_BUFFERED_EVENTS = 20_000;

export class RrwebSessionRecorder {
  private events: RrwebEvent[] = [];
  private sessionId = randomId();
  private stopRecording: ReturnType<typeof record> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise = Promise.resolve();
  private stopped = false;
  private failedFlushes = 0;
  private streamGaveUp = false;

  constructor(
    private chatId: string,
    private readonly applicationId: number,
  ) {}

  async start(): Promise<void> {
    if (this.stopRecording || this.stopped) return;
    await this.openSession();
    if (this.stopped) return;
    streamClient.addCallbacks(this.callbacks);
    this.stopRecording = record({
      emit: event => {
        const parsed = RrwebEventSchema.parse(event);
        if (this.events.length >= MAX_BUFFERED_EVENTS) return;
        this.events.push(parsed);
        if (!this.flushTimer && !this.streamGaveUp) this.scheduleFlush(FLUSH_INTERVAL_MS);
      },
      maskAllInputs: true,
      maskTextClass: /^(rr-mask|mtx-mask)$/,
      blockClass: /^(rr-block|mtx-block)$/,
    });
  }

  private readonly callbacks = {
    onMessage: (event: WidgetEvent) => {
      if (event.type !== 'registered' || this.stopped) return;
      if (event.chat_id === this.chatId) {
        if (this.streamGaveUp) {
          this.streamGaveUp = false;
          void this.flush();
        }
        return;
      }
      this.followChat(event.chat_id).catch((error: unknown) => {
        console.error('[RrwebSessionRecorder] Failed to move the recording to the new chat:', error);
      });
    },
    onError: (error: Error) => {
      if (!(error instanceof StreamGaveUpError)) return;
      this.streamGaveUp = true;
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = null;
    },
  };

  private async followChat(chatId: string): Promise<void> {
    await this.flush();
    this.events = [];
    this.streamGaveUp = false;
    this.failedFlushes = 0;
    this.chatId = chatId;
    this.sessionId = randomId();
    await this.openSession();
    if (!this.stopped) record.takeFullSnapshot();
  }

  private async openSession(): Promise<void> {
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
  }

  stop(): void {
    this.stopped = true;
    streamClient.removeCallbacks(this.callbacks);
    this.stopRecording?.();
    this.stopRecording = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    void this.flush();
  }

  private scheduleFlush(delayMs: number): void {
    this.flushTimer = setTimeout(() => void this.flush(), delayMs);
  }

  private flush(): Promise<void> {
    this.flushPromise = this.flushPromise.then(async () => {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = null;
      const events = this.events.splice(0);
      if (!events.length) return;
      try {
        await streamClient.send({ type: 'rrweb/events', rrweb_session_id: this.sessionId, events }, this.chatId);
        this.failedFlushes = 0;
      } catch (error) {
        this.events = events.concat(this.events).slice(0, MAX_BUFFERED_EVENTS);
        logWarn('[RrwebSessionRecorder] Failed to record session events, requeued for retry:', error);
        if (this.stopped || this.streamGaveUp) return;
        this.scheduleFlush(Math.min(FLUSH_INTERVAL_MS * 2 ** this.failedFlushes++, MAX_RETRY_DELAY_MS));
      }
    });
    return this.flushPromise;
  }
}
