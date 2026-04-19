import { record } from '@rrweb/record';
import type { eventWithTime } from '@rrweb/types';

import { sdk } from '../sdk';
import { createLogger } from '../utils/common';

type RecordOptions = Parameters<typeof record>[0];

const log = createLogger('SessionRecorder');

/** Max events to buffer in memory */
const MAX_QUEUE_SIZE = 500;

/** Flush when estimated serialized size reaches this threshold (bytes) */
const FLUSH_SIZE_THRESHOLD = 50_000; // 50 KB

/**
 * Hard cap on the serialized byte size of a single POST body.
 * Must stay well under the API body-parser limit (currently 5mb).
 * Batches exceeding this are split across multiple flushes.
 */
const MAX_BATCH_BYTES = 500_000; // 500 KB

/** Flush at most every this many ms */
const FLUSH_INTERVAL_MS = 500;

/**
 * Maximum consecutive flush failures before the recorder gives up retrying
 * and starts dropping events.  This prevents an infinite loop when the server
 * consistently rejects the payload (e.g. 413 or 400).
 */
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * SessionRecorder manages real-time RRWeb session recording,
 * sending batched events to the API via HTTP POST (widget message endpoint).
 */
export class SessionRecorder {
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
      throw new Error('chatId is required for SessionRecorder');
    }
    if (!applicationId || applicationId <= 0) {
      throw new Error('applicationId (mtxApp) is required for SessionRecorder');
    }
    log.info('Constructor called with chatId:', chatId, 'applicationId:', applicationId);
    this.chatId = chatId;
    this.applicationId = applicationId;
    this.sessionId = chatId;

    log.info('Initialized with sessionId:', this.sessionId);
  }

  /**
   * Send rrweb/metadata command via POST
   */
  private async sendMetadata(): Promise<void> {
    if (this.metadataSent) {
      log.warn('Metadata already sent, skipping');
      return;
    }

    log.info('Sending rrweb/metadata via POST');

    await sdk.widgetMessage({
      chat_id: this.chatId,
      command: {
        type: 'rrweb/metadata' as const,
        session_id: this.sessionId,
        chat_id: this.chatId,
        application_id: this.applicationId,
        url: window.location.href,
        user_agent: navigator.userAgent,
        timestamp: Date.now(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio,
        },
      },
    });

    this.metadataSent = true;
    log.info('✅ rrweb/metadata sent successfully');
  }

  /**
   * Buffer an event and trigger flush if thresholds are met
   */
  private bufferEvent(event: eventWithTime): void {
    this.eventQueue.push(event);
    this.estimatedQueueBytes += new Blob([JSON.stringify(event)]).size;

    // Enforce max queue size
    if (this.eventQueue.length > MAX_QUEUE_SIZE) {
      const droppedCount = this.eventQueue.length - MAX_QUEUE_SIZE;
      const dropped = this.eventQueue.splice(0, droppedCount);
      // Recalculate estimated size (approximate — subtract average per event)
      for (const d of dropped) {
        this.estimatedQueueBytes -= JSON.stringify(d).length;
      }
      log.warn(`⚠️ Event queue exceeded ${MAX_QUEUE_SIZE}, dropped ${droppedCount} oldest events`);
    }

    // Flush immediately if size threshold exceeded
    if (this.estimatedQueueBytes >= FLUSH_SIZE_THRESHOLD) {
      this.flush();
      return;
    }

    // Otherwise ensure a flush timer is running
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Flush buffered events via POST.
   *
   * Batches are capped at MAX_BATCH_BYTES to stay within the API body-parser limit.
   * On transient server errors (5xx / network) the batch is re-queued up to
   * MAX_CONSECUTIVE_FAILURES times before being dropped.
   * On permanent client errors (4xx) the batch is dropped immediately — re-sending
   * would never succeed and would create an infinite retry loop.
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

    // Build a batch that fits within MAX_BATCH_BYTES.
    // If the whole queue fits, take it all; otherwise slice until we hit the cap.
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

      // If there are still events remaining, schedule the next flush immediately.
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
          session_id: this.sessionId,
          events: batchEvents,
        },
      })
      .then(() => {
        this.consecutiveFailures = 0;
      })
      .catch((err: unknown) => {
        // Determine whether this is a permanent client error (4xx) or a transient one.
        const status =
          err != null && typeof err === 'object' && 'status' in err ? (err as { status: unknown }).status : null;
        const isPermanent = typeof status === 'number' && status >= 400 && status < 500;

        if (isPermanent) {
          // 4xx: drop the batch — retrying the same payload will never succeed.
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

        // Prepend failed events back to the buffer for the next flush attempt.
        this.eventQueue = batchEvents.concat(this.eventQueue);
        this.estimatedQueueBytes += batchBytes;

        // Enforce max queue size after re-queuing.
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

  /**
   * Start recording session.
   * Safe against concurrent calls (returns existing startPromise).
   */
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

  /**
   * Internal start implementation. Checks stopRequested at each async boundary.
   */
  private async doStart(): Promise<void> {
    this.stopRequested = false;

    try {
      log.info('🚀 start() called');

      // Send metadata first
      await this.sendMetadata();
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

  /**
   * Stop recording session. Flushes remaining events before stopping.
   */
  stop(): void {
    this.stopRequested = true;

    if (this.stopRecording) {
      this.stopRecording();
      this.stopRecording = null;
    }

    // Flush remaining events before stopping
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

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if recording is active
   */
  isActive(): boolean {
    return this.isRecording;
  }
}
