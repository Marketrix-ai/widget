import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { WidgetEvent } from '../sdk';
import { StreamClient, type StreamStatus } from '../services/StreamClient';
import { toolService } from '../services/ToolService';
import type { ChatMessage, InstructionType, TaskProgress } from '../types';
import { BROWSER_TOOLS } from '../types/browserTools';
import type { ChatState } from './ChatContext';
import { reduceSse, reduceStop, reduceToolDone, reduceToolProgress, type SseEffect, type SseState } from './sseReducer';
import type { UIStateActions } from './UIStateContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskState {
  activeTaskId: string | null;
  isTaskRunning: boolean;
  taskProgress: TaskProgress[];
}

export interface TaskActions {
  setTaskState: (payload: {
    activeTaskId: string | null;
    isTaskRunning: boolean;
    taskProgress?: TaskProgress[];
  }) => void;
  stopTask: () => Promise<void>;
}

interface TaskContextType {
  taskState: TaskState;
  taskActions: TaskActions;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TaskContext = createContext<TaskContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TaskProviderProps {
  children: React.ReactNode;
  previewMode?: boolean;
  /** Current mode from UIState — needed for progress-line logic in SSE handler. */
  currentMode: InstructionType;
  /** Injected from WidgetProviders to let SSE mutate messages. */
  setMessages: React.Dispatch<React.SetStateAction<ChatState>>;
  /** Live snapshot of the current messages, so SSE wiring reads without stale closures. */
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  /** Injected UI actions needed for agentAvailable, setLoading. */
  uiActions: Pick<UIStateActions, 'setAgentAvailable' | 'setError' | 'setLoading'>;
  /** Injected so stopTask can read the current activeTaskId without a stale closure. */
  activeTaskIdRef: React.MutableRefObject<string | null>;
}

export const TaskProvider: React.FC<TaskProviderProps> = ({
  children,
  previewMode = false,
  currentMode,
  setMessages,
  messagesRef,
  uiActions,
  activeTaskIdRef,
}) => {
  const [taskState, setTaskState_] = useState<TaskState>({
    activeTaskId: null,
    isTaskRunning: false,
    taskProgress: [],
  });

  // Live task snapshot for SSE wiring that must not stale-close over state.
  const taskRef = useRef<TaskState>(taskState);
  taskRef.current = taskState;
  const stateVersion = useRef(0);
  const processedRequestIds = useRef(new Set<string>());
  const pendingTaskRef = useRef<{ apiTaskId?: string; agentRunning?: boolean }>({});
  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;

  // Keep activeTaskIdRef in sync
  useEffect(() => {
    activeTaskIdRef.current = taskState.activeTaskId;
  }, [taskState.activeTaskId, activeTaskIdRef]);

  const MAX_PROCESSED_IDS = 1000;

  const addProcessedRequestId = useCallback((requestId: string) => {
    processedRequestIds.current.add(requestId);
    if (processedRequestIds.current.size > MAX_PROCESSED_IDS) {
      const entries = Array.from(processedRequestIds.current);
      processedRequestIds.current = new Set(entries.slice(-MAX_PROCESSED_IDS / 2));
    }
  }, []);

  // -------------------------------------------------------------------------
  // Run a pure transition against the live state and commit the result into the
  // two React stores. The reducer owns every message/task transition; reading
  // messages through the functional `setMessages` updater keeps the snapshot
  // current even mid-burst (no stale ref). Task is read from `taskRef` — it only
  // ever changes through this same path.
  // -------------------------------------------------------------------------
  const commit = useCallback(
    (transition: (state: SseState) => SseState) => {
      const taskBefore = { activeTaskId: taskRef.current.activeTaskId, isTaskRunning: taskRef.current.isTaskRunning };
      let nextTask = taskBefore;
      setMessages(prev => {
        const next = transition({ messages: prev.messages, task: taskBefore });
        nextTask = next.task;
        messagesRef.current = next.messages;
        return next.messages === prev.messages ? prev : { messages: next.messages };
      });
      if (nextTask.isTaskRunning !== taskBefore.isTaskRunning || nextTask.activeTaskId !== taskBefore.activeTaskId) {
        taskRef.current = { ...taskRef.current, ...nextTask, taskProgress: [] };
        setTaskState_(taskRef.current);
      }
    },
    [setMessages, messagesRef],
  );

  // -------------------------------------------------------------------------
  // Activate pending task once both API response and SSE task/status running arrive
  // -------------------------------------------------------------------------
  const maybeActivateTask = useCallback(() => {
    const p = pendingTaskRef.current;
    if (p.apiTaskId && p.agentRunning) {
      const taskId = p.apiTaskId;
      pendingTaskRef.current = {};
      commit(state => ({ ...state, task: { isTaskRunning: true, activeTaskId: taskId } }));
    }
  }, [commit]);

  // -------------------------------------------------------------------------
  // SSE Event Handler — thin wiring over the pure reducer.
  // -------------------------------------------------------------------------
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
        } else if (effect.type === 'activateApiTask') {
          pendingTaskRef.current = { ...pendingTaskRef.current, apiTaskId: effect.taskId };
          maybeActivateTask();
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

        if (!taskRef.current.isTaskRunning) {
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

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------
  const setTaskStateAction = useCallback(
    (payload: { activeTaskId: string | null; isTaskRunning: boolean; taskProgress?: TaskProgress[] }) => {
      setTaskState_(prev => {
        const next = { ...prev, ...payload };
        taskRef.current = next;
        return next;
      });
    },
    [],
  );

  const stopTask = useCallback(async () => {
    const taskId = activeTaskIdRef.current ?? undefined;
    commit(s => reduceStop(s, currentModeRef.current));

    if (previewMode) return;

    StreamClient.getInstance()
      .send({ type: 'chat/stop' as const, ...(taskId && { task_id: taskId }) })
      .catch(err => console.error('Failed to stop task remotely:', err));
  }, [previewMode, commit, activeTaskIdRef]);

  const taskActions = useMemo<TaskActions>(
    () => ({ setTaskState: setTaskStateAction, stopTask }),
    [setTaskStateAction, stopTask],
  );

  return <TaskContext.Provider value={{ taskState, taskActions }}>{children}</TaskContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useTaskContext = (): TaskContextType => {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTaskContext must be used within TaskProvider');
  return ctx;
};
