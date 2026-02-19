import { record } from '@rrweb/record';
import type { eventWithTime } from '@rrweb/types';

import { createLogger } from '../utils/common';
import { storageService } from './StorageService';

type RecordOptions = Parameters<typeof record>[0];

const log = createLogger('SessionRecorder');

/**
 * Metadata object sent before the first event
 */
interface SessionMetadata {
  type: 'session_metadata';
  sessionId: string;
  marketrixChatId: string; // Required - chat session ID
  connectionId: number; // Required - maps to mtxApp (connection_id)
  timestamp: number;
  userAgent: string;
  url: string;
}

/**
 * Server message types
 */
interface ServerMessage {
  type: string;
  sessionId?: string;
  timestamp?: number;
}

/**
 * SessionRecorder manages real-time RRWeb session recording with WebSocket streaming
 */
export class SessionRecorder {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventQueue: eventWithTime[] = [];
  private readonly MAX_QUEUE_SIZE = 500; // Prevent unbounded memory growth
  private sessionId: string;
  private stopRecording: ReturnType<typeof record> | null = null;
  private isRecording = false;
  private wsUrl: string;
  private connectionId: number; // Required - maps to mtxApp
  private metadataSent = false;
  private metadataAcknowledged = false;
  private metadataSendPromise: Promise<void> | null = null;
  private metadataAckResolver: ((value: void | PromiseLike<void>) => void) | null = null;
  private startPromise: Promise<void> | null = null;
  private stopRequested = false;

  private readonly TAB_ID_STORAGE_KEY = 'marketrix_tab_id';

  constructor(wsUrl: string, connectionId: number) {
    if (!wsUrl || wsUrl.trim() === '') {
      throw new Error('WebSocket URL is required for SessionRecorder');
    }
    if (!connectionId || connectionId <= 0) {
      throw new Error('connectionId (mtxApp) is required for SessionRecorder');
    }
    log.info('Constructor called with wsUrl:', wsUrl, 'connectionId:', connectionId);
    this.wsUrl = wsUrl;
    this.connectionId = connectionId;
    this.sessionId = this.getTabId();

    // Validate that sessionId is in the correct format (tab_* not UUID)
    if (!this.sessionId.startsWith('tab_')) {
      const error = `Invalid sessionId format. Expected tab_* format, got: ${this.sessionId}. This suggests SessionManager may not have initialized correctly.`;
      log.error('❌', error);
      log.error('sessionStorage contents:', {
        tabId: sessionStorage.getItem(this.TAB_ID_STORAGE_KEY),
        allKeys: Object.keys(sessionStorage),
      });
      throw new Error(error);
    }

    log.info('Initialized with sessionId:', this.sessionId);
  }

