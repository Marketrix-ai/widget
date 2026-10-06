/**
 * Per-chat rrweb session recorder: captures the host page as rrweb events and ships them to the api as one
 * `rrweb/metadata` command followed by `rrweb/events` batches; `mount.tsx` builds one only when `widget_recording`
 * is on. `start()` follows the stream's state, `stop()` tears rrweb down and drains the buffer. Nothing is posted
 * while the chat is not registered, and each newly registered chat gets a fresh session starting from a full
 * snapshot. A failed session open or batch is retried on a doubling delay; a failed batch goes back to the front of
 * the queue, since later batches replay against its snapshot, and the buffer is capped so an unflushable recording
 * truncates instead of growing. `emit` runs on the host page inside rrweb, so an event outside the wire schema is
 * dropped, never thrown.
 */
import { record } from '@rrweb/record';

import { type RrwebEvent, RrwebEventSchema } from '../sdk/contracts/rrweb';
import { logWarn } from '../utils/log';
import { randomId } from '../utils/randomId';
import { streamClient, type StreamState } from './StreamClient';

const FLUSH_INTERVAL_MS = 500;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_BUFFERED_EVENTS = 20_000;

export class RrwebSessionRecorder {
  private events: RrwebEvent[] = [];
  private session: { chatId: string; id: string } | null = null;
  private stopRecording: ReturnType<typeof record> | null = null;
  private unsubscribe: (() => void) | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private queue = Promise.resolve();
  private stopped = false;
  private failedPosts = 0;
  private warnedMalformed = false;

  start(): void {
    if (this.unsubscribe || this.stopped) return;
    this.unsubscribe = streamClient.subscribe(this.follow);
    this.follow(streamClient.getState());
  }

  stop(): Promise<void> {
    this.stopped = true;
    this.unsubscribe?.();
    this.stopRecording?.();
    this.stopRecording = null;
    return this.flush();
  }

  private readonly follow = (state: StreamState): void => {
    if (state.phase === 'registered') void this.flush();
  };

  private flush(): Promise<void> {
    this.queue = this.queue.then(async () => {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
      const state = streamClient.getState();
      if (!this.stopped) {
        if (state.phase !== 'registered') return;
        if (this.session?.chatId !== state.chatId && !(await this.openSession(state.chatId))) return;
      }
      await this.post();
    });
    return this.queue;
  }

  private async openSession(chatId: string): Promise<boolean> {
    if (this.session) {
      await this.post();
      this.events = [];
    }
    const id = randomId();
    try {
      await streamClient.send(
        {
          type: 'rrweb/metadata',
          rrweb_session_id: id,
          url: window.location.href,
          timestamp: Date.now(),
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
        { chatId },
      );
    } catch (error) {
      logWarn('[RrwebSessionRecorder] Failed to open the recording session, retrying:', error);
      this.scheduleFlush(this.retryDelay());
      return false;
    }
    this.failedPosts = 0;
    if (this.stopped) return false;
    this.session = { chatId, id };
    if (this.stopRecording) record.takeFullSnapshot();
    else
      this.stopRecording = record({
        emit: this.emit,
        maskAllInputs: true,
        maskTextClass: /^(rr-mask|mtx-mask)$/,
        blockClass: /^(rr-block|mtx-block)$/,
      });
    return true;
  }

  private readonly emit = (event: unknown): void => {
    const parsed = RrwebEventSchema.safeParse(event);
    if (!parsed.success) {
      if (!this.warnedMalformed)
        logWarn('[RrwebSessionRecorder] Dropping an event outside the wire schema:', parsed.error);
      this.warnedMalformed = true;
      return;
    }
    if (this.events.length >= MAX_BUFFERED_EVENTS) return;
    this.events.push(parsed.data);
    if (!this.flushTimer) this.scheduleFlush(FLUSH_INTERVAL_MS);
  };

  private async post(): Promise<void> {
    if (!this.session || !this.events.length) return;
    const events = this.events.splice(0);
    try {
      await streamClient.send(
        { type: 'rrweb/events', rrweb_session_id: this.session.id, events },
        { chatId: this.session.chatId },
      );
      this.failedPosts = 0;
    } catch (error) {
      this.events = events.concat(this.events).slice(0, MAX_BUFFERED_EVENTS);
      logWarn('[RrwebSessionRecorder] Failed to record session events, requeued for retry:', error);
      if (!this.stopped) this.scheduleFlush(this.retryDelay());
    }
  }

  private retryDelay(): number {
    return Math.min(FLUSH_INTERVAL_MS * 2 ** this.failedPosts++, MAX_RETRY_DELAY_MS);
  }

  private scheduleFlush(delayMs: number): void {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), delayMs);
  }
}
