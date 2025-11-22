import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_MARKETRIX_CONFIG,
  DEFAULT_WIDGET_SETTINGS,
  extractWidgetSettingsFromConfig,
} from '../constants/config';
import type { InstructionType, WidgetSettingsData } from '../sdk';
import MarketrixApiService from '../services/marketrixApiService';
import { isScreenSharing, stopScreenShare } from '../services/screenShareService';
import { cleanup } from '../services/showModeService';
import {
  type WebSocketMessage,
  WebSocketService,
  type WebSocketStatus,
} from '../services/websocketService';
import type { ChatMessage, MarketrixConfig, WidgetState } from '../types';
import {
  clearChatContext,
  clearPendingToolCall,
  getPendingToolCall,
  getStoredChatContext,
  restoreMessagesFromContext,
  storeChatContext,
} from '../utils/chatStorage';
import { cleanupAllWidgetElements } from '../utils/cleanupUtils';
import { configManager } from '../utils/configManager';
import { logError, safeExecute, safeExecuteAsync } from '../utils/errorUtils';
import {
  createAgentMessage,
  createErrorMessage,
  createPlaceholderMessage,
  createSystemMessage,
  createUserMessage,
} from '../utils/messageFactory';
import { addMessage, removeMessage, updateMessage } from '../utils/stateUtils';
import { isBrowser } from '../utils/typeGuards';

interface UseWidgetProps {
  config?: MarketrixConfig;
}