  /**
   * Get marketrix_tab_id from sessionStorage (string, not UUID)
   * Must be in format: tab_${timestamp}_${random}
   */
  private getTabId(): string {
    if (typeof window === 'undefined') {
      throw new Error('marketrix_tab_id not available in non-browser environment');
    }

    const tabId = sessionStorage.getItem(this.TAB_ID_STORAGE_KEY);

    if (!tabId) {
      const error = 'marketrix_tab_id not found in sessionStorage. SessionManager should initialize it first.';
      log.error('❌', error);
      log.error('sessionStorage keys:', Object.keys(sessionStorage));
      log.error(
        'sessionStorage values:',
        Object.keys(sessionStorage).reduce(
          (acc, key) => {
            acc[key] = sessionStorage.getItem(key);
            return acc;
          },
          {} as Record<string, string | null>,
        ),
      );
      throw new Error(error);
    }

    // Validate format - must start with 'tab_'
    // If it's a UUID (contains dashes and is 36 chars), it's from an old version
    if (!tabId.startsWith('tab_')) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tabId);
      const error = `Invalid tab_id format in sessionStorage. Expected 'tab_*' format, got: ${tabId}. ${isUUID ? 'This appears to be a UUID from an old version.' : 'Please clear sessionStorage and reload.'}`;
      log.error('❌', error);
      log.error('sessionStorage tab_id value:', tabId);
      log.error('All sessionStorage keys:', Object.keys(sessionStorage));
      // Clear the invalid value so SessionManager can create a new one
      sessionStorage.removeItem(this.TAB_ID_STORAGE_KEY);
      log.warn('⚠️ Cleared invalid tab_id from sessionStorage. SessionManager will create a new one.');
      throw new Error(error);
    }

    log.info('✅ Loaded marketrix_tab_id from sessionStorage:', tabId);
    return tabId;
  }

  /**
   * Get chat_id from StorageService
   */
  private getMarketrixChatId(): string | undefined {
    const chatId = storageService.getChatId();
    if (!chatId || chatId.trim() === '') {
      log.debug('chat_id not available in storage');
      return undefined;
    }
    log.debug('Retrieved chat_id from storage:', `${chatId.substring(0, 30)}...`);
    return chatId;
  }

  /**
   * Get chat_id or throw. Called only after external code has confirmed chat_id exists.
   */
  private requireChatId(): string {
    const chatId = this.getMarketrixChatId();
    if (!chatId) {
      throw new Error('chat_id not available in storage — start() should only be called after chat_id is set');
    }
    return chatId;
  }

  /**
   * Connect to WebSocket server with exponential backoff reconnection
   */
  private connect(): Promise<void> {
    log.info('connect() called, wsUrl:', this.wsUrl);
    return new Promise((resolve, reject) => {
      try {
        log.info('Creating WebSocket connection to:', this.wsUrl);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          log.info('✅ WebSocket connection opened');
          log.debug('WebSocket readyState:', this.ws?.readyState, '(OPEN=1)');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          // Reset acknowledgment flag
          this.metadataAcknowledged = false;

          // Double-check we have required IDs (should already be checked in start())
          log.debug('🔍 Verifying required IDs before sending metadata in onopen...');
          log.debug('Current time:', new Date().toISOString());
          const chatId = this.getMarketrixChatId();
          const sessionId = this.sessionId;

          log.debug('📊 ID verification results in onopen:', {
            hasChatId: !!chatId && chatId.trim() !== '',
            chatIdValue: chatId,
            chatIdType: typeof chatId,
            chatIdLength: chatId ? chatId.length : 0,
            chatIdPreview: chatId ? `${chatId.substring(0, 20)}...` : 'null/undefined',
            chatIdTruthy: !!chatId,
            hasSessionId: !!sessionId && sessionId.trim() !== '',
            sessionIdValue: sessionId,
            sessionIdType: typeof sessionId,
            sessionIdPreview: sessionId ? `${sessionId.substring(0, 20)}...` : 'null/undefined',
          });

          if (!chatId || chatId.trim() === '') {
            const error = 'Cannot send metadata: marketrix_chat_id not found in localStorage';
            log.error('❌', error);
            log.error('Available localStorage keys:', Object.keys(localStorage));
            log.error('This should not happen - waitForChatId() should have ensured chat_id exists');
            reject(new Error(error));
            this.ws?.close();
            return;
          }

          if (!sessionId || sessionId.trim() === '') {
            const error = 'Cannot send metadata: marketrix_tab_id not found in sessionStorage';
            log.error('❌', error);
            reject(new Error(error));
            this.ws?.close();
            return;
          }

          log.info('✅ Verified chat_id before sending metadata:', {
            chatId: `${chatId.substring(0, 20)}...`,
            sessionId: `${sessionId.substring(0, 20)}...`,
          });

          // Send metadata immediately after connection is established
          // Create a promise that resolves when metadata is sent
          log.debug('Calling sendMetadataAsync()...');
          this.metadataSendPromise = this.sendMetadataAsync();
          this.metadataSendPromise
            .then(() => {
              log.info('✅ Metadata sent successfully in onopen');
              // Wait for server acknowledgment before flushing events
              // The acknowledgment will be handled in onmessage
            })
            .catch(error => {
              log.error('❌ Failed to send metadata in onopen:', error);
              // Close connection if metadata fails to send
              if (this.ws) {
                this.ws.close();
              }
              reject(error);
            });
          resolve();
        };

        this.ws.onerror = error => {
          log.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          log.info('WebSocket closed');
          this.ws = null;

          // Attempt reconnection if we haven't exceeded max attempts
          if (this.reconnectAttempts < this.maxReconnectAttempts && this.isRecording) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            log.error('Max reconnection attempts reached. Stopping reconnection.');
          }
        };

        this.ws.onmessage = event => {
          const dataLength = typeof event.data === 'string' ? event.data.length : 0;
          log.debug('📨 Message received from server, length:', dataLength);
          try {
            const data = JSON.parse(event.data) as ServerMessage;
            log.debug('Parsed message from server:', {
              type: data.type,
              hasSessionId: !!data.sessionId,
              keys: Object.keys(data),
            });

            // Handle metadata acknowledgment from server
            if (data.type === 'metadata_ack') {
              log.info('✅ Metadata acknowledged by server:', {
                sessionId: data.sessionId,
                timestamp: data.timestamp,
                currentTime: Date.now(),
              });
              this.metadataAcknowledged = true;
              // Resolve the acknowledgment promise if it exists
              if (this.metadataAckResolver) {
                log.debug('Resolving metadata acknowledgment promise');
                this.metadataAckResolver();
                this.metadataAckResolver = null;
              }
              // Now flush any queued events
              log.debug('Flushing event queue (size:', this.eventQueue.length, ')');
              this.flushEventQueue();
              return;
            }

            // Handle other messages from server if needed
            log.debug('📨 Other message from server:', data);
          } catch (error) {
            log.error('❌ Error parsing server message:', error);
            log.error('Raw message data:', event.data);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

    log.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      const chatId = this.getMarketrixChatId();
      if (!chatId || chatId.trim() === '') {
        log.warn('⚠️ chat_id not available on reconnect, skipping');
        return;
      }
      this.connect().catch(error => {
        log.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Send event over WebSocket or queue if connection is not ready
   */
  private sendEvent(event: eventWithTime): void {
    // Don't send events until metadata is sent AND acknowledged
    if (!this.metadataSent || !this.metadataAcknowledged) {
      log.debug('⏸️ Event received before metadata acknowledged, queuing event:', {
        eventType: event.type,
        timestamp: event.timestamp,
        metadataSent: this.metadataSent,
        metadataAcknowledged: this.metadataAcknowledged,
        queueSize: this.eventQueue.length + 1,
      });
      this.pushToQueue(event);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        const eventJson = JSON.stringify(event);
        this.ws.send(eventJson);
        // Log first few events, then reduce logging
        if (this.eventQueue.length < 5) {
          log.debug('📤 Event sent:', {
            type: event.type,
            timestamp: event.timestamp,
            size: eventJson.length,
          });
        }
      } catch (error) {
        log.error('❌ Error sending event:', error);
        this.pushToQueue(event);
      }
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      // Queue event if connection is still establishing
      log.debug('⏸️ WebSocket still connecting, queuing event');
      this.pushToQueue(event);
    } else {
      // Connection is closed or not available, queue the event
      log.debug('⏸️ WebSocket not open, queuing event. State:', this.ws?.readyState);
      this.pushToQueue(event);
    }
  }

  /**
   * Push event to queue with size limit to prevent memory leaks
   */
  private pushToQueue(event: eventWithTime): void {
    this.eventQueue.push(event);
    
    // Prevent unbounded queue growth
    if (this.eventQueue.length > this.MAX_QUEUE_SIZE) {
      const droppedCount = this.eventQueue.length - this.MAX_QUEUE_SIZE;
      this.eventQueue = this.eventQueue.slice(-this.MAX_QUEUE_SIZE);
      log.warn(`⚠️ Event queue exceeded ${this.MAX_QUEUE_SIZE}, dropped ${droppedCount} oldest events`);
    }
  }

  /**
   * Send session metadata before the first event (async version)
   */
  private async sendMetadataAsync(): Promise<void> {
    log.info('sendMetadataAsync() called');
    log.debug('WebSocket state:', {
      exists: !!this.ws,
      readyState: this.ws?.readyState,
      isOpen: this.ws?.readyState === WebSocket.OPEN,
    });

    if (this.ws?.readyState !== WebSocket.OPEN) {
      const error = 'Cannot send metadata: WebSocket not open';
      log.error('❌', error);
      throw new Error(error);
    }

    // Don't send metadata twice
    if (this.metadataSent) {
      log.warn('⚠️ Metadata already sent, skipping');
      return;
    }

    // Get chat_id - should already be available since we waited for it in start()
    const marketrixChatId = this.getMarketrixChatId();

    if (!marketrixChatId) {
      const error = 'chat_id is required but not found in storage';
      log.error(error);
      throw new Error(error);
    }

    log.debug('Got chat_id for metadata:', `${marketrixChatId.substring(0, 30)}...`);

    if (!this.sessionId || this.sessionId.trim() === '') {
      const error = 'marketrix_tab_id is required but not found or empty in sessionStorage';
      log.error(error);
      throw new Error(error);
    }

    log.info('Preparing to send metadata:', {
      sessionId: this.sessionId,
      marketrixChatId,
      hasChatId: !!marketrixChatId,
      chatIdLength: marketrixChatId.length,
      chatIdPreview: `${marketrixChatId.substring(0, 30)}...`,
    });

    // CRITICAL: Ensure marketrixChatId is a valid string (not undefined/null)
    // JSON.stringify will remove undefined fields, so we must have a valid string
    if (typeof marketrixChatId !== 'string' || marketrixChatId.trim() === '') {
      const error = `CRITICAL: marketrixChatId must be a non-empty string, got: ${typeof marketrixChatId} = ${marketrixChatId}`;
      log.error('❌', error);
      throw new Error(error);
    }

    // CRITICAL: Validate sessionId format before creating metadata
    if (!this.sessionId?.startsWith('tab_')) {
      const error = `CRITICAL: Invalid sessionId format. Expected 'tab_*' format, got: ${this.sessionId}`;
      log.error('❌', error);
      log.error('Current sessionId:', this.sessionId);
      log.error('sessionStorage tab_id:', sessionStorage.getItem(this.TAB_ID_STORAGE_KEY));
      throw new Error(error);
    }

    const metadata: SessionMetadata = {
      type: 'session_metadata',
      sessionId: this.sessionId, // Must be tab_* format, not UUID
      marketrixChatId, // Now guaranteed to be a valid string
      connectionId: this.connectionId, // For tenant/connection lookup
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Verify the metadata object has both required fields
    if (!metadata.sessionId?.startsWith('tab_')) {
      const error = `CRITICAL: sessionId missing or invalid format in metadata object. Expected 'tab_*', got: ${metadata.sessionId}`;
      log.error('❌', error);
      log.error('Metadata object:', metadata);
      throw new Error(error);
    }

    if (!metadata.marketrixChatId || typeof metadata.marketrixChatId !== 'string') {
      const error = 'CRITICAL: marketrixChatId missing or invalid in metadata object after creation';
      log.error('❌', error);
      log.error('Metadata object:', metadata);
      throw new Error(error);
    }

    log.info('📤 Metadata object created:', {
      type: metadata.type,
      sessionId: metadata.sessionId, // Log full sessionId to verify format
      sessionIdFormat: metadata.sessionId.startsWith('tab_') ? '✅ tab_* format' : '❌ Invalid format',
      marketrixChatId: `${metadata.marketrixChatId.substring(0, 30)}...`,
      marketrixChatIdFull: metadata.marketrixChatId, // Log full value for debugging
      timestamp: metadata.timestamp,
      url: metadata.url,
      hasChatId: !!metadata.marketrixChatId,
      chatIdType: typeof metadata.marketrixChatId,
      chatIdLength: metadata.marketrixChatId.length,
    });

    return new Promise((resolve, reject) => {
      try {
        // CRITICAL: Double-check both IDs are still valid before sending
        if (!metadata.sessionId?.startsWith('tab_')) {
          const error = `CRITICAL: sessionId is missing or invalid format. Expected 'tab_*', got: ${metadata.sessionId}`;
          log.error('❌', error);
          log.error('Metadata object:', metadata);
          throw new Error(error);
        }

        if (!metadata.marketrixChatId || metadata.marketrixChatId.trim() === '') {
          const error = 'CRITICAL: marketrixChatId is missing or empty in metadata object - cannot send';
          log.error('❌', error);
          log.error('Metadata object:', metadata);
          throw new Error(error);
        }

        const metadataJson = JSON.stringify(metadata);

        // Log the full metadata object as JSON to verify structure
        log.debug('📤 Full metadata object (JSON):', JSON.stringify(metadata, null, 2));
        log.info('📤 Sending metadata JSON (length:', metadataJson.length, 'bytes)');
        log.debug('Metadata JSON preview:', `${metadataJson.substring(0, 200)}...`);
        log.debug('📋 Full metadata JSON:', metadataJson);

        // CRITICAL: Verify sessionId is in the JSON and in correct format
        const sessionIdMatch = metadataJson.match(/"sessionId"\s*:\s*"([^"]+)"/);
        const extractedSessionId = sessionIdMatch ? sessionIdMatch[1] : 'NOT FOUND';
        const hasCorrectSessionIdFormat = extractedSessionId.startsWith('tab_');

        log.info('✅ Verification - sessionId in JSON:', {
          extractedSessionId,
          originalSessionId: metadata.sessionId,
          matches: extractedSessionId === metadata.sessionId,
          hasCorrectFormat: hasCorrectSessionIdFormat,
        });

        if (!hasCorrectSessionIdFormat) {
          const error = `CRITICAL: sessionId in JSON is not in tab_* format. Got: ${extractedSessionId}`;
          log.error('❌', error);
          log.error('JSON string:', metadataJson);
          log.error('Expected format: tab_*');
          throw new Error(error);
        }

        // Verify chat_id is in the JSON string
        const hasMarketrixChatIdKey = metadataJson.includes('marketrixChatId');
        const hasChatIdValue = metadataJson.includes(metadata.marketrixChatId);
        const chatIdMatch = metadataJson.match(/"marketrixChatId"\s*:\s*"([^"]+)"/);
        const extractedChatId = chatIdMatch ? chatIdMatch[1] : 'NOT FOUND';

        log.info('✅ Verification - chat_id in JSON:', {
          hasMarketrixChatIdKey,
          hasChatIdValue,
          bothPresent: hasMarketrixChatIdKey && hasChatIdValue,
          extractedChatId,
          originalChatId: metadata.marketrixChatId,
          matches: extractedChatId === metadata.marketrixChatId,
        });

        if (!hasMarketrixChatIdKey || !hasChatIdValue) {
          const error = 'CRITICAL: marketrixChatId missing from JSON string - cannot send';
          log.error('❌', error);
          log.error('JSON string:', metadataJson);
          log.error('Expected chatId:', metadata.marketrixChatId);
          throw new Error(error);
        }

        // Use bufferedAmount to ensure message is queued, then wait a bit for it to be sent
        const beforeBuffered = this.ws?.bufferedAmount ?? 0;
        log.debug('WebSocket bufferedAmount before send:', beforeBuffered);
        this.ws?.send(metadataJson);
        log.info('✅ Metadata sent via WebSocket.send()');

        // Wait for the message to be sent (bufferedAmount decreases)
        const checkSent = () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            // Give it a small delay to ensure message is actually sent over the wire
            setTimeout(() => {
              this.metadataSent = true;
              log.info('✅ Session metadata marked as sent:', {
                sessionId: `${metadata.sessionId.substring(0, 20)}...`,
                marketrixChatId: `${metadata.marketrixChatId.substring(0, 20)}...`,
                url: metadata.url,
                timestamp: metadata.timestamp,
              });
              resolve();
            }, 50); // 50ms should be enough for the message to be sent
          } else {
            reject(new Error('WebSocket closed while sending metadata'));
          }
        };

        // If bufferedAmount is 0, message was sent immediately
        if (this.ws?.bufferedAmount === beforeBuffered) {
          checkSent();
        } else {
          // Wait for bufferedAmount to decrease
          const interval = setInterval(() => {
            if (this.ws?.bufferedAmount === 0 || this.ws?.readyState !== WebSocket.OPEN) {
              clearInterval(interval);
              checkSent();
            }
          }, 10);

          // Timeout after 200ms
          setTimeout(() => {
            clearInterval(interval);
            checkSent();
          }, 200);
        }
      } catch (error) {
        log.error('Error sending metadata:', error);
        this.metadataSent = false;
        reject(error);
      }
    });
  }

  /**
   * Flush queued events when connection is established
   * Only flushes if metadata has been sent AND acknowledged
   */
  private flushEventQueue(): void {
    // Only flush events if metadata has been sent and acknowledged
    if (!this.metadataSent || !this.metadataAcknowledged) {
      log.warn('Cannot flush events: metadata not acknowledged yet');
      return;
    }

    if (this.eventQueue.length > 0) {
      log.info(`Flushing ${this.eventQueue.length} queued events`);
      const events = [...this.eventQueue];
      this.eventQueue = [];

      events.forEach(event => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify(event));
          } catch (error) {
            log.error('Error flushing event:', error);
            this.eventQueue.push(event);
          }
        } else {
          this.eventQueue.push(event);
        }
      });
    }
  }

  /**
   * Start recording session
   * Will wait for marketrix_chat_id to be available before sending metadata.
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
      log.debug('Current state:', {
        isRecording: this.isRecording,
        wsUrl: this.wsUrl,
        sessionId: this.sessionId,
      });

      // chat_id must already exist — recording is triggered by the marketrix:chatid event
      const chatId = this.requireChatId();
      log.info('✅ chat_id available:', `${chatId.substring(0, 20)}...`);

      if (this.stopRequested) throw new Error('Recording stopped during startup');

      log.info('Connecting to WebSocket...');
      await this.connect();
      if (this.stopRequested) throw new Error('Recording stopped during startup');
      log.info('✅ WebSocket connection established');

      if (!this.metadataSent) {
        log.warn('Metadata not sent after connection, sending now...');
        try {
          await this.sendMetadataAsync();
        } catch (error) {
          log.error('Failed to send metadata:', error);
          throw new Error(`Failed to send metadata before starting recording: ${String(error)}`);
        }
      } else if (this.metadataSendPromise) {
        log.debug('Waiting for metadata send to complete...');
        await this.metadataSendPromise;
      }

      if (this.stopRequested) throw new Error('Recording stopped during startup');
      if (!this.metadataSent) {
        throw new Error('Failed to send metadata before starting recording');
      }

      log.info('Waiting for server metadata acknowledgment...');
      const ackPromise = new Promise<void>((resolve, reject) => {
        if (this.metadataAcknowledged) {
          resolve();
          return;
        }
        this.metadataAckResolver = resolve;
        setTimeout(() => {
          if (!this.metadataAcknowledged) {
            this.metadataAckResolver = null;
            reject(new Error('Timeout waiting for metadata acknowledgment from server'));
          }
        }, 5000);
      });

      try {
        await ackPromise;
        log.info('Metadata acknowledged by server, starting RRWeb recording...');
      } catch (error) {
        log.error('Failed to receive metadata acknowledgment:', error);
        throw new Error(`Server did not acknowledge metadata: ${String(error)}`);
      }

      if (this.stopRequested) throw new Error('Recording stopped during startup');

      const recordOptions: RecordOptions = {
        emit: (event: unknown) => {
          this.sendEvent(event as eventWithTime);
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

      log.info('Recording started with marketrix_tab_id:', this.sessionId);
    } catch (error) {
      log.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording session.
   * When recording is not yet started but start() is in-flight, sets stopRequested and aborts
   * connections so doStart() will throw and not resurrect recording.
   */
  stop(): void {
    this.stopRequested = true;

    if (!this.isRecording) {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      return;
    }

    if (this.stopRecording) {
      this.stopRecording();
      this.stopRecording = null;
    }

    this.isRecording = false;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.eventQueue = [];
    this.metadataSent = false;
    this.metadataAcknowledged = false;
    this.metadataAckResolver = null;

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

  /**
   * Get WebSocket connection state
   */
  getConnectionState(): number | null {
    return this.ws ? this.ws.readyState : null;
  }
}
