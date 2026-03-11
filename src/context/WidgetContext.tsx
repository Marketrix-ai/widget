import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { WidgetEvent } from '../sdk/schema';
import { MarketrixApiService } from '../services/ApiService';
import { chatService, createAgentMessage, createUserMessage } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { sessionManager } from '../services/SessionManager';
import { StreamClient, type StreamStatus } from '../services/StreamClient';
import { toolExecutionService } from '../services/ToolService';
import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';
import { BROWSER_TOOLS } from '../types/browserTools';
import {
  addProgressLine,
  addThinkingMarker,
  findMessageForProgress,
  getFriendlyToolName,
  markProgressLineComplete,
  markProgressLineFailed,
  updateThinkingMarker,
} from '../utils/chat';

// Define Context Interface
interface WidgetContextType {
  state: WidgetState;
  actions: {
    setState: (payload: Partial<WidgetState>) => void;
    toggleWidget: () => void;
    closeWidget: () => void;
    setMode: (mode: InstructionType) => void;
    setLoading: (loading: boolean) => void;
    setAgentAvailable: (available: boolean) => void;
    setError: (error: string | undefined) => void;
    clearError: () => void;
    setTaskState: (payload: {
      activeTaskId: string | null;
      isTaskRunning: boolean;
      taskProgress?: TaskProgress[];
    }) => void;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
    removeMessage: (messageId: string) => void;
    setMessages: (messages: ChatMessage[]) => void;
    resetState: () => void;
    stopTask: () => Promise<void>;
    clearChatHistory: () => void;
    sendMessage: (
      content: string,
      mode?: InstructionType,
      applicationId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => Promise<void>;
  };
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

interface WidgetProviderProps {
  children: React.ReactNode;
  /** Preview mode disables all network ops (WebSocket, API, SessionManager) */
  previewMode?: boolean;
}

export const WidgetProvider: React.FC<WidgetProviderProps> = ({ children, previewMode = false }) => {
  const stateVersion = useRef(0);
  const processedRequestIds = useRef(new Set<string>());
  const isTaskRunningRef = useRef(false);
  const MAX_PROCESSED_IDS = 1000;

  const addProcessedRequestId = useCallback((requestId: string) => {
    processedRequestIds.current.add(requestId);

    if (processedRequestIds.current.size > MAX_PROCESSED_IDS) {
      const entries = Array.from(processedRequestIds.current);
      const toKeep = entries.slice(-MAX_PROCESSED_IDS / 2);
      processedRequestIds.current = new Set(toKeep);
    }
  }, []);
  // Track both conditions for task start: HTTP response and WebSocket notification
  const taskIdFromApiRef = useRef<string | null>(null);
  const taskStartedFromAgentRef = useRef(false);

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

  // Initialize ChatService on mount (skip in preview mode)
  useEffect(() => {
    // Skip all network initialization in preview mode
    if (previewMode) {
      return;
    }

    const initChat = async () => {
      const chatId = await sessionManager.getOrCreateChatId();

      chatService.createInitialContext(chatId);

      chatService.initialize(chatId);
      const isTaskRunning = chatService.getIsTaskRunning();
      isTaskRunningRef.current = isTaskRunning; // Initialize ref
      setState(prev => ({
        ...prev,
        messages: chatService.getMessages(),
        isLoading: chatService.getIsLoading(),
        isTaskRunning,
        activeTaskId: chatService.getActiveTaskId(),
        taskProgress: chatService.getTaskProgress(),
        currentMode: chatService.getCurrentMode(),
        isOpen: chatService.getIsOpen(),
        isMinimized: chatService.getIsMinimized(),
      }));

      // Connect to stream if chat ID exists
      if (chatId) {
        const streamClient = StreamClient.getInstance();
        const streamConfig = configManager.getConfig();
        streamClient
          .connect(
            chatId,
            streamConfig
              ? {
                  mtxId: streamConfig.mtxId,
                  mtxKey: streamConfig.mtxKey,
                  mtxAgent: streamConfig.mtxAgent,
                  mtxApp: streamConfig.mtxApp,
                }
              : undefined,
          )
          .catch((err: unknown) => console.error('Initial stream connection failed:', err));
      }
    };
    initChat();
  }, [previewMode]);

  // Helper to update progress
  const updateProgressForTool = useCallback(
    (toolName: string, explanation: string, status: 'running' | 'completed' | 'failed', error?: string) => {
      setState(prev => {
        const friendlyName = getFriendlyToolName(toolName);
        const found = findMessageForProgress({
          messages: prev.messages,
          isTaskRunning: prev.isTaskRunning,
          currentMode: prev.currentMode,
          preferPlaceholder: true,
          requireContent: status === 'failed',
        });

        if (!found) return prev;

        let updatedMsg = found.message;

        // Determine if this tool interaction requires user waiting
        // Matches ToolService.requiresHighlight logic + show mode
        const isInteractiveTool = [
          'click_element',
          'type_text',
          'select_dropdown_option',
          'send_keys',
          'upload_file',
        ].includes(toolName);

        const shouldWait = prev.isTaskRunning && prev.currentMode === 'show' && isInteractiveTool;

        // Skip progress line for "done" tool - we show status icon instead
        const isDoneTool = toolName === 'done';

        if (status === 'running') {
          if (!isDoneTool) {
            updatedMsg = addProgressLine(updatedMsg, friendlyName, explanation || friendlyName);
          }
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode, shouldWait);
          }
        } else if (status === 'completed') {
          if (!isDoneTool) {
            updatedMsg = markProgressLineComplete(updatedMsg);
          }
          // When tool completes, revert to 'thinking' state (not waiting)
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode, false);
          }
        } else {
          updatedMsg = markProgressLineFailed(updatedMsg, friendlyName, error || '');
          // On failure, we might also want to revert to thinking or just leave it (likely task will stop soon)
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode, false);
          }
        }