export const useWidget = ({ config }: UseWidgetProps = {}) => {
  if (!config) {
    const defaultSettings = DEFAULT_WIDGET_SETTINGS;
    return {
      state: {
        isOpen: false,
        isMinimized: false,
        isLoading: false,
        messages: [],
        currentMode: 'tell' as InstructionType,
        agentAvailable: false,
        error: undefined,
        activeTaskId: null,
        isTaskRunning: false,
        taskProgress: [],
      },
      actions: {
        toggleWidget: () => {},
        closeWidget: () => {},
        setMode: () => {},
        sendMessage: async () => {},
        stopTask: async () => {},
        clearError: () => {},
        addMessage: () => {},
        updateMessage: () => {},
        removeMessage: () => {},
      },
      marketrixConfig: null,
      settings: defaultSettings,
      shouldShow: false,
      getWidgetText: () => ({
        greeting: defaultSettings.widget_greeting,
        placeholder: 'Ask anything',
        header_ai: defaultSettings.widget_header,
        header_live: 'Live Agent',
        body_ai: defaultSettings.widget_body,
        body_live: 'A live agent will be with you shortly.',
        chat_greeting: 'Welcome to our chat! How can I assist you?',
        tour_greeting: 'Welcome! Let me show you around.',
      }),
      getWidgetCustomize: () => ({
        colors: {
          primary: defaultSettings.widget_accent_color,
          secondary: defaultSettings.widget_secondary_color,
          background: defaultSettings.widget_background_color,
          text: defaultSettings.widget_text_color,
          border: defaultSettings.widget_border_color,
        },
        sizes: {
          width: defaultSettings.widget_width,
          height: defaultSettings.widget_height,
          border_radius: defaultSettings.widget_border_radius,
          font_size: defaultSettings.widget_font_size,
        },
        animations: {
          slide_duration: defaultSettings.widget_animation_duration,
          fade_duration: defaultSettings.widget_fade_duration,
          bounce_effect: defaultSettings.widget_bounce_effect,
        },
      }),
      getWidgetPosition: () => ({
        position: defaultSettings.widget_position,
        offset: DEFAULT_MARKETRIX_CONFIG.widget_position_offset,
        z_index: DEFAULT_MARKETRIX_CONFIG.widget_position_z_index,
      }),
    };
  }
  // Widget UI state
  const [state, setState] = useState<WidgetState>({
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    messages: [],
    currentMode: 'tell',
    agentAvailable: false,
    activeTaskId: null,
    isTaskRunning: false,
    taskProgress: [],
  });

  const apiServiceRef = useRef<MarketrixApiService | null>(null);
  const websocketServiceRef = useRef<WebSocketService | null>(null);
  const initializationInProgressRef = useRef<boolean>(false);
  const initializedChatIdRef = useRef<string | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

  const marketrixConfig = useMemo<MarketrixConfig>(() => {
    const mergedConfig = {
      ...DEFAULT_MARKETRIX_CONFIG,
      ...config, // Config from index.tsx overrides defaults
    };
    configManager.saveConfig(mergedConfig);
    return mergedConfig;
  }, [config]);

  // Initialize API service and websocket connection (only once on mount)
  useEffect(() => {
    // If we've already initialized, only handle reconnection if needed
    if (hasInitializedRef.current) {
      // If websocket exists but is disconnected, try to reconnect
      if (
        websocketServiceRef.current &&
        initializedChatIdRef.current &&
        !websocketServiceRef.current.isConnected() &&
        !initializationInProgressRef.current
      ) {
        const chatId = initializedChatIdRef.current;
        console.log('[Widget] WebSocket disconnected, attempting to reconnect...');
        initializationInProgressRef.current = true;
        websocketServiceRef.current
          .connect(chatId)
          .finally(() => {
            initializationInProgressRef.current = false;
          })
          .catch((error) => {
            console.error('[Widget] Reconnection failed:', error);
          });
      }
      return;
    }

    // Prevent multiple simultaneous initializations
    if (initializationInProgressRef.current) {
      console.log('[Widget] Initialization already in progress, skipping...');
      return;
    }

    // If already initialized with the same chat_id and websocket is connected, skip
    if (
      websocketServiceRef.current &&
      initializedChatIdRef.current &&
      websocketServiceRef.current.isConnected() &&
      websocketServiceRef.current.getChatId() === initializedChatIdRef.current
    ) {
      console.log('[Widget] Already initialized and connected, skipping re-initialization');
      hasInitializedRef.current = true;
      return;
    }

    initializationInProgressRef.current = true;

    if (!apiServiceRef.current) {
      apiServiceRef.current = new MarketrixApiService(config);
    } else {
      // Update config if service already exists (merge with existing config)
      apiServiceRef.current.updateConfig(config);
    }

    // Initialize chat_id and websocket connection
    const initializeChat = async () => {
      if (!apiServiceRef.current) {
        initializationInProgressRef.current = false;
        return;
      }

      try {
        const chatId = await apiServiceRef.current.initializeChatId();
        console.log('[Widget] Chat ID initialized:', chatId);

        // Restore context from storage if available
        const storedContext = getStoredChatContext(chatId);
        if (storedContext) {
          console.log('[Widget] Restoring context from storage:', {
            messageCount: storedContext.messages.length,
            isTaskRunning: storedContext.isTaskRunning,
            activeTaskId: storedContext.activeTaskId,
            currentMode: storedContext.currentMode,
          });

          const restoredMessages = restoreMessagesFromContext(storedContext);

          // Additional cleanup: ensure __THINKING__ markers are removed and progress lines are valid
          const cleanedMessages = restoredMessages.map((msg) => {
            // Remove any remaining __THINKING__ markers
            let cleanContent = msg.content.replace(/__THINKING__/g, '');

            // Validate progress line format (should start with ○ or ●✓)
            const parts = cleanContent.split('\n\n');
            if (parts.length > 1) {
              const mainContent = parts[0];
              const progressLines = parts.slice(1).filter((line) => {
                const trimmed = line.trim();
                // Keep valid progress lines or non-progress content
                return trimmed.length > 0;
              });

              cleanContent =
                progressLines.length > 0
                  ? [mainContent, ...progressLines].join('\n\n')
                  : mainContent;
            }

            return {
              ...msg,
              content: cleanContent,
            };
          });

          setState((prev) => ({
            ...prev,
            messages: cleanedMessages,
            isTaskRunning: storedContext.isTaskRunning,
            activeTaskId: storedContext.activeTaskId,
            taskProgress: storedContext.taskProgress,
            currentMode: storedContext.currentMode,
            // Restore widget UI state if available (for backward compatibility, default to false)
            isOpen: storedContext.isOpen ?? false,
            isMinimized: storedContext.isMinimized ?? false,
          }));
        }

        // Skip if we already have a connection with this chat_id
        if (
          websocketServiceRef.current &&
          websocketServiceRef.current.getChatId() === chatId &&
          websocketServiceRef.current.isConnected()
        ) {
          console.log('[Widget] WebSocket already connected with this chat_id, skipping');
          initializedChatIdRef.current = chatId;
          initializationInProgressRef.current = false;
          return;
        }

        // Helper function to retry pending tool call if needed
        const retryPendingToolCallIfNeeded = (
          chatId: string | null,
          websocketService: WebSocketService | null
        ): void => {
          if (!chatId) {
            return;
          }

          if (!websocketService) {
            return;
          }

          if (!websocketService.isConnected()) {
            return;
          }

          const pendingToolCall = getPendingToolCall(chatId);
          if (!pendingToolCall) {
            return;
          }

          console.log('[Widget] Found pending tool call, retrying after refresh:', {
            toolName: pendingToolCall.toolName,
            requestId: pendingToolCall.requestId,
            mode: pendingToolCall.mode,
          });

          // Retry the tool call - websocketService is guaranteed to be non-null here
          websocketService
            .retryToolCall(
              pendingToolCall.requestId,
              pendingToolCall.toolName,
              pendingToolCall.arguments,
              pendingToolCall.mode,
              pendingToolCall.explanation
            )
            .catch((retryError: unknown) => {
              console.error('[Widget] Failed to retry pending tool call:', retryError);
            });
        };

        // Define the full callback set with progress update logic
        const fullCallbacks = {
          onStatusChange: (status: WebSocketStatus) => {
            console.log('[Widget] WebSocket status changed:', status);
            setState((prev) => ({
              ...prev,
              agentAvailable: status === 'registered' || status === 'connected',
            }));

            // When websocket is fully connected/registered, check for pending tool call to retry
            if (status === 'registered' || status === 'connected') {
              retryPendingToolCallIfNeeded(
                initializedChatIdRef.current,
                websocketServiceRef.current
              );
            }
          },
          onToolCallProgress: (toolName: string, explanation: string, mode: string) => {
            // Log to console only - progress updates are now handled in onMessage callback
            console.log(
              `[Widget] Tool call progress callback received: ${toolName} - "${explanation}" (mode: ${mode})`
            );
          },
          onMessage: (message: WebSocketMessage) => {
            console.log('[Widget] WebSocket message received:', message);
            console.log('[Widget] Message method:', message.method);
            console.log('[Widget] Message has id:', !!message.id);
            console.log('[Widget] Message has params:', !!message.params);
            console.log('[Widget] Message has result:', !!message.result);
            console.log('[Widget] Message has error:', !!message.error);

            // Handle tool call messages - update progress when tool calls are received
            if (message.method === 'tools/call' && message.id && message.params) {
              console.log('[Widget] ✓ Detected tool call message with params');
              const params = message.params as
                | {
                    name?: string;
                    arguments?: Record<string, unknown>;
                    mode?: string;
                    explanation?: string;
                  }
                | undefined;

              if (params?.name) {
                const toolName = params.name;
                const explanation = params.explanation || '';
                const progressText = explanation || `Executing ${toolName}...`;

                console.log(
                  `[Widget] Tool call received via onMessage: ${toolName} - "${progressText}"`
                );

                // Update progress immediately when tool call is received
                setState((prev) => {
                  const messages = [...prev.messages];
                  let taskMessageIndex = -1;

                  // Find the last agent message (task message)
                  // Exclude placeholder messages, system messages, and screen access requests
                  for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    if (
                      msg.sender === 'agent' &&
                      !msg.isSystemMessage &&
                      !msg.isScreenAccessRequest &&
                      !msg.isPlaceholder
                    ) {
                      taskMessageIndex = i;
                      break;
                    }
                  }

                  if (taskMessageIndex >= 0) {
                    console.log(`[Widget] ✓ Found task message at index ${taskMessageIndex}`);
                    const existingMessage = messages[taskMessageIndex];
                    const progressLine = `○ ${progressText}`;

                    // Remove __THINKING__ marker from content before processing
                    const cleanContent = existingMessage.content.replace(/__THINKING__/g, '');

                    // Split message into main content and progress lines
                    const parts = cleanContent.split('\n\n');
                    const mainContent = parts[0];
                    const existingProgressLines = parts
                      .slice(1)
                      .filter(
                        (line) => line.trim().length > 0 && !line.trim().includes('__THINKING__')
                      );

                    // Check if this tool already has a progress line (by tool name)
                    const toolProgressIndex = existingProgressLines.findIndex(
                      (line) =>
                        (line.trim().startsWith('○') || line.trim().startsWith('●✓')) &&
                        line.includes(toolName)
                    );

                    const updatedProgressLines = [...existingProgressLines];
                    if (toolProgressIndex >= 0) {
                      // Update existing line
                      console.log(
                        `[Widget] Updating existing progress line at index ${toolProgressIndex}`
                      );
                      updatedProgressLines[toolProgressIndex] = progressLine;
                    } else {
                      // Add new line
                      console.log(`[Widget] Adding new progress line: ${progressLine}`);
                      updatedProgressLines.push(progressLine);
                    }

                    // Ensure main content doesn't have __THINKING__ marker
                    const cleanMainContent = mainContent.replace(/__THINKING__/g, '').trim();

                    const updatedContent =
                      updatedProgressLines.length > 0
                        ? [cleanMainContent, ...updatedProgressLines].join('\n\n')
                        : cleanMainContent;

                    console.log(`[Widget] Updated content:`, updatedContent.substring(0, 150));

                    const updatedMessage: ChatMessage = {
                      ...existingMessage,
                      content: updatedContent,
                    };
                    const updatedMessages = [...messages];
                    updatedMessages[taskMessageIndex] = updatedMessage;

                    return {
                      ...prev,
                      messages: updatedMessages,
                    };
                  } else {
                    console.warn(
                      `[Widget] ✗ No task message found! Messages count: ${messages.length}`
                    );
                  }

                  return prev;
                });
              }
            }

            // Handle tool call results - mark tool as done when result is received
            if (
              message.method === 'tools/call' &&
              message.id &&
              message.result &&
              !message.params &&
              !message.error
            ) {
              // This is a result message (has result but no params and no error)
              const result = message.result as
                | {
                    content?: Array<{ type?: string; text?: string }>;
                  }
                | undefined;

              if (result?.content && result.content.length > 0) {
                const resultText = result.content[0]?.text || 'Tool execution completed';
                console.log(`[Widget] Tool call result received: ${resultText}`);

                // Update progress to mark the most recent incomplete tool as done
                setState((prev) => {
                  const messages = [...prev.messages];
                  let taskMessageIndex = -1;

                  // Find the last agent message (task message)
                  // Exclude placeholder messages, system messages, and screen access requests
                  for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    if (
                      msg.sender === 'agent' &&
                      !msg.isSystemMessage &&
                      !msg.isScreenAccessRequest &&
                      !msg.isPlaceholder
                    ) {
                      taskMessageIndex = i;
                      break;
                    }
                  }

                  if (taskMessageIndex >= 0) {
                    const existingMessage = messages[taskMessageIndex];

                    // Remove __THINKING__ marker from content before processing
                    const cleanContent = existingMessage.content.replace(/__THINKING__/g, '');

                    const parts = cleanContent.split('\n\n');
                    const mainContent = parts[0];
                    const existingProgressLines = parts
                      .slice(1)
                      .filter(
                        (line) => line.trim().length > 0 && !line.trim().includes('__THINKING__')
                      );

                    // Find the last incomplete progress line and mark it as done
                    if (existingProgressLines.length > 0) {
                      // Find the last line that doesn't have a filled circle with tick (completed indicator)
                      let lastIncompleteIndex = -1;
                      for (let i = existingProgressLines.length - 1; i >= 0; i--) {
                        const line = existingProgressLines[i];
                        // Only look for lines that start with ○ (pending, not completed)
                        if (line.trim().startsWith('○') && !line.trim().startsWith('●✓')) {
                          lastIncompleteIndex = i;
                          break;
                        }
                      }

                      if (lastIncompleteIndex >= 0) {
                        const lastLine = existingProgressLines[lastIncompleteIndex];
                        // Replace ○ (empty circle) with ●✓ (filled circle with tick) when completed
                        // Ensure consistent formatting: ○ becomes ●✓
                        const updatedLastLine = lastLine.trim().startsWith('○')
                          ? lastLine.replace(/^○\s*/, '●✓ ')
                          : lastLine;
                        const updatedProgressLines = [
                          ...existingProgressLines.slice(0, lastIncompleteIndex),
                          updatedLastLine,
                          ...existingProgressLines.slice(lastIncompleteIndex + 1),
                        ];

                        // Ensure main content doesn't have __THINKING__ marker
                        const cleanMainContent = mainContent.replace(/__THINKING__/g, '').trim();

                        const updatedContent =
                          updatedProgressLines.length > 0
                            ? [cleanMainContent, ...updatedProgressLines].join('\n\n')
                            : cleanMainContent;

                        const updatedMessage: ChatMessage = {
                          ...existingMessage,
                          content: updatedContent,
                        };
                        const updatedMessages = [...messages];
                        updatedMessages[taskMessageIndex] = updatedMessage;

                        console.log(
                          `[Widget] Marked tool call as done. Updated line: ${updatedLastLine}`
                        );

                        return {
                          ...prev,
                          messages: updatedMessages,
                        };
                      }
                    }
                  }

                  return prev;
                });
              }
            }

            // Handle tool call errors - mark tool as failed when error is received
            if (message.method === 'tools/call' && message.id && message.error && !message.params) {
              // This is an error message (has error but no params)
              const error = message.error as
                | {
                    code?: number;
                    message?: string;
                  }
                | undefined;

              if (error?.message) {
                const errorText = error.message || 'Tool execution failed';
                console.log(`[Widget] Tool call error received: ${errorText}`);

                // Update progress to mark the most recent incomplete tool as failed
                setState((prev) => {
                  const messages = [...prev.messages];
                  let taskMessageIndex = -1;

                  // Find the last agent message (task message)
                  // Exclude placeholder messages, system messages, and screen access requests
                  for (let i = messages.length - 1; i >= 0; i--) {
                    const msg = messages[i];
                    if (
                      msg.sender === 'agent' &&
                      !msg.isSystemMessage &&
                      !msg.isScreenAccessRequest &&
                      !msg.isPlaceholder
                    ) {
                      taskMessageIndex = i;
                      break;
                    }
                  }

                  if (taskMessageIndex >= 0) {
                    const existingMessage = messages[taskMessageIndex];

                    // Remove __THINKING__ marker from content before processing
                    const cleanContent = existingMessage.content.replace(/__THINKING__/g, '');

                    const parts = cleanContent.split('\n\n');
                    const mainContent = parts[0];
                    const existingProgressLines = parts
                      .slice(1)
                      .filter(
                        (line) => line.trim().length > 0 && !line.trim().includes('__THINKING__')
                      );

                    // Find the last incomplete progress line and mark it as failed
                    if (existingProgressLines.length > 0) {
                      // Find the last line that starts with ○ (pending, not completed)
                      let lastIncompleteIndex = -1;
                      for (let i = existingProgressLines.length - 1; i >= 0; i--) {
                        const line = existingProgressLines[i];
                        // Only look for lines that start with ○ (pending, not completed)
                        if (line.trim().startsWith('○') && !line.trim().startsWith('●✓')) {
                          lastIncompleteIndex = i;
                          break;
                        }
                      }

                      if (lastIncompleteIndex >= 0) {
                        const lastLine = existingProgressLines[lastIncompleteIndex];
                        const updatedLastLine = `${lastLine} ✗ (${errorText})`;
                        const updatedProgressLines = [
                          ...existingProgressLines.slice(0, lastIncompleteIndex),
                          updatedLastLine,
                          ...existingProgressLines.slice(lastIncompleteIndex + 1),
                        ];

                        // Ensure main content doesn't have __THINKING__ marker
                        const cleanMainContent = mainContent.replace(/__THINKING__/g, '').trim();

                        const updatedContent =
                          updatedProgressLines.length > 0
                            ? [cleanMainContent, ...updatedProgressLines].join('\n\n')
                            : cleanMainContent;

                        const updatedMessage: ChatMessage = {
                          ...existingMessage,
                          content: updatedContent,
                        };
                        const updatedMessages = [...messages];
                        updatedMessages[taskMessageIndex] = updatedMessage;

                        console.log(
                          `[Widget] Marked tool call as failed. Updated line: ${updatedLastLine}`
                        );

                        return {
                          ...prev,
                          messages: updatedMessages,
                        };
                      }
                    }
                  }

                  return prev;
                });
              }
            }

            // Handle task status updates
            if (message.method === 'task/status' && message.params) {
              const params = message.params as {
                status: string;
                message: string;
                timestamp: string;
              };
              const status = params.status;

              if (status === 'stopped' || status === 'completed' || status === 'failed') {
                setState((prev) => ({
                  ...prev,
                  activeTaskId: null,
                  isTaskRunning: false,
                  isLoading: false,
                }));
              }
            }
          },
          onError: (error: Error) => {
            console.error('[Widget] WebSocket error:', error);
            setState((prev) => ({
              ...prev,
              agentAvailable: false,
              error: error.message,
            }));
          },
        };

        // Initialize websocket service if it doesn't exist (use singleton)
        if (!websocketServiceRef.current) {
          websocketServiceRef.current = WebSocketService.getInstance(config, fullCallbacks);
        } else {
          // Replace callbacks if service already exists (use setCallbacks to replace, not add)
          websocketServiceRef.current.setCallbacks(fullCallbacks);
        }

        // Connect websocket with the chat_id
        if (chatId) {
          const currentChatId = websocketServiceRef.current.getChatId();
          if (currentChatId !== chatId) {
            // Only reconnect if chat_id changed
            if (currentChatId) {
              console.log('[Widget] Chat ID changed, reconnecting websocket...');
              websocketServiceRef.current.disconnect();
            }
            try {
              await websocketServiceRef.current.connect(chatId);
              initializedChatIdRef.current = chatId;
              console.log('[Widget] WebSocket connection initiated');
            } catch (wsError) {
              console.error('[Widget] Failed to connect websocket:', wsError);
            }
          } else if (!websocketServiceRef.current.isConnected()) {
            // If same chat_id but not connected, try to connect
            try {
              await websocketServiceRef.current.connect(chatId);
              initializedChatIdRef.current = chatId;
              console.log('[Widget] WebSocket reconnection initiated');
            } catch (wsError) {
              console.error('[Widget] Failed to reconnect websocket:', wsError);
            }
          } else {
            initializedChatIdRef.current = chatId;
          }

          // After websocket is connected, check for pending tool call to retry
          retryPendingToolCallIfNeeded(chatId, websocketServiceRef.current);
        }
      } catch (error) {
        console.error('[Widget] Failed to initialize chat_id:', error);
      } finally {
        initializationInProgressRef.current = false;
        hasInitializedRef.current = true;
      }
    };

    initializeChat();

    // Check agent availability on mount
    const checkAgentAvailability = async () => {
      if (!apiServiceRef.current) return;

      try {
        const available = await apiServiceRef.current.checkAgentAvailability();
        setState((prev) => ({ ...prev, agentAvailable: available }));
      } catch (error) {
        console.error('Failed to check agent availability:', error);
        setState((prev) => ({ ...prev, agentAvailable: false }));
      }
    };

    checkAgentAvailability();

    // Cleanup websocket only on unmount (not on config change)
    return () => {
      // Only cleanup on actual unmount, not on every config change
      // The websocket should persist across config updates
    };
  }, [config]);

  // Monitor task state and add/remove "Thinking..." indicator when waiting
  useEffect(() => {
    if (!state.isTaskRunning || (state.currentMode !== 'show' && state.currentMode !== 'do')) {
      // Remove thinking indicator if task is not running or not in show/do mode
      setState((prev) => {
        const hasThinkingMessages = prev.messages.some(
          (msg) =>
            msg.sender === 'agent' &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest &&
            !msg.isPlaceholder &&
            msg.content.includes('__THINKING__')
        );
        if (!hasThinkingMessages) return prev;

        const updatedMessages = prev.messages.map((msg) => {
          if (
            msg.sender === 'agent' &&
            !msg.isSystemMessage &&
            !msg.isScreenAccessRequest &&
            !msg.isPlaceholder &&
            msg.content.includes('__THINKING__')
          ) {
            return {
              ...msg,
              content: msg.content.replace(/\n\n__THINKING__$/, ''),
            };
          }
          return msg;
        });
        return { ...prev, messages: updatedMessages };
      });
      return;
    }

    // Find the last agent message (task message) and check if we need to add/remove thinking indicator
    setState((prev) => {
      const messages = [...prev.messages];
      let taskMessageIndex = -1;

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (
          msg.sender === 'agent' &&
          !msg.isSystemMessage &&
          !msg.isScreenAccessRequest &&
          !msg.isPlaceholder
        ) {
          taskMessageIndex = i;
          break;
        }
      }

      if (taskMessageIndex >= 0) {
        const taskMessage = messages[taskMessageIndex];
        // Remove __THINKING__ marker from content check (should not be displayed)
        const cleanContent = taskMessage.content.replace(/__THINKING__/g, '');
        const hasProgressLines = cleanContent.includes('○') || cleanContent.includes('●✓');
        const hasThinkingMarker = taskMessage.content.includes('__THINKING__');

        // Add thinking marker if no progress lines and no marker exists
        if (!hasProgressLines && !hasThinkingMarker) {
          const updatedMessage = {
            ...taskMessage,
            content: `${taskMessage.content}\n\n__THINKING__`,
          };
          const updatedMessages = [...messages];
          updatedMessages[taskMessageIndex] = updatedMessage;
          return { ...prev, messages: updatedMessages };
        }
        // Remove thinking marker if progress lines exist
        else if (hasProgressLines && hasThinkingMarker) {
          const updatedMessage = {
            ...taskMessage,
            content: taskMessage.content
              .replace(/\n\n__THINKING__$/, '')
              .replace(/__THINKING__/g, ''),
          };
          const updatedMessages = [...messages];
          updatedMessages[taskMessageIndex] = updatedMessage;
          return { ...prev, messages: updatedMessages };
        }
      }

      return prev;
    });
  }, [state.isTaskRunning, state.currentMode]);

  // Auto-save context when state changes (debounced)
  useEffect(() => {
    const chatId = initializedChatIdRef.current;
    if (!chatId || !hasInitializedRef.current) {
      return;
    }

    // Debounce saves to avoid excessive localStorage writes
    const timeoutId = setTimeout(() => {
      storeChatContext(
        chatId,
        state.messages,
        state.isTaskRunning,
        state.activeTaskId,
        state.taskProgress,
        state.currentMode,
        state.isOpen,
        state.isMinimized
      );
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    state.messages,
    state.isTaskRunning,
    state.activeTaskId,
    state.taskProgress,
    state.currentMode,
    state.isOpen,
    state.isMinimized,
  ]);

  // Handle page lifecycle events to stop screen sharing and add message
  useEffect(() => {
    const handlePageUnload = () => {
      // Check if screen sharing is active
      if (isScreenSharing()) {
        console.log('[Widget] Page unloading, stopping screen share and adding message');

        // Stop screen sharing
        stopScreenShare();

        // Remove any screenshare messages (with videoStream) from chat history
        // Get current state synchronously and update immediately
        setState((prev) => {
          // Remove screenshare messages (messages with videoStream)
          const messagesWithoutScreenshare = prev.messages.filter((msg) => !msg.videoStream);

          // Add "Stopped screenshare" message to chat history
          const stoppedMessage = createSystemMessage(
            'Stopped screenshare',
            'show',
            'user',
            'screenshare-stopped'
          );

          const updatedMessages = [...messagesWithoutScreenshare, stoppedMessage];

          // Immediately save to storage to ensure it's persisted before page unloads
          const chatId = initializedChatIdRef.current;
          if (chatId) {
            try {
              // Save synchronously to localStorage
              storeChatContext(
                chatId,
                updatedMessages,
                prev.isTaskRunning,
                prev.activeTaskId,
                prev.taskProgress,
                prev.currentMode,
                prev.isOpen,
                prev.isMinimized
              );
            } catch (error) {
              console.warn('[Widget] Failed to save stopped screenshare message:', error);
            }
          }

          return {
            ...prev,
            messages: updatedMessages,
          };
        });
      }
    };

    // Listen to page lifecycle events
    // Use pagehide for better reliability (fires even when page is cached)
    // pagehide is more reliable than beforeunload for saving state
    window.addEventListener('pagehide', handlePageUnload);

    // Also handle visibility change (when tab becomes hidden)
    // This catches cases where the page is hidden but not unloaded
    const handleVisibilityChange = () => {
      if (document.hidden && isScreenSharing()) {
        console.log('[Widget] Page hidden, stopping screen share and adding message');
        handlePageUnload();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    return () => {
      if (websocketServiceRef.current) {
        console.log('[Widget] Cleaning up websocket connection on unmount');
        websocketServiceRef.current.disconnect();
        websocketServiceRef.current = null;
      }
      initializedChatIdRef.current = null;
      initializationInProgressRef.current = false;
      hasInitializedRef.current = false;
    };
  }, []);

  // Widget UI actions
  const toggleWidget = useCallback(() => {
    setState((prev) => {
      // If opening from minimized state, clear minimized
      // If closing, keep minimized state
      return {
        ...prev,
        isOpen: !prev.isOpen,
        isMinimized: prev.isOpen ? prev.isMinimized : false,
      };
    });
  }, []);

  const closeWidget = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      isMinimized: true, // Set minimized when closed
    }));
  }, []);

  const setMode = useCallback((mode: InstructionType) => {
    setState((prev) => ({ ...prev, currentMode: mode }));
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      mode?: InstructionType,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean
    ) => {
      if (!apiServiceRef.current || !content.trim()) return;

      const messageMode = mode || state.currentMode;
      const messageId = Date.now().toString();

      // Create placeholder message for thinking state
      const placeholderMessage = createPlaceholderMessage(messageMode);
      const placeholderMessageId = placeholderMessage.id;

      // Only add user message if it wasn't already added (e.g., from chip click)
      if (!skipUserMessage) {
        const userMessage = createUserMessage(content, messageMode);

        // Add user message and placeholder immediately
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage, placeholderMessage],
          isLoading: true,
        }));
      } else {
        // Message already added, just add placeholder and set loading state
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, placeholderMessage],
          isLoading: true,
        }));
      }

      try {
        const response = await apiServiceRef.current.sendMessage({
          message: content.trim(),
          mode: messageMode,
          connection_id: connectionId,
          question,
        });

        // For show/do modes, check if task_id is in response and start tracking
        const isTaskMode = messageMode === 'show' || messageMode === 'do';
        let taskId: string | null = null;

        // Try to extract task_id from response if available
        if (
          isTaskMode &&
          response &&
          'task_id' in response &&
          typeof response.task_id === 'string'
        ) {
          taskId = response.task_id;
        }

        // For show/do modes, log the response to console
        if (isTaskMode) {
          console.log(`[Widget] Task started: ${response.response}`);
        }

        const agentMessage = createAgentMessage(
          response.response,
          response.mode,
          response.messageId
        );

        // Override timestamp from API response if provided
        if (response.timestamp) {
          agentMessage.timestamp = response.timestamp;
        }

        console.log(
          `[Widget] Adding agent message: "${agentMessage.content}" (id: ${agentMessage.id})`
        );

        // Replace placeholder message with actual response
        // Preserve any progress lines that were added to the placeholder
        setState((prev) => {
          const placeholderMsg = prev.messages.find((msg) => msg.id === placeholderMessageId);
          let finalAgentMessage = agentMessage;

          // If placeholder has progress lines (content with \n\n), preserve them
          if (placeholderMsg?.content.includes('\n\n')) {
            const parts = placeholderMsg.content.split('\n\n');
            if (parts.length > 1) {
              const progressLines = parts.slice(1);
              finalAgentMessage = {
                ...agentMessage,
                content: [agentMessage.content, ...progressLines].join('\n\n'),
              };
            }
          }

          const newMessages = prev.messages.map((msg) =>
            msg.id === placeholderMessageId ? finalAgentMessage : msg
          );
          console.log(
            `[Widget] State updated with ${newMessages.length} messages. Last message: "${newMessages[newMessages.length - 1].content}"`
          );
          return {
            ...prev,
            messages: newMessages,
            isLoading: false,
            // Set task state for show/do modes
            ...(isTaskMode && taskId
              ? {
                  activeTaskId: taskId,
                  isTaskRunning: true,
                  taskProgress: [],
                }
              : {}),
          };
        });
      } catch (error) {
        console.error('Failed to send message:', error);

        // Extract error message - prefer API error details if available
        let userFriendlyError = 'Sorry, I encountered an error. Please try again.';
        const errorMsg = error instanceof Error ? error.message : String(error);

        // If error contains API error details, use them
        if (errorMsg.includes('API returned status')) {
          // Extract the actual error message after the status
          // Format: "API returned status 500. No tell-mode rule found!"
          const apiErrorMatch = errorMsg.match(/API returned status \d+\. (.+?)(?:\.|$)/);
          if (apiErrorMatch && apiErrorMatch.length > 1) {
            const apiError = apiErrorMatch[1].trim();
            // Make it more user-friendly
            if (apiError.includes('No tell-mode rule found')) {
              userFriendlyError = 'Sorry, the tell mode is not configured. Please contact support.';
            } else if (apiError.includes('No show-mode rule found')) {
              userFriendlyError = 'Sorry, the show mode is not configured. Please contact support.';
            } else if (apiError.includes('No do-mode rule found')) {
              userFriendlyError = 'Sorry, the do mode is not configured. Please contact support.';
            } else {
              userFriendlyError = `Sorry, ${apiError.toLowerCase()}`;
            }
          }
        } else if (errorMsg.includes('API request failed')) {
          // Extract the actual error from "API request failed: <error>"
          const actualError = errorMsg.replace('API request failed: ', '').trim();
          if (actualError) {
            userFriendlyError = `Sorry, ${actualError.toLowerCase()}`;
          }
        }

        const errorMessage = createErrorMessage(userFriendlyError, messageMode, messageId);

        // Remove placeholder message on error
        setState((prev) => {
          const newMessages = prev.messages.filter(
            (msg) => !(msg.isPlaceholder && msg.id.startsWith('placeholder-'))
          );
          return {
            ...prev,
            messages: [...newMessages, errorMessage],
            isLoading: false,
            error: 'Failed to send message',
          };
        });
      }
    },
    [state.currentMode]
  );

  const stopTask = useCallback(async () => {
    if (!apiServiceRef.current || !state.activeTaskId) return;

    try {
      await apiServiceRef.current.stopTask(state.activeTaskId);
      setState((prev) => ({
        ...prev,
        activeTaskId: null,
        isTaskRunning: false,
        isLoading: false,
      }));
    } catch (error) {
      logError('stopTask', error);
      setState((prev) => ({
        ...prev,
        error: 'Failed to stop task',
      }));
    }
  }, [state.activeTaskId]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const addMessageCallback = useCallback((message: ChatMessage) => {
    addMessage(setState, message);
  }, []);

  const updateMessageCallback = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    updateMessage(setState, messageId, updates);
  }, []);

  const removeMessageCallback = useCallback((messageId: string) => {
    removeMessage(setState, messageId);
  }, []);

  const clearChatHistory = useCallback(async () => {
    const chatId = initializedChatIdRef.current;

    // Stop any running tasks before clearing state
    if (chatId && apiServiceRef.current && (state.isTaskRunning || state.activeTaskId)) {
      const apiService = apiServiceRef.current;
      await safeExecuteAsync(
        async () => {
          console.log('[Widget] Stopping active task before clearing');
          // Stop task without taskId to stop all tasks for this chat_id
          await apiService.stopTask();
        },
        'Failed to stop task during clear (continuing anyway)',
        undefined
      );
    }

    // Stop screenshare if active
    if (isScreenSharing()) {
      console.log('[Widget] Stopping screenshare on reset');
      stopScreenShare();
    }

    // Clean up any pending tool call overlays
    cleanup();

    // Clean up all widget DOM elements using consolidated utility
    cleanupAllWidgetElements();

    // Clear all stored state
    if (chatId) {
      clearChatContext();
      clearPendingToolCall();
    }

    // Clear chat ID storage as well to force a fresh chat ID on next initialization
    if (isBrowser()) {
      safeExecute(
        () => {
          localStorage.removeItem('marketrix_chat_id');
        },
        'Failed to clear chat ID from localStorage',
        undefined
      );
    }

    // Reset widget state to initial values
    // Keep isOpen and isMinimized to preserve the widget's expanded state
    setState((prev) => ({
      ...prev,
      messages: [],
      isTaskRunning: false,
      activeTaskId: null,
      taskProgress: [],
      // Preserve widget UI state (isOpen and isMinimized)
      currentMode: 'tell',
      error: undefined,
    }));

    // Reset initialization flags to force re-initialization
    initializedChatIdRef.current = null;
    hasInitializedRef.current = false;

    console.log('[Widget] Widget reset - all stored state cleared');
  }, [state.isTaskRunning, state.activeTaskId]);

  const shouldShowWidget = useCallback(() => {
    return configManager.shouldShowWidget();
  }, []);

  // Get specific configuration values
  const getWidgetText = useCallback(() => {
    // Text content comes from flat config (from API)
    const settings = extractWidgetSettingsFromConfig(marketrixConfig);
    return {
      greeting: settings.widget_greeting,
      placeholder: 'Ask anything', // Default placeholder (not in settings schema)
      header_ai: settings.widget_header,
      header_live: 'Live Agent', // Default live header (not in settings schema)
      body_ai: settings.widget_body,
      body_live: 'A live agent will be with you shortly.', // Default live body (not in settings schema)
      chat_greeting: settings.widget_body, // Use widget_body as chat greeting
      tour_greeting: settings.widget_greeting, // Use widget_greeting as tour greeting
    };
  }, [marketrixConfig]);

  // Derive customize from flat config (all styling comes from API)
  const getWidgetCustomize = useCallback(() => {
    const settings = extractWidgetSettingsFromConfig(marketrixConfig);
    return {
      colors: {
        primary: settings.widget_accent_color,
        secondary: settings.widget_secondary_color,
        background: settings.widget_background_color,
        text: settings.widget_text_color,
        border: settings.widget_border_color,
      },
      sizes: {
        width: settings.widget_width,
        height: settings.widget_height,
        border_radius: settings.widget_border_radius,
        font_size: settings.widget_font_size,
      },
      animations: {
        slide_duration: settings.widget_animation_duration,
        fade_duration: settings.widget_fade_duration,
        bounce_effect: settings.widget_bounce_effect,
      },
    };
  }, [marketrixConfig]);

  const getWidgetPosition = useCallback(() => {
    const settings = extractWidgetSettingsFromConfig(marketrixConfig);
    return {
      position: settings.widget_position,
      offset:
        marketrixConfig.widget_position_offset ?? DEFAULT_MARKETRIX_CONFIG.widget_position_offset,
      z_index:
        marketrixConfig.widget_position_z_index ?? DEFAULT_MARKETRIX_CONFIG.widget_position_z_index,
    };
  }, [marketrixConfig]);

  // Get effective settings (from flat config)
  const effectiveSettings = useMemo<WidgetSettingsData>(() => {
    return extractWidgetSettingsFromConfig(marketrixConfig);
  }, [marketrixConfig]);

  return {
    // Widget UI state
    state,
    actions: {
      toggleWidget,
      closeWidget,
      setMode,
      sendMessage,
      stopTask,
      clearError,
      addMessage: addMessageCallback,
      updateMessage: updateMessageCallback,
      removeMessage: removeMessageCallback,
      clearChatHistory,
    },

    // Config state
    marketrixConfig,
    settings: effectiveSettings,

    // Computed values
    shouldShow: shouldShowWidget(),

    // Getter methods (styling-related)
    getWidgetText,
    getWidgetCustomize,
    getWidgetPosition,
  };
};
