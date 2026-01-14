import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { MarketrixApiService } from '../services/ApiService';
import { chatService, createAgentMessage, createUserMessage } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { sessionManager } from '../services/SessionManager';
import { toolExecutionService } from '../services/ToolService';
import { WebSocketClient, type WebSocketMessage, type WebSocketStatus } from '../services/WebSocketClient';
import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';
import { isToolRequest, type ToolRequest, type ToolResponse } from '../types/toolMessages';
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
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => Promise<void>;
  };
}

// Tool call types are now imported from toolMessages.ts

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stateVersion = useRef(0);

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

  // Initialize ChatService on mount
  useEffect(() => {
    const initChat = async () => {
      const chatId = await sessionManager.getOrCreateChatId();

      chatService.createInitialContext(chatId);

      chatService.initialize(chatId);
      setState(prev => ({
        ...prev,
        messages: chatService.getMessages(),
        isLoading: chatService.getIsLoading(),
        isTaskRunning: chatService.getIsTaskRunning(),
        activeTaskId: chatService.getActiveTaskId(),
        taskProgress: chatService.getTaskProgress(),
        currentMode: chatService.getCurrentMode(),
        isOpen: chatService.getIsOpen(),
        isMinimized: chatService.getIsMinimized(),
      }));

      // Connect WebSocket if chat ID exists
      if (chatId) {
        // Ensure config is loaded before initializing WebSocket
        const config = configManager.getConfig();
        if (config) {
          const wsClient = WebSocketClient.getInstance(config);
          wsClient.connect(chatId).catch((err: unknown) => console.error('Initial WebSocket connection failed:', err));
        }
      }
    };
    initChat();
  }, []);

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

  // WebSocket Setup
  useEffect(() => {
    // Ensure config is loaded before initializing WebSocket
    const config = configManager.getConfig();
    const wsClient = WebSocketClient.getInstance(config || undefined);

    const handleStatusChange = (status: WebSocketStatus) => {
      setState(prev => ({ ...prev, agentAvailable: status === 'registered' }));
    };

    const handleMessage = async (message: WebSocketMessage) => {
      if (isToolRequest(message as Record<string, unknown>)) {
        const request = message as ToolRequest;
        const toolName = request.tool;
        const args = request.args;
        const mode = request.mode || state.currentMode || 'do';
        const explanation = request.explanation || '';
        const requestId = request.id;
        const requestStateVersion = request.stateVersion;

        updateProgressForTool(toolName, explanation, 'running');

        if (requestStateVersion !== stateVersion.current) {
          console.log('State version mismatch, skipping tool execution');
          const response: ToolResponse = {
            id: requestId,
            success: false,
            data: { text: '' },
            error: 'State version mismatch',
            stateVersion: stateVersion.current,
          };
          wsClient.send(response as unknown as WebSocketMessage);
          updateProgressForTool(toolName, explanation, 'failed', 'State version mismatch');
          return;
        }

        const result = await toolExecutionService.executeTool(toolName, args, mode, explanation);

        if (result.success) {
          try {
            stateVersion.current++;
            const response: ToolResponse<unknown> = {
              id: requestId,
              success: result.success,
              data: result.data,
              error: result.error ?? null,
              stateVersion: stateVersion.current,
            };
            wsClient.send(response as unknown as WebSocketMessage);
            updateProgressForTool(toolName, explanation, 'completed');
            // If the "done" tool completed successfully, mark the task as complete
            if (toolName === 'done' && result.success) {
              setState(prev => {
                chatService.setTaskState(false, null, []);
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
                  // Remove any "done" progress lines since we show icon instead
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
            // Even if send fails, we mark as completed locally so UI doesn't hang?
            // Or failed? If agent doesn't get it, task is stuck.
            updateProgressForTool(toolName, explanation, 'failed', 'Connection error');
            // If this is a critical connection error and task is running, mark as failed
            if (state.isTaskRunning) {
              setState(prev => {
                const found = findMessageForProgress({
                  messages: prev.messages,
                  isTaskRunning: prev.isTaskRunning,
                  currentMode: prev.currentMode,
                  preferPlaceholder: true,
                  requireContent: false,
                });
                const newMessages = [...prev.messages];
                if (found && found.message.taskStatus !== 'done' && found.message.taskStatus !== 'stopped') {
                  newMessages[found.index] = {
                    ...found.message,
                    taskStatus: 'failed',
                  };
                  chatService.setMessages(newMessages);
                }
                return { ...prev, messages: newMessages };
              });
            }
          }
        } else {
          try {
            const response: ToolResponse<unknown> = {
              id: requestId,
              success: false,
              data: result.data,
              error: result.error ?? null,
              stateVersion: stateVersion.current,
            };
            wsClient.send(response as unknown as WebSocketMessage);
          } catch (error) {
            console.error('Failed to send tool error:', error);
          }
          updateProgressForTool(toolName, explanation, 'failed', result.error);
        }
      } else if (message.method === 'task/status') {
        // Handle task status updates (completed, failed, stopped)
        const params = message.params as { status: string; message?: string; timestamp?: string };
        const status = params?.status;
        const statusMessage = params?.message || '';

        if (status === 'completed' || status === 'failed' || status === 'stopped') {
          setState(prev => {
            chatService.setTaskState(false, null, []);
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
              // Map status to taskStatus
              let taskStatus: 'done' | 'failed' | 'stopped' = 'done';
              if (status === 'failed') taskStatus = 'failed';
              else if (status === 'stopped') taskStatus = 'stopped';

              newMessages[found.index] = {
                ...found.message,
                taskStatus,
                // Add status message if provided
                ...(statusMessage && { content: statusMessage }),
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
  }, [updateProgressForTool]);

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
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => {
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

      // Send to API
      const apiService = new MarketrixApiService(config);
      try {
        // Override config if connectionId is provided (for chips with specific connection)
        if (connectionId) {
          apiService.updateConfig({ mtxApp: connectionId });
        }

        const response = await apiService.sendMessage({
          message: content,
          mode: mode || state.currentMode,
          question, // Pass question context if available (e.g. from chips)
        });

        // Connect WebSocket if not connected
        const chatId = apiService.getChatId();
        if (chatId) {
          const wsClient = WebSocketClient.getInstance(config);
          if (!wsClient.isConnected()) {
            wsClient.connect(chatId).catch(err => console.error('WebSocket connection failed:', err));
          }
        }

        // Update placeholder with final response
        setState(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id === placeholderId) {
              const currentParts = msg.parts || [];
              // Append response as a text part
              const newParts = [...currentParts, { type: 'text' as const, content: response.response }];

              return {
                ...msg,
                id: response.messageId, // Update to real ID
                content: response.response,
                mode: response.mode,
                timestamp: response.timestamp,
                isPlaceholder: false,
                placeholderState: undefined,
                parts: newParts,
              };
            }
            return msg;
          });

          chatService.setMessages(newMessages);
          return { ...prev, messages: newMessages };
        });

        // If task started (task_id present), update state
        if (response.task_id) {
          setState(prev => {
            // Find the placeholder message and set taskStatus to 'ongoing'
            const placeholderIndex = prev.messages.findIndex(msg => msg.id === placeholderId);
            const newMessages = [...prev.messages];
            if (placeholderIndex >= 0) {
              newMessages[placeholderIndex] = {
                ...newMessages[placeholderIndex],
                taskStatus: 'ongoing',
              };
              chatService.setMessages(newMessages);
            }
            chatService.setTaskState(true, response.task_id || null, []);
            return {
              ...prev,
              messages: newMessages,
              activeTaskId: response.task_id || null,
              isTaskRunning: true,
              taskProgress: [],
            };
          });
        }
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
    [state.currentMode, addMessage, setTaskState, state],
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
        const taskId = state.activeTaskId;
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
            chatService.setMessages(newMessages);
          }
          chatService.setTaskState(false, null, []);
          return {
            ...prev,
            messages: newMessages,
            isTaskRunning: false,
            activeTaskId: null,
            taskProgress: [],
          };
        });

        // Attempt to reload config if missing
        let config = configManager.getConfig();
        if (!config) {
          config = configManager.loadConfig();
        }

        if (config) {
          try {
            const apiService = new MarketrixApiService(config);
            await apiService.stopTask(taskId || undefined);
          } catch (error) {
            console.error('Failed to stop task remotely:', error);
          }
        }
      },
      clearChatHistory: resetState,
      sendMessage,
    }),
    [state.currentMode, setTaskState, resetState, addMessage, sendMessage],
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