        const newMessages = [...prev.messages];
        newMessages[found.index] = updatedMsg;

        chatService.setMessages(newMessages);
        return { ...prev, messages: newMessages };
      });
    },
    [],
  );

  // WebSocket Setup (skip in preview mode)
  useEffect(() => {
    // Skip WebSocket setup in preview mode - no network connections
    if (previewMode) {
      return;
    }

    const wsClient = StreamClient.getInstance();

    const handleStatusChange = (status: StreamStatus) => {
      setState(prev => ({ ...prev, agentAvailable: status === 'registered' }));
    };

    const handleMessage = async (event: WidgetEvent) => {
      if (event.type === 'tool/call') {
        const requestId = event.call_id;

        // Prevent duplicate processing (React StrictMode can cause duplicate callbacks)
        if (processedRequestIds.current.has(requestId)) return;
        addProcessedRequestId(requestId);

        // Validate tool name is in allowed list (derived from single source of truth)
        const ALLOWED_TOOLS = BROWSER_TOOLS.map(t => t.id);
        if (!ALLOWED_TOOLS.includes(event.tool)) {
          console.warn('[Widget] Unknown tool requested:', event.tool);
          wsClient.send({
            type: 'tool/response',
            call_id: requestId,
            success: false,
            error: `Unknown tool: ${event.tool}`,
            state_version: stateVersion.current,
          });
          return;
        }

        // Reject tool calls when widget is not running a task
        // Use ref to get latest value (avoid stale closure)
        if (!isTaskRunningRef.current) {
          console.warn('[Widget] Tool call received but no task running, rejecting');
          wsClient.send({
            type: 'tool/response',
            call_id: requestId,
            success: false,
            error: 'widget_task_inactive',
            state_version: stateVersion.current,
          });
          return;
        }

        const toolName = event.tool;
        const args = event.args;
        const mode = event.mode || state.currentMode || 'do';
        const explanation = event.explanation || '';
        const requestStateVersion = event.state_version;

        // Check state version FIRST - silently fail if mismatch (no progress shown)
        if (requestStateVersion !== undefined && requestStateVersion !== stateVersion.current) {
          console.log('State version mismatch, skipping tool execution');
          wsClient.send({
            type: 'tool/response',
            call_id: requestId,
            success: false,
            error: 'State version mismatch',
            state_version: stateVersion.current,
          });
          return;
        }

        // Only show progress if we're actually executing
        updateProgressForTool(toolName, explanation, 'running');

        const result = await toolExecutionService.executeTool(toolName, args, mode, explanation);

        if (result.success) {
          try {
            stateVersion.current++;
            wsClient.send({
              type: 'tool/response',
              call_id: requestId,
              success: true,
              data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
              state_version: stateVersion.current,
            });
            updateProgressForTool(toolName, explanation, 'completed');

            // If the "done" tool completed successfully, mark the task as complete
            if (toolName === 'done') {
              taskIdFromApiRef.current = null;
              taskStartedFromAgentRef.current = false;

              setState(prev => {
                chatService.setTaskState(false, null, []);
                isTaskRunningRef.current = false;
                const found = findMessageForProgress({
                  messages: prev.messages,
                  isTaskRunning: prev.isTaskRunning,
                  currentMode: prev.currentMode,
                  preferPlaceholder: true,
                  requireContent: false,
                });
                const newMessages = [...prev.messages];
                if (found) {
                  const updatedParts =
                    found.message.parts?.filter(part => !(part.type === 'progress' && part.toolName === 'done')) || [];
                  newMessages[found.index] = {
                    ...found.message,
                    taskStatus: 'done',
                    parts: updatedParts,
                  };
                  chatService.setMessages(newMessages);
                }
                return {
                  ...prev,
                  messages: newMessages,
                  isTaskRunning: false,
                  activeTaskId: null,
                  taskProgress: [],
                };
              });
            }
          } catch (error) {
            console.error('Failed to send tool result:', error);
            updateProgressForTool(toolName, explanation, 'failed', 'Connection error');
          }
        } else {
          stateVersion.current++;
          try {
            wsClient.send({
              type: 'tool/response',
              call_id: requestId,
              success: false,
              data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
              error: result.error ?? undefined,
              state_version: stateVersion.current,
            });
          } catch (error) {
            console.error('Failed to send tool error:', error);
          }
        }
      } else if (event.type === 'task/status') {
        const status = event.status;
        const statusMessage = event.message || '';

        if (status === 'started') {
          const taskId = event.task_id || null;
          taskStartedFromAgentRef.current = true;

          const finalTaskId = taskIdFromApiRef.current || taskId;
          if (finalTaskId) {
            setState(prev => {
              chatService.setTaskState(true, finalTaskId, []);
              isTaskRunningRef.current = true;
              return {
                ...prev,
                isTaskRunning: true,
                activeTaskId: finalTaskId,
                taskProgress: [],
              };
            });
          }
        } else if (status === 'completed' || status === 'failed' || status === 'stopped') {
          processedRequestIds.current.clear();
          taskIdFromApiRef.current = null;
          taskStartedFromAgentRef.current = false;
          setState(prev => {
            chatService.setTaskState(false, null, []);
            const found = findMessageForProgress({
              messages: prev.messages,
              isTaskRunning: prev.isTaskRunning,
              currentMode: prev.currentMode,
              preferPlaceholder: true,
              requireContent: false,
            });
            const newMessages = [...prev.messages];
            if (found) {
              let taskStatus: 'done' | 'failed' | 'stopped' = 'done';
              if (status === 'failed') taskStatus = 'failed';
              else if (status === 'stopped') taskStatus = 'stopped';
              newMessages[found.index] = {
                ...found.message,
                taskStatus,
                ...(statusMessage && { content: statusMessage }),
              };
              chatService.setMessages(newMessages);
            }
            isTaskRunningRef.current = false;
            return {
              ...prev,
              messages: newMessages,
              isTaskRunning: false,
              activeTaskId: null,
              taskProgress: [],
            };
          });
        }
      } else if (event.type === 'chat/response') {
        // Handle chat response — update the placeholder message matching request_id
        setState(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id === event.request_id) {
              const currentParts = msg.parts || [];
              const newParts = [...currentParts, { type: 'text' as const, content: event.text }];
              return {
                ...msg,
                content: event.text,
                isPlaceholder: false,
                placeholderState: undefined,
                parts: newParts,
                ...(event.task_id && { taskId: event.task_id }),
              };
            }
            return msg;
          });
          chatService.setMessages(newMessages);

          // If task_id present, handle task start handshake
          if (event.task_id) {
            taskIdFromApiRef.current = event.task_id;
            if (taskStartedFromAgentRef.current) {
              chatService.setTaskState(true, event.task_id, []);
              isTaskRunningRef.current = true;
              return {
                ...prev,
                messages: newMessages,
                isTaskRunning: true,
                activeTaskId: event.task_id,
                taskProgress: [],
              };
            }
          }

          return { ...prev, messages: newMessages, isLoading: false };
        });
      } else if (event.type === 'chat/error') {
        // Handle chat error — update the placeholder message matching request_id
        setState(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id === event.request_id) {
              const errorMessage = `Error: ${event.error}`;
              const currentParts = msg.parts || [];
              const newParts = [...currentParts, { type: 'text' as const, content: errorMessage }];
              return {
                ...msg,
                content: errorMessage,
                isPlaceholder: false,
                placeholderState: undefined,
                parts: newParts,
              };
            }
            return msg;
          });
          chatService.setMessages(newMessages);
          return { ...prev, messages: newMessages, isLoading: false };
        });
      }
    };

    const handleError = (error: Error) => {
      setState(prev => ({ ...prev, error: error.message }));
    };

    const callbacks = {
      onStatusChange: handleStatusChange,
      onMessage: handleMessage,
      onError: handleError,
    };

    wsClient.addCallbacks(callbacks);

    return () => {
      wsClient.removeCallbacks(callbacks);
    };
  }, [updateProgressForTool, previewMode]);

  // Action Implementations
  const setTaskState = useCallback(
    (payload: { activeTaskId: string | null; isTaskRunning: boolean; taskProgress?: TaskProgress[] }) => {
      setState(prev => {
        chatService.setTaskState(payload.isTaskRunning, payload.activeTaskId, payload.taskProgress || []);
        return { ...prev, ...payload };
      });
    },
    [],
  );

  const resetState = useCallback(() => {
    chatService.clearMessages();
    // Reset both flags
    taskIdFromApiRef.current = null;
    taskStartedFromAgentRef.current = false;
    isTaskRunningRef.current = false; // Update ref immediately
    setState(prev => ({
      ...prev,
      messages: [],
      isTaskRunning: false,
      activeTaskId: null,
      taskProgress: [],
      error: undefined,
    }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState(prev => {
      chatService.addMessage(message);
      return { ...prev, messages: [...prev.messages, message] };
    });
  }, []);

  // Implement actual sendMessage logic using API service
  const sendMessage = useCallback(
    async (
      content: string,
      mode?: InstructionType,
      applicationId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => {
      // In preview mode, show user message and a preview response (no network)
      if (previewMode) {
        if (!skipUserMessage) {
          const userMsg = createUserMessage(content, mode || state.currentMode);
          addMessage(userMsg);
        }
        // Show preview response
        const previewResponse = createAgentMessage(
          "This is a preview. In production, I'll respond to your messages here.",
        );
        addMessage(previewResponse);
        return;
      }

      // Attempt to reload config if missing (e.g. from localStorage)
      let config = configManager.getConfig();
      if (!config) {
        config = configManager.loadConfig();
      }

      if (!config || (!config.mtxId && !config.mtxKey && !config.mtxAgent)) {
        console.error('Config not loaded or incomplete');
        // We could fallback to throwing error or showing UI error here
        const errorMsg = createAgentMessage(
          'Configuration error: Missing API credentials. Please check your widget settings.',
        );
        addMessage(errorMsg);
        return;
      }

      // Add user message if not skipped
      if (!skipUserMessage) {
        const userMsg = createUserMessage(content, mode || state.currentMode);
        addMessage(userMsg);
      }

      // Create placeholder message
      const placeholderId = `temp-${Date.now()}`;
      const placeholderMsg: ChatMessage = {
        id: placeholderId,
        content: '',
        sender: 'agent',
        timestamp: new Date(),
        mode: mode || state.currentMode,
        isPlaceholder: true,
        placeholderState: 'thinking',
        parts: [],
      };
      // Add thinking marker for the active message logic to work
      placeholderMsg.content = addThinkingMarker('');
      addMessage(placeholderMsg);

      setState(prev => ({ ...prev, isLoading: true }));

      // Send via stream (fire-and-forget — response arrives as chat/response event)
      const apiService = new MarketrixApiService(config);
      try {
        // Override config if applicationId is provided (for chips with specific connection)
        if (applicationId) {
          apiService.updateConfig({ mtxApp: applicationId });
        }

        // Ensure stream is connected before sending
        const chatId = apiService.getChatId();
        if (chatId) {
          const streamClient = StreamClient.getInstance();
          if (!streamClient.isConnected()) {
            const streamConfig = configManager.getConfig();
            streamClient
              .connect(
                chatId,
                streamConfig
                  ? {
                      mtxId: streamConfig.mtxId,
                      mtxKey: streamConfig.mtxKey,
                      mtxAgent: streamConfig.mtxAgent,
                      mtxApp: streamConfig.mtxApp,
                    }
                  : undefined,
              )
              .catch(err => console.error('Stream connection failed:', err));
          }
        }

        await apiService.sendMessage({
          message: content,
          mode: mode || state.currentMode,
          question, // Pass question context if available (e.g. from chips)
          requestId: placeholderId, // Use placeholder ID as request_id so chat/response matches immediately
        });

        // Placeholder stays in "thinking" state until chat/response arrives via stream
      } catch (error) {
        console.error('Failed to send message:', error);

        // Update placeholder to show error
        setState(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id === placeholderId) {
              const errorMessage = "I'm sorry, I encountered an error processing your request. Please try again.";
              const currentParts = msg.parts || [];
              const newParts = [...currentParts, { type: 'text' as const, content: errorMessage }];

              return {
                ...msg,
                isPlaceholder: false,
                parts: newParts,
                content: errorMessage,
              };
            }
            return msg;
          });

          chatService.setMessages(newMessages);
          return { ...prev, messages: newMessages };
        });
      } finally {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    },
    [state.currentMode, addMessage, setTaskState, state, previewMode],
  );

  const actions = useMemo(
    () => ({
      setState: (payload: Partial<WidgetState>) => setState(prev => ({ ...prev, ...payload })),
      toggleWidget: () =>
        setState(prev => {
          const newState = {
            ...prev,
            isOpen: !prev.isOpen,
            isMinimized: !prev.isOpen ? false : true,
          };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),
      closeWidget: () =>
        setState(prev => {
          const newState = { ...prev, isOpen: false, isMinimized: true };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),
      setMode: (mode: InstructionType) =>
        setState(prev => {
          chatService.setMode(mode);
          return { ...prev, currentMode: mode };
        }),
      setLoading: (loading: boolean) => {
        chatService.setIsLoading(loading);
        setState(prev => ({ ...prev, isLoading: loading }));
      },
      setAgentAvailable: (available: boolean) => setState(prev => ({ ...prev, agentAvailable: available })),
      setError: (error: string | undefined) => setState(prev => ({ ...prev, error })),
      clearError: () => setState(prev => ({ ...prev, error: undefined })),
      setTaskState,
      addMessage,
      updateMessage: (messageId: string, updates: Partial<ChatMessage>) =>
        setState(prev => {
          chatService.updateMessage(messageId, updates);
          return {
            ...prev,
            messages: prev.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg)),
          };
        }),
      removeMessage: (messageId: string) =>
        setState(prev => {
          chatService.removeMessage(messageId);
          return { ...prev, messages: prev.messages.filter(msg => msg.id !== messageId) };
        }),
      setMessages: (messages: ChatMessage[]) =>
        setState(prev => {
          chatService.setMessages(messages);
          return { ...prev, messages };
        }),
      resetState,
      stopTask: async () => {
        // Capture taskId from ref (always current) instead of stale closure
        const taskId = state.activeTaskId || isTaskRunningRef.current ? (state.activeTaskId ?? undefined) : undefined;
        setState(prev => {
          // Find the task message and update its taskStatus
          const found = findMessageForProgress({
            messages: prev.messages,
            isTaskRunning: prev.isTaskRunning,
            currentMode: prev.currentMode,
            preferPlaceholder: true,
            requireContent: false,
          });
          const newMessages = [...prev.messages];
          if (found) {
            newMessages[found.index] = {
              ...found.message,
              taskStatus: 'stopped',
            };
            if (!previewMode) {
              chatService.setMessages(newMessages);
            }
          }
          if (!previewMode) {
            chatService.setTaskState(false, null, []);
          }
          // Only reset isTaskRunning state; leave handshake refs intact
          // so subsequent task starts can still complete the API+WS handshake.
          isTaskRunningRef.current = false;
          return {
            ...prev,
            messages: newMessages,
            isTaskRunning: false,
            activeTaskId: null,
            taskProgress: [],
          };
        });

        // Skip API call in preview mode
        if (previewMode) {
          return;
        }

        try {
          const wsClient = StreamClient.getInstance();
          wsClient.send({ type: 'chat/stop' as const, ...(taskId && { task_id: taskId }) });
        } catch (error) {
          console.error('Failed to stop task remotely:', error);
        }
      },
      clearChatHistory: resetState,
      sendMessage,
    }),
    [state.currentMode, setTaskState, resetState, addMessage, sendMessage, previewMode],
  );

  return <WidgetContext.Provider value={{ state, actions }}>{children}</WidgetContext.Provider>;
};

export const useWidgetContext = () => {
  const context = useContext(WidgetContext);
  if (context === undefined) {
    throw new Error('useWidgetContext must be used within a WidgetProvider');
  }
  return context;
};
