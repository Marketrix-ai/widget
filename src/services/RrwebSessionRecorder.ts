import { record } from '@rrweb/record';
import type { eventWithTime } from '@rrweb/types';

import { sdk } from '../sdk';
import { createLogger } from '../utils/logger';

type RecordOptions = Parameters<typeof record>[0];

const log = createLogger('RrwebSessionRecorder');

const MAX_QUEUE_SIZE = 500;

const FLUSH_SIZE_THRESHOLD = 50_000; // 50 KB

/** Per-POST-body cap; must stay well under the API body-parser limit (5mb). Larger batches split across flushes. */
const MAX_BATCH_BYTES = 500_000; // 500 KB

const FLUSH_INTERVAL_MS = 500;

/** After this many consecutive flush failures, drop events — avoids an infinite retry loop when the server keeps rejecting (413/400). */
const MAX_CONSECUTIVE_FAILURES = 5;

/** Real-time RRWeb recording; batched events POSTed to the API widget-message endpoint. */
export class RrwebSessionRecorder {
  private eventQueue: eventWithTime[] = [];
  private estimatedQueueBytes = 0;
  private sessionId: string;
  private stopRecording: ReturnType<typeof record> | null = null;
  private isRecording = false;
  private chatId: string;
  private applicationId: number;
  private metadataSent = false;
  private startPromise: Promise<void> | null = null;
  private stopRequested = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  private consecutiveFailures = 0;
  private isFlushing = false;

  constructor(chatId: string, applicationId: number) {
    if (!chatId || chatId.trim() === '') {
      throw new Error('chatId is required for RrwebSessionRecorder');
    }
    if (!applicationId || applicationId <= 0) {
      throw new Error('applicationId (mtxApp) is required for RrwebSessionRecorder');
    }
    log.info('Constructor called with chatId:', chatId, 'applicationId:', applicationId);
    this.chatId = chatId;
    this.applicationId = applicationId;
    this.sessionId = chatId;

    log.info('Initialized with sessionId:', this.sessionId);
  }

