import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { ApiService } from '../services/ApiService';
import { createAgentMessage, createUserMessage } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { StreamClient } from '../services/StreamClient';
import type { ChatMessage, InstructionType } from '../types';
import { addThinkingMarker } from '../utils/chat';
import type { UIStateActions } from './UIStateContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatState {
  messages: ChatMessage[];
}

export interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  sendMessage: (
    content: string,
    mode?: InstructionType,
    applicationId?: number,
    question?: string,
    skipUserMessage?: boolean,
  ) => Promise<void>;
}

interface ChatContextType {
  chatState: ChatState;
  chatActions: ChatActions;
  /** Expose the raw setState so TaskContext can mutate messages from SSE events. */
  _setMessages: React.Dispatch<React.SetStateAction<ChatState>>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ChatProviderProps {
  children: React.ReactNode;
  previewMode?: boolean;
  /** Injected from WidgetProviders so ChatProvider can call setLoading without nesting contexts. */
  uiActions: Pick<UIStateActions, 'setLoading'>;
  /** The current mode from UIState, used as fallback when no explicit mode is passed. */
  currentMode: InstructionType;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  previewMode = false,
  uiActions,
  currentMode,
}) => {
  const [chatState, setChatState] = useState<ChatState>({ messages: [] });

  // Stable ref so sendMessage closure doesn't stale-capture currentMode
  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;

  const addMessage = useCallback((message: ChatMessage) => {
    setChatState(prev => ({ messages: [...prev.messages, message] }));
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ChatMessage>) => {
    setChatState(prev => ({
      messages: prev.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg)),
    }));
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setChatState(prev => ({ messages: prev.messages.filter(msg => msg.id !== messageId) }));
  }, []);

  const setMessages = useCallback((messages: ChatMessage[]) => {
    setChatState({ messages });
  }, []);

  const clearMessages = useCallback(() => {
    setChatState({ messages: [] });
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      mode?: InstructionType,
      applicationId?: number,
      question?: string,
      skipUserMessage?: boolean,
    ) => {
      const effectiveMode = mode ?? currentModeRef.current;

      // Preview mode: synthetic response, no network
      if (previewMode) {
        if (!skipUserMessage) {
          addMessage(createUserMessage(content, effectiveMode));
        }
        addMessage(createAgentMessage("This is a preview. In production, I'll respond to your messages here."));
        return;
      }

      let config = configManager.getConfig();
      if (!config) config = configManager.loadConfig();

      if (!config || (!config.mtxId && !config.mtxKey && !config.mtxAgent)) {
        console.error('Config not loaded or incomplete');
        addMessage(
          createAgentMessage('Configuration error: Missing API credentials. Please check your widget settings.'),
        );
        return;
      }

      if (!skipUserMessage) {
        addMessage(createUserMessage(content, effectiveMode));
      }

      // Create thinking placeholder
      const placeholderId = `temp-${globalThis.crypto.randomUUID()}`;
      const placeholderMsg: ChatMessage = {
        id: placeholderId,
        content: addThinkingMarker(''),
        sender: 'agent',
        timestamp: new Date(),
        mode: effectiveMode,
        isPlaceholder: true,
        placeholderState: 'thinking',
        parts: [],
      };
      addMessage(placeholderMsg);
      uiActions.setLoading(true);

      const apiService = new ApiService(config);
      try {
        if (applicationId) {
          apiService.updateConfig({ mtxApp: applicationId });
        }

        const chatId = apiService.getChatId();
        if (chatId) {
          const streamClient = StreamClient.getInstance();
          if (!streamClient.isConnected()) {
            const streamConfig = configManager.getConfig();
            try {
              await streamClient.connect(
                chatId,
                streamConfig
                  ? {
                      mtxId: streamConfig.mtxId,
                      mtxKey: streamConfig.mtxKey,
                      mtxAgent: streamConfig.mtxAgent,
                      mtxApp: streamConfig.mtxApp,
                    }
                  : undefined,
              );
            } catch (err) {
              console.error('Stream connection failed:', err);
            }
          }
        }

        await apiService.sendMessage({
          message: content,
          mode: effectiveMode,
          question,
          requestId: placeholderId,
        });
        // Response arrives via SSE in TaskContext; placeholder stays "thinking"
      } catch (error) {
        console.error('Failed to send message:', error);
        setChatState(prev => {
          const errorMessage = "I'm sorry, I encountered an error processing your request. Please try again.";
          const newMessages = prev.messages.map(msg => {
            if (msg.id !== placeholderId) return msg;
            const newParts = [...(msg.parts ?? []), { type: 'text' as const, content: errorMessage }];
            return { ...msg, isPlaceholder: false, parts: newParts, content: errorMessage };
          });
          return { messages: newMessages };
        });
      } finally {
        uiActions.setLoading(false);
      }
    },
    [previewMode, addMessage, uiActions],
  );

  const chatActions = useMemo<ChatActions>(
    () => ({ addMessage, updateMessage, removeMessage, setMessages, clearMessages, sendMessage }),
    [addMessage, updateMessage, removeMessage, setMessages, clearMessages, sendMessage],
  );

  return (
    <ChatContext.Provider value={{ chatState, chatActions, _setMessages: setChatState }}>
      {children}
    </ChatContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useChatContext = (): Omit<ChatContextType, '_setMessages'> => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};

/** Internal hook — only WidgetProviders should use this. */
export const useChatContextInternal = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContextInternal must be used within ChatProvider');
  return ctx;
};
