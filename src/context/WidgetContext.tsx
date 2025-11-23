import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { chatIdManager } from '../services/chatIdManager';
import { MarketrixApiService } from '../services/communication/marketrixApiService';
import { configManager } from '../services/core/ConfigManager';
import {
  WebSocketClient,
  type WebSocketMessage,
  type WebSocketStatus,
} from '../services/core/WebSocketClient';
import { chatService } from '../services/features/ChatService';
import { toolExecutionService } from '../services/features/ToolExecutionService';
import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';
import { findMessageForProgress } from '../utils/messageFinder';
import {
  addProgressLine,
  markProgressLineComplete,
  markProgressLineFailed,
  updateThinkingMarker,
} from '../utils/progressLineManager';
import { getFriendlyToolName } from '../utils/toolNames';

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
    stopTask: () => void;
    clearChatHistory: () => void;
    sendMessage: (
      content: string,
      mode?: InstructionType,
      connectionId?: number,
      question?: string,
      skipUserMessage?: boolean
    ) => Promise<void>;
  };
}

interface ToolCallParams {
  name?: string;
  arguments?: Record<string, unknown>;
  mode?: string;
  explanation?: string;
}

const WidgetContext = createContext<WidgetContextType | undefined>(undefined);

export const WidgetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
    chatService.initialize(null);
    setState((prev) => ({
      ...prev,
      messages: chatService.getMessages(),
    }));

    // Connect WebSocket if chat ID exists
    const chatId = chatIdManager.getChatId();
    if (chatId) {
      const wsClient = WebSocketClient.getInstance(configManager.getConfig() || undefined);
      wsClient
        .connect(chatId)
        .catch((err) => console.error('Initial WebSocket connection failed:', err));
    }
  }, []);

  // Helper to update progress
  const updateProgressForTool = useCallback(
    (
      toolName: string,
      explanation: string,
      status: 'running' | 'completed' | 'failed',
      error?: string
    ) => {
      setState((prev) => {
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
        if (status === 'running') {
          updatedMsg = addProgressLine(
            updatedMsg,
            friendlyName,
            explanation || `Executing ${friendlyName}...`
          );
          if (prev.isTaskRunning && (prev.currentMode === 'show' || prev.currentMode === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, prev.isTaskRunning, prev.currentMode);
          }
        } else if (status === 'completed') {
          updatedMsg = markProgressLineComplete(updatedMsg);
        } else {
          updatedMsg = markProgressLineFailed(updatedMsg, friendlyName, error || '');
        }

        const newMessages = [...prev.messages];
        newMessages[found.index] = updatedMsg;

        chatService.setMessages(newMessages);
        return { ...prev, messages: newMessages };
      });
    },
    []
  );

  // WebSocket Setup
  useEffect(() => {
    const wsClient = WebSocketClient.getInstance(configManager.getConfig() || undefined);

    const handleStatusChange = (status: WebSocketStatus) => {
      setState((prev) => ({ ...prev, agentAvailable: status === 'registered' }));
    };

    const handleMessage = async (message: WebSocketMessage) => {
      if (message.method === 'tools/call') {
        const params = message.params as ToolCallParams;
        const toolName = params?.name || 'unknown';
        const args = params?.arguments || {};
        const mode = params?.mode || 'do';
        const explanation = params?.explanation || '';
        const requestId = message.id;

        updateProgressForTool(toolName, explanation, 'running');

        const result = await toolExecutionService.executeTool(toolName, args, mode, explanation);

        if (result.success) {
          wsClient.send({
            jsonrpc: '2.0',
            method: 'tools/call',
            id: requestId,
            result: { content: [{ type: 'text', text: result.result }] },
          });
          updateProgressForTool(toolName, explanation, 'completed');
        } else {
          wsClient.send({
            jsonrpc: '2.0',
            method: 'tools/call',
            id: requestId,
            error: { code: -32603, message: result.error || 'Unknown error' },
          });
          updateProgressForTool(toolName, explanation, 'failed', result.error);
        }
      } else if (message.method === 'task_status') {
        // Handle task status updates if needed
      }
    };

    const handleError = (error: Error) => {
      setState((prev) => ({ ...prev, error: error.message }));
    };

    wsClient.addCallbacks({
      onStatusChange: handleStatusChange,
      onMessage: handleMessage,
      onError: handleError,
    });

    return () => {
      wsClient.removeCallbacks({
        onStatusChange: handleStatusChange,
        onMessage: handleMessage,
        onError: handleError,
      });
    };
  }, [updateProgressForTool]);

  // Action Implementations
  const setTaskState = useCallback(
    (payload: {
      activeTaskId: string | null;
      isTaskRunning: boolean;
      taskProgress?: TaskProgress[];
    }) => {
      setState((prev) => {
        chatService.setTaskState(
          payload.isTaskRunning,
          payload.activeTaskId,
          payload.taskProgress || []
        );
        return { ...prev, ...payload };
      });
    },
    []
  );

  const resetState = useCallback(() => {
    chatService.clearMessages();
    setState((prev) => ({
      ...prev,
      messages: [],
      isTaskRunning: false,
      activeTaskId: null,
      taskProgress: [],
      error: undefined,
    }));
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setState((prev) => {
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
      skipUserMessage?: boolean
    ) => {
      const config = configManager.getConfig();
      if (!config) {
        console.error('Config not loaded');
        return;
      }

      // Add user message if not skipped
      if (!skipUserMessage) {
        const userMsg = chatService.createUserMessage(content, mode || state.currentMode);
        addMessage(userMsg);
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      // Send to API
      const apiService = new MarketrixApiService(config);
      try {
        // Prepare request
        // Note: connectionId and question can be passed if the API service supports it in config overrides
        // But the current MarketrixApiService takes config in constructor.
        // We might need to merge connectionId into config if it overrides default?
        // Or just pass it in request body if supported.
        // Current MarketrixApiService sendMessage uses config credentials.

        // Override config if connectionId is provided (for chips with specific connection)
        if (connectionId) {
          apiService.updateConfig({ connectionId });
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
            wsClient
              .connect(chatId)
              .catch((err) => console.error('WebSocket connection failed:', err));
          }
        }

        // Add agent response
        const agentMsg = chatService.createAgentMessage(
          response.response,
          response.mode,
          response.messageId
        );
        addMessage(agentMsg);

        // If task started (task_id present), update state
        if (response.task_id) {
          setTaskState({
            activeTaskId: response.task_id,
            isTaskRunning: true,
            taskProgress: [],
          });
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        const errorMsg = chatService.createAgentMessage(
          "I'm sorry, I encountered an error processing your request. Please try again."
        );
        addMessage(errorMsg);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [state.currentMode, addMessage, setTaskState, state]
  );

  const actions = useMemo(
    () => ({
      setState: (payload: Partial<WidgetState>) => setState((prev) => ({ ...prev, ...payload })),
      toggleWidget: () =>
        setState((prev) => {
          const newState = {
            ...prev,
            isOpen: !prev.isOpen,
            isMinimized: !prev.isOpen ? false : true,
          };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),
      closeWidget: () =>
        setState((prev) => {
          const newState = { ...prev, isOpen: false, isMinimized: true };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),
      setMode: (mode: InstructionType) =>
        setState((prev) => {
          chatService.setMode(mode);
          return { ...prev, currentMode: mode };
        }),
      setLoading: (loading: boolean) => setState((prev) => ({ ...prev, isLoading: loading })),
      setAgentAvailable: (available: boolean) =>
        setState((prev) => ({ ...prev, agentAvailable: available })),
      setError: (error: string | undefined) => setState((prev) => ({ ...prev, error })),
      clearError: () => setState((prev) => ({ ...prev, error: undefined })),
      setTaskState,
      addMessage,
      updateMessage: (messageId: string, updates: Partial<ChatMessage>) =>
        setState((prev) => {
          chatService.updateMessage(messageId, updates);
          return {
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          };
        }),
      removeMessage: (messageId: string) =>
        setState((prev) => {
          chatService.removeMessage(messageId);
          return { ...prev, messages: prev.messages.filter((msg) => msg.id !== messageId) };
        }),
      setMessages: (messages: ChatMessage[]) =>
        setState((prev) => {
          chatService.setMessages(messages);
          return { ...prev, messages };
        }),
      resetState,
      stopTask: () => {
        setTaskState({ isTaskRunning: false, activeTaskId: null });
      },
      clearChatHistory: resetState,
      sendMessage,
    }),
    [state.currentMode, setTaskState, resetState, addMessage, sendMessage]
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
