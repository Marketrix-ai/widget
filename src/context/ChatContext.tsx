import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { WidgetEvent } from '../sdk';
import { messageDispatch as dispatchMessage } from '../services/ApiService';
import { browserToolService } from '../services/BrowserToolService';
import { createAgentMessage, createUserMessage } from '../services/ChatService';
import { storageService } from '../services/StorageService';
import { StreamClient, type StreamStatus } from '../services/StreamClient';
import type { ChatMessage, InstructionType } from '../types';
import { addThinkingMarker, BROWSER_TOOLS } from '../utils/chat';
import { reduceSse, reduceStop, reduceToolDone, reduceToolProgress, type SseEffect, type SseState } from './sseReducer';
import type { UIStateActions } from './UIStateContext';

// messages + task share one committed state so they can't tear across an await.

export interface TaskState {
  activeTaskId: string | null;
  isTaskRunning: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
}

export interface ChatActions {
  addMessage: (message: ChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (messageId: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  messageDispatch: (content: string, mode?: InstructionType, skipUserMessage?: boolean) => Promise<void>;
}

export interface TaskActions {
  setTaskState: (payload: { activeTaskId: string | null; isTaskRunning: boolean }) => void;
  stopTask: () => Promise<void>;
}

interface ChatContextType {
  chatState: ChatState;
  chatActions: ChatActions;
  taskState: TaskState;
  taskActions: TaskActions;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const EMPTY_TASK: TaskState = { activeTaskId: null, isTaskRunning: false };

interface ChatProviderProps {
  children: React.ReactNode;
  previewMode?: boolean;
  currentMode: InstructionType;
  uiActions: Pick<UIStateActions, 'setLoading' | 'setAgentAvailable' | 'setError'>;
  initialMessages?: ChatMessage[];
  initialTask?: TaskState;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  previewMode = false,
  currentMode,
  uiActions,
  initialMessages,
  initialTask,
}) => {
  const [state, setState] = useState<SseState>(() => ({
    messages: initialMessages ?? [],
    task: initialTask ?? EMPTY_TASK,
  }));

  // commit() is the ONLY writer — re-syncing from render could regress the ref between a commit and its paint.
  const stateRef = useRef<SseState>(state);

  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;

  const processedRequestIds = useRef(new Set<string>());
  const pendingTaskRef = useRef<{ apiTaskId?: string; agentRunning?: boolean }>({});

  // Transition runs synchronously here, not in a setState updater: React defers updaters (background tab, mid-burst) and captured effects are lost — tool calls that never execute.
  const commit = useCallback((transition: (s: SseState) => SseState) => {
    const prev = stateRef.current;
    const next = transition(prev);
    if (next === prev || (next.messages === prev.messages && next.task === prev.task)) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const addMessage = useCallback(
    (message: ChatMessage) => {
      commit(s => ({ ...s, messages: [...s.messages, message] }));
    },
    [commit],
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      commit(s => ({
        ...s,
        messages: s.messages.map(msg => (msg.id === messageId ? { ...msg, ...updates } : msg)),
      }));
    },
    [commit],
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      commit(s => ({ ...s, messages: s.messages.filter(msg => msg.id !== messageId) }));
    },
    [commit],
  );

  const setMessages = useCallback(
    (messages: ChatMessage[]) => {
      commit(s => ({ ...s, messages }));
    },
    [commit],
  );

  const clearMessages = useCallback(() => {
    commit(s => ({ ...s, messages: [] }));
  }, [commit]);

  const setTaskState = useCallback(
    (payload: { activeTaskId: string | null; isTaskRunning: boolean }) => {
      commit(s => ({
        ...s,
        task: { activeTaskId: payload.activeTaskId, isTaskRunning: payload.isTaskRunning },
      }));
    },
    [commit],
  );

  const messageDispatch = useCallback(
    async (content: string, mode?: InstructionType, skipUserMessage?: boolean) => {
      const effectiveMode = mode ?? currentModeRef.current;

      if (previewMode) {
        if (!skipUserMessage) {
          addMessage(createUserMessage(content, effectiveMode));
        }
        addMessage(createAgentMessage("This is a preview. In production, I'll respond to your messages here."));
        return;
      }

      const config = storageService.getConfig();

      if (!config || (!config.mtxId && !config.mtxKey && !config.mtxApp)) {
        console.error('Config not loaded or incomplete');
        addMessage(
          createAgentMessage('Configuration error: Missing API credentials. Please check your widget settings.'),
        );
        return;
      }

      if (!skipUserMessage) {
        addMessage(createUserMessage(content, effectiveMode));
      }

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

      try {
        const chatId = storageService.getChatId();
        const streamClient = StreamClient.getInstance();
        if (chatId && !streamClient.isConnected()) {
          await streamClient.connect(chatId).catch(err => console.error('Stream connection failed:', err));
        }

        await dispatchMessage(config, {
          message: content,
          mode: effectiveMode,
          requestId: placeholderId,
        });
        // Response arrives via SSE; placeholder stays "thinking"
      } catch (error) {
        console.error('Failed to send message:', error);
        commit(s => {
          const errorMessage = "I'm sorry, I encountered an error processing your request. Please try again.";
          const newMessages = s.messages.map(msg => {
            if (msg.id !== placeholderId) return msg;
            const newParts = [...(msg.parts ?? []), { type: 'text' as const, content: errorMessage }];
            return { ...msg, isPlaceholder: false, parts: newParts, content: errorMessage };
          });
          return { ...s, messages: newMessages };
        });
      } finally {
        uiActions.setLoading(false);
      }
    },
    [previewMode, addMessage, commit, uiActions],
  );

  const MAX_PROCESSED_IDS = 1000;

  const addProcessedRequestId = useCallback((requestId: string) => {
    processedRequestIds.current.add(requestId);
    if (processedRequestIds.current.size > MAX_PROCESSED_IDS) {
      const entries = Array.from(processedRequestIds.current);
      processedRequestIds.current = new Set(entries.slice(-MAX_PROCESSED_IDS / 2));
    }
  }, []);

  const maybeActivateTask = useCallback(() => {
    const p = pendingTaskRef.current;
    if (p.apiTaskId && p.agentRunning) {
      const taskId = p.apiTaskId;
      pendingTaskRef.current = {};
      commit(s => ({ ...s, task: { isTaskRunning: true, activeTaskId: taskId } }));
    }
  }, [commit]);

  useEffect(() => {
    if (previewMode) return;

    const wsClient = StreamClient.getInstance();

    const handleStatusChange = (status: StreamStatus) => {
      uiActions.setAgentAvailable(status === 'registered');
    };

    const runEffects = (effects: SseEffect[]) => {
      for (const effect of effects) {
        if (effect.type === 'setLoading') {
          uiActions.setLoading(effect.value);
        }
      }
    };

    const executeToolCall = async (effect: Extract<SseEffect, { type: 'executeTool' }>) => {
      const { toolCallId, tool, args, mode, explanation } = effect;
      const result = await browserToolService.executeTool(tool, args, mode, explanation);

      if (result.success) {
        try {
          wsClient
            .send({
              type: 'tool/response',
              tool_call_id: toolCallId,
              success: true,
              data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
            })
            .catch(err => console.error('Failed to send tool success response:', err));
          commit(s => reduceToolProgress(s, tool, explanation, 'completed', currentModeRef.current));

          if (tool === 'done') {
            pendingTaskRef.current = {};
            commit(s => reduceToolDone(s, currentModeRef.current));
          }
        } catch (error) {
          console.error('Failed to send tool result:', error);
          commit(s => reduceToolProgress(s, tool, explanation, 'failed', currentModeRef.current, 'Connection error'));
        }
      } else {
        commit(s =>
          reduceToolProgress(
            s,
            tool,
            explanation,
            'failed',
            currentModeRef.current,
            result.error || 'Tool execution failed',
          ),
        );
        wsClient
          .send({
            type: 'tool/response',
            tool_call_id: toolCallId,
            success: false,
            data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
            error: result.error ?? undefined,
          })
          .catch(err => console.error('Failed to send tool error response:', err));
      }
    };

    const handleMessage = async (event: WidgetEvent) => {
      // Transport bookkeeping that must run before the pure reducer.
      if (event.type === 'tool/call') {
        const requestId = event.tool_call_id;
        if (processedRequestIds.current.has(requestId)) return;
        addProcessedRequestId(requestId);

        if (!BROWSER_TOOLS.has(event.browser_tool)) {
          console.warn('[Widget] Unknown tool requested:', event.browser_tool);
          wsClient
            .send({
              type: 'tool/response',
              tool_call_id: requestId,
              success: false,
              error: `Unknown tool: ${event.browser_tool}`,
            })
            .catch(err => console.error('Failed to send unknown-tool response:', err));
          return;
        }

        if (!stateRef.current.task.isTaskRunning) {
          console.log('[Widget] Tool call received before task/status running — auto-activating task');
        }
      } else if (
        event.type === 'task/status' &&
        (event.status === 'completed' || event.status === 'failed' || event.status === 'stopped')
      ) {
        processedRequestIds.current.clear();
        pendingTaskRef.current = {};
      } else if (event.type === 'task/status' && event.status === 'has_question') {
        pendingTaskRef.current = {};
      } else if (event.type === 'task/status' && event.status === 'running') {
        pendingTaskRef.current = {
          ...pendingTaskRef.current,
          agentRunning: true,
          apiTaskId: pendingTaskRef.current.apiTaskId || event.task_id || undefined,
        };
        maybeActivateTask();
        return;
      }

      let effects: SseEffect[] = [];
      commit(state => {
        const result = reduceSse(state, event, currentModeRef.current);
        effects = result.effects;
        return result.state;
      });
      runEffects(effects);

      const toolCall = effects.find(e => e.type === 'executeTool');
      if (toolCall?.type === 'executeTool') {
        await executeToolCall(toolCall);
      }
    };

    const handleError = (error: Error) => {
      uiActions.setError(error.message);
    };

    const callbacks = { onStatusChange: handleStatusChange, onMessage: handleMessage, onError: handleError };
    wsClient.addCallbacks(callbacks);

    return () => {
      wsClient.removeCallbacks(callbacks);
    };
  }, [previewMode, commit, maybeActivateTask, addProcessedRequestId, uiActions]);

  const stopTask = useCallback(async () => {
    const taskId = stateRef.current.task.activeTaskId ?? undefined;
    commit(s => reduceStop(s, currentModeRef.current));

    if (previewMode) return;

    StreamClient.getInstance()
      .send({ type: 'chat/stop' as const, ...(taskId && { task_id: taskId }) })
      .catch(err => console.error('Failed to stop task remotely:', err));
  }, [previewMode, commit]);

  const chatActions = useMemo<ChatActions>(
    () => ({ addMessage, updateMessage, removeMessage, setMessages, clearMessages, messageDispatch }),
    [addMessage, updateMessage, removeMessage, setMessages, clearMessages, messageDispatch],
  );

  const taskActions = useMemo<TaskActions>(() => ({ setTaskState, stopTask }), [setTaskState, stopTask]);

  const chatState = useMemo<ChatState>(() => ({ messages: state.messages }), [state.messages]);

  return (
    <ChatContext.Provider value={{ chatState, chatActions, taskState: state.task, taskActions }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
};