  private async metadataEmit(): Promise<void> {
    if (this.metadataSent) {
      log.warn('Metadata already sent, skipping');
      return;
    }

    log.info('Sending rrweb/metadata via POST');

    await sdk.widgetMessage({
      chat_id: this.chatId,
      command: {
        type: 'rrweb/metadata' as const,
        rrweb_session_id: this.sessionId,
        chat_id: this.chatId,
        application_id: this.applicationId,
        url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: Date.now(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    });

    this.metadataSent = true;
    log.info('✅ rrweb/metadata sent successfully');
  }

  private bufferEvent(event: eventWithTime): void {
    this.eventQueue.push(event);
    this.estimatedQueueBytes += new Blob([JSON.stringify(event)]).size;

    if (this.eventQueue.length > MAX_QUEUE_SIZE) {
      const droppedCount = this.eventQueue.length - MAX_QUEUE_SIZE;
      const dropped = this.eventQueue.splice(0, droppedCount);
      for (const d of dropped) {
        this.estimatedQueueBytes -= JSON.stringify(d).length;
      }
      log.warn(`⚠️ Event queue exceeded ${MAX_QUEUE_SIZE}, dropped ${droppedCount} oldest events`);
    }

    if (this.estimatedQueueBytes >= FLUSH_SIZE_THRESHOLD) {
      this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  /**
   * POST buffered events (batch capped at MAX_BATCH_BYTES). Transient errors (5xx/network) re-queue
   * up to MAX_CONSECUTIVE_FAILURES; permanent errors (4xx) drop immediately (a retry never succeeds).
   */
  private flush(): void {
    if (this.isFlushing) return;
    this.isFlushing = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.eventQueue.length === 0) {
      this.isFlushing = false;
      return;
    }

    // Take the whole queue if it fits MAX_BATCH_BYTES, else slice up to the cap.
    let batchEvents: eventWithTime[];
    let batchBytes: number;

    if (this.estimatedQueueBytes <= MAX_BATCH_BYTES) {
      batchEvents = this.eventQueue;
      batchBytes = this.estimatedQueueBytes;
      this.eventQueue = [];
      this.estimatedQueueBytes = 0;
    } else {
      batchEvents = [];
      batchBytes = 0;
      while (this.eventQueue.length > 0) {
        const next = this.eventQueue[0];
        if (next === undefined) break;
        const nextSize = JSON.stringify(next).length;
        if (batchBytes + nextSize > MAX_BATCH_BYTES && batchEvents.length > 0) break;
        const shifted = this.eventQueue.shift();
        if (shifted !== undefined) batchEvents.push(shifted);
        batchBytes += nextSize;
        this.estimatedQueueBytes -= nextSize;
      }

      // Remaining events: flush again immediately.
      if (this.eventQueue.length > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          this.flush();
        }, 0);
      }
    }

    log.debug(`Flushing ${batchEvents.length} events (~${batchBytes} bytes)`);

    sdk
      .widgetMessage({
        chat_id: this.chatId,
        command: {
          type: 'rrweb/events' as const,
          rrweb_session_id: this.sessionId,
          events: batchEvents,
        },
      })
      .then(() => {
        this.consecutiveFailures = 0;
      })
      .catch((err: unknown) => {
        const status =
          err != null && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : null;
        const isPermanent = typeof status === 'number' && status >= 400 && status < 500;

        if (isPermanent) {
          // 4xx: drop — retrying the same payload never succeeds.
          log.error(`Dropping ${batchEvents.length} events after permanent ${String(status)} error:`, err);
          this.consecutiveFailures = 0;
          return;
        }

        this.consecutiveFailures++;
        if (this.consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
          log.error(
            `Dropping ${batchEvents.length} events after ${MAX_CONSECUTIVE_FAILURES} consecutive failures:`,
            err,
          );
          this.consecutiveFailures = 0;
          return;
        }

        log.error(
          `Failed to flush events (attempt ${this.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}), re-queuing:`,
          err,
        );

        // Re-queue failed events ahead of newer ones for the next attempt.
        this.eventQueue = batchEvents.concat(this.eventQueue);
        this.estimatedQueueBytes += batchBytes;

        if (this.eventQueue.length > MAX_QUEUE_SIZE) {
          const excess = this.eventQueue.length - MAX_QUEUE_SIZE;
          const dropped = this.eventQueue.splice(0, excess);
          for (const d of dropped) {
            this.estimatedQueueBytes -= JSON.stringify(d).length;
          }
          log.warn(`⚠️ Event queue exceeded ${MAX_QUEUE_SIZE} after re-queue, dropped ${excess} oldest events`);
        }
      })
      .finally(() => {
        this.isFlushing = false;
      });
  }

  /** Concurrent-call safe — returns the in-flight startPromise. */
  async start(): Promise<void> {
    if (this.isRecording) {
      log.warn('Recording already started');
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.doStart();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  /** Rechecks stopRequested at each async boundary so a mid-startup stop aborts cleanly. */
  private async doStart(): Promise<void> {
    this.stopRequested = false;

    try {
      log.info('🚀 start() called');

      await this.metadataEmit();
      if (this.stopRequested) throw new Error('Recording stopped during startup');

      const recordOptions: RecordOptions = {
        emit: (event: unknown) => {
          this.bufferEvent(event as eventWithTime);
        },
        recordCanvas: false,
        recordCrossOriginIframes: false,
        maskAllInputs: false,
        collectFonts: false,
        inlineStylesheet: true,
        blockClass: 'rr-block',
        ignoreClass: 'rr-ignore',
      };

      this.stopRecording = record(recordOptions);
      this.isRecording = true;

      log.info('Recording started with chatId:', this.sessionId);
    } catch (error) {
      log.error('Failed to start recording:', error);
      throw error;
    }
  }

  stop(): void {
    this.stopRequested = true;

    if (this.stopRecording) {
      this.stopRecording();
      this.stopRecording = null;
    }

    if (this.isRecording || this.eventQueue.length > 0) {
      this.flush();
    }

    this.isRecording = false;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.metadataSent = false;

    log.info('Recording stopped');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isActive(): boolean {
    return this.isRecording;
  }
}
