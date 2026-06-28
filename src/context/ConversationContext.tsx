import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { WidgetEvent } from '../sdk';
import { ApiService } from '../services/ApiService';
import { createAgentMessage, createUserMessage } from '../services/ChatService';
import { configManager } from '../services/ConfigManager';
import { StreamClient, type StreamStatus } from '../services/StreamClient';
import { toolService } from '../services/ToolService';
import type { ChatMessage, InstructionType } from '../types';
import { BROWSER_TOOLS } from '../types/browserTools';
import { addThinkingMarker } from '../utils/chat';
import { reduceSse, reduceStop, reduceToolDone, reduceToolProgress, type SseEffect, type SseState } from './sseReducer';
import type { UIStateActions } from './UIStateContext';

/**
 * ConversationContext — the single store for the widget's conversation.
 *
 * Holds `{ messages, task }` as ONE `SseState`, so the SSE effect commits each
 * transition through a single atomic `setState(prev => transition(prev))`. This
 * removes the previous two-store split (ChatContext + TaskContext), which forced
 * a raw-setState escape hatch and `messagesRef`/`taskRef` snapshots and could
 * tear (messages updating while task lagged across an await). UIStateContext
 * (open/minimized/mode/loading/error) stays separate — a genuinely different
 * concern.
 */

export interface SimulationState {
  activeSimulationId: string | null;
  isSimulationRunning: boolean;
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
  sendMessage: (
    content: string,
    mode?: InstructionType,
    applicationId?: number,
    question?: string,
    skipUserMessage?: boolean,
  ) => Promise<void>;
}

export interface SimulationActions {
  setTaskState: (payload: { activeSimulationId: string | null; isSimulationRunning: boolean }) => void;
  stopTask: () => Promise<void>;
}

interface ConversationContextType {
  chatState: ChatState;
  chatActions: ChatActions;
  taskState: SimulationState;
  taskActions: SimulationActions;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

const EMPTY_TASK: SimulationState = { activeSimulationId: null, isSimulationRunning: false };

interface ConversationProviderProps {
  children: React.ReactNode;
  previewMode?: boolean;
  /** Current mode from UIState — fallback for sendMessage and progress-line logic. */
  currentMode: InstructionType;
  /** Injected UI actions so the conversation store drives loading/availability/error without nesting contexts. */
  uiActions: Pick<UIStateActions, 'setLoading' | 'setAgentAvailable' | 'setError'>;
  /** One-time hydrated snapshot to seed the store (messages + task) on mount. */
  initialMessages?: ChatMessage[];
  initialTask?: SimulationState;
}

export const ConversationProvider: React.FC<ConversationProviderProps> = ({
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

  // Live snapshot for SSE wiring / stopTask that must not stale-close over state.
  const stateRef = useRef<SseState>(state);
  stateRef.current = state;

  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;

  const stateVersion = useRef(0);
  const processedRequestIds = useRef(new Set<string>());
  const pendingTaskRef = useRef<{ apiTaskId?: string; agentRunning?: boolean }>({});

  // Run a pure transition against the live state and commit the result in ONE atomic setState.
  // The reducer owns every message/task transition; reading through the functional updater keeps
  // the snapshot current even mid-burst, and committing both fields together can never tear.
  const commit = useCallback((transition: (s: SseState) => SseState) => {
    setState(prev => {
      const next = transition(prev);
      if (next === prev || (next.messages === prev.messages && next.task === prev.task)) return prev;
      stateRef.current = next;
      return next;
    });
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
    (payload: { activeSimulationId: string | null; isSimulationRunning: boolean }) => {
      commit(s => ({
        ...s,
        task: { activeSimulationId: payload.activeSimulationId, isSimulationRunning: payload.isSimulationRunning },
      }));
    },
    [commit],
  );

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

  // Activate pending task once both the API response and the SSE task/status running event arrive.
  const maybeActivateTask = useCallback(() => {
    const p = pendingTaskRef.current;
    if (p.apiTaskId && p.agentRunning) {
      const taskId = p.apiTaskId;
      pendingTaskRef.current = {};
      commit(s => ({ ...s, task: { isSimulationRunning: true, activeSimulationId: taskId } }));
    }
  }, [commit]);

  // SSE event handler — thin wiring over the pure reducer.
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
      const { callId, tool, args, mode, explanation } = effect;
      const result = await toolService.executeTool(tool, args, mode, explanation);

      if (result.success) {
        try {
          stateVersion.current++;
          wsClient
            .send({
              type: 'tool/response',
              call_id: callId,
              success: true,
              data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
              state_version: stateVersion.current,
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
        stateVersion.current++;
        wsClient
          .send({
            type: 'tool/response',
            call_id: callId,
            success: false,
            data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
            error: result.error ?? undefined,
            state_version: stateVersion.current,
          })
          .catch(err => console.error('Failed to send tool error response:', err));
      }
    };

    const handleMessage = async (event: WidgetEvent) => {
      // Transport bookkeeping that must run before the pure reducer.
      if (event.type === 'tool/call') {
        const requestId = event.call_id;
        if (processedRequestIds.current.has(requestId)) return;
        addProcessedRequestId(requestId);

        const ALLOWED_TOOLS = BROWSER_TOOLS.map(t => t.id);
        if (!ALLOWED_TOOLS.includes(event.tool)) {
          console.warn('[Widget] Unknown tool requested:', event.tool);
          wsClient
            .send({
              type: 'tool/response',
              call_id: requestId,
              success: false,
              error: `Unknown tool: ${event.tool}`,
              state_version: stateVersion.current,
            })
            .catch(err => console.error('Failed to send unknown-tool response:', err));
          return;
        }

        if (!stateRef.current.task.isSimulationRunning) {
          console.log('[Widget] Tool call received before task/status running — auto-activating task');
        }
        if (event.state_version !== undefined && event.state_version > stateVersion.current) {
          stateVersion.current = event.state_version;
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
    const taskId = stateRef.current.task.activeSimulationId ?? undefined;
    commit(s => reduceStop(s, currentModeRef.current));

    if (previewMode) return;

    StreamClient.getInstance()
      .send({ type: 'chat/stop' as const, ...(taskId && { task_id: taskId }) })
      .catch(err => console.error('Failed to stop task remotely:', err));
  }, [previewMode, commit]);

  const chatActions = useMemo<ChatActions>(
    () => ({ addMessage, updateMessage, removeMessage, setMessages, clearMessages, sendMessage }),
    [addMessage, updateMessage, removeMessage, setMessages, clearMessages, sendMessage],
  );

  const taskActions = useMemo<SimulationActions>(() => ({ setTaskState, stopTask }), [setTaskState, stopTask]);

  const chatState = useMemo<ChatState>(() => ({ messages: state.messages }), [state.messages]);

  return (
    <ConversationContext.Provider value={{ chatState, chatActions, taskState: state.task, taskActions }}>
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversationContext = (): ConversationContextType => {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversationContext must be used within ConversationProvider');
  return ctx;
};
