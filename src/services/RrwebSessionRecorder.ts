import { record } from '@rrweb/record';
import type { eventWithTime } from '@rrweb/types';

import { sdk } from '../sdk';

const FLUSH_INTERVAL_MS = 500;

export class RrwebSessionRecorder {
  private events: eventWithTime[] = [];
  private readonly sessionId = globalThis.crypto.randomUUID();
  private stopRecording: ReturnType<typeof record> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise = Promise.resolve();

  constructor(
    private readonly chatId: string,
    private readonly applicationId: number,
  ) {}

  async start(): Promise<void> {
    if (this.stopRecording) return;
    await sdk.widgetMessage({
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
    this.stopRecording = record({
      emit: event => this.buffer(event as eventWithTime),
      maskAllInputs: true,
      // Regex, not a plain string: a bare 'mtx-*' would REPLACE rrweb's rr-* defaults and silently
      // un-block elements a customer already blocks with .rr-block.
      maskTextClass: /^(rr-mask|mtx-mask)$/,
      blockClass: /^(rr-block|mtx-block)$/,
    });
  }

  stop(): void {
    this.stopRecording?.();
    this.stopRecording = null;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    void this.flush();
  }

  private buffer(event: eventWithTime): void {
    this.events.push(event);
    if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  private flush(): Promise<void> {
    this.flushPromise = this.flushPromise.then(async () => {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = null;
      const events = this.events.splice(0);
      if (!events.length) return;
      try {
        await sdk.widgetMessage({
          chat_id: this.chatId,
          command: { type: 'rrweb/events', rrweb_session_id: this.sessionId, events },
        });
      } catch (error) {
        this.events.unshift(...events);
        console.error('Failed to record session events:', error);
      }
    });
    return this.flushPromise;
  }
}
