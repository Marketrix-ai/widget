import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { WidgetEvent } from '../sdk/schema';
import { chatService } from '../services/ChatService';
import { StreamClient, type StreamStatus } from '../services/StreamClient';
import { toolExecutionService } from '../services/ToolService';
import type { InstructionType, TaskProgress } from '../types';
import { BROWSER_TOOLS } from '../types/browserTools';
import {
  addProgressLine,
  findMessageForProgress,
  getFriendlyToolName,
  markProgressLineComplete,
  markProgressLineFailed,
  updateThinkingMarker,
} from '../utils/chat';
import type { ChatState } from './ChatContext';
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
  uiActions,
  activeTaskIdRef,
}) => {
  const [taskState, setTaskState_] = useState<TaskState>({
    activeTaskId: null,
    isTaskRunning: false,
    taskProgress: [],
  });

  // Stable refs for use inside SSE callbacks that must not stale-close over state
  const isTaskRunningRef = useRef(false);
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
  // Internal helper — update progress lines inside a message
  // -------------------------------------------------------------------------
  const updateProgressForTool = useCallback(
    (toolName: string, explanation: string, status: 'in_progress' | 'completed' | 'failed', error?: string) => {
      setMessages(prev => {
        const friendlyName = getFriendlyToolName(toolName);
        const found = findMessageForProgress({
          messages: prev.messages,
          isTaskRunning: isTaskRunningRef.current,
          currentMode: currentModeRef.current,
          requireContent: status === 'failed',
        });
        if (!found) return prev;

        let updatedMsg = found.message;
        const isInteractiveTool = [
          'click_element',
          'type_text',
          'select_dropdown_option',
          'send_keys',
          'upload_file',
        ].includes(toolName);
        const shouldWait = isTaskRunningRef.current && currentModeRef.current === 'show' && isInteractiveTool;
        const isDoneTool = toolName === 'done';

        if (status === 'in_progress') {
          if (!isDoneTool) {
            updatedMsg = addProgressLine(updatedMsg, friendlyName, explanation || friendlyName);
          }
          if (isTaskRunningRef.current && (currentModeRef.current === 'show' || currentModeRef.current === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, isTaskRunningRef.current, currentModeRef.current, shouldWait);
          }
        } else if (status === 'completed') {
          if (!isDoneTool) {
            updatedMsg = markProgressLineComplete(updatedMsg);
          }
          if (isTaskRunningRef.current && (currentModeRef.current === 'show' || currentModeRef.current === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, isTaskRunningRef.current, currentModeRef.current, false);
          }
        } else {
          updatedMsg = markProgressLineFailed(updatedMsg, friendlyName, error || '');
          if (isTaskRunningRef.current && (currentModeRef.current === 'show' || currentModeRef.current === 'do')) {
            updatedMsg = updateThinkingMarker(updatedMsg, isTaskRunningRef.current, currentModeRef.current, false);
          }
        }

        const newMessages = [...prev.messages];
        newMessages[found.index] = updatedMsg;
        chatService.setMessages(newMessages);
        return { messages: newMessages };
      });
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Activate pending task once both API response and SSE task/status running arrive
  // -------------------------------------------------------------------------
  const maybeActivateTask = useCallback(() => {
    const p = pendingTaskRef.current;
    if (p.apiTaskId && p.agentRunning) {
      const taskId = p.apiTaskId;
      pendingTaskRef.current = {};
      setTaskState_(prev => {
        chatService.setTaskState(true, taskId, []);
        isTaskRunningRef.current = true;
        return { ...prev, isTaskRunning: true, activeTaskId: taskId, taskProgress: [] };
      });
    }
  }, []);

  // -------------------------------------------------------------------------
  // SSE Event Handler
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (previewMode) return;

    const wsClient = StreamClient.getInstance();

    const handleStatusChange = (status: StreamStatus) => {
      uiActions.setAgentAvailable(status === 'registered');
    };

    const handleMessage = async (event: WidgetEvent) => {
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

        if (!isTaskRunningRef.current) {
          console.log('[Widget] Tool call received before task/status running — auto-activating task');
          isTaskRunningRef.current = true;
          setTaskState_(prev => ({ ...prev, isTaskRunning: true }));
        }

        const toolName = event.tool;
        const args = event.args;
        const mode = event.mode || currentModeRef.current || 'do';
        const explanation = event.explanation || '';
        const requestStateVersion = event.state_version;

        if (requestStateVersion !== undefined && requestStateVersion > stateVersion.current) {
          stateVersion.current = requestStateVersion;
        }

        updateProgressForTool(toolName, explanation, 'in_progress');

        const result = await toolExecutionService.executeTool(toolName, args, mode, explanation);

        if (result.success) {
          try {
            stateVersion.current++;
            wsClient
              .send({
                type: 'tool/response',
                call_id: requestId,
                success: true,
                data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
                state_version: stateVersion.current,
              })
              .catch(err => console.error('Failed to send tool success response:', err));
            updateProgressForTool(toolName, explanation, 'completed');

            if (toolName === 'done') {
              pendingTaskRef.current = {};
              setTaskState_(prev => {
                chatService.setTaskState(false, null, []);
                isTaskRunningRef.current = false;
                setMessages(msgPrev => {
                  const found = findMessageForProgress({
                    messages: msgPrev.messages,
                    isTaskRunning: prev.isTaskRunning,
                    currentMode: currentModeRef.current,
                    requireContent: false,
                  });
                  const newMessages = [...msgPrev.messages];
                  if (found) {
                    const updatedParts = (found.message.parts ?? []).filter(
                      part => !(part.type === 'progress' && part.toolName === 'done'),
                    );
                    newMessages[found.index] = { ...found.message, taskStatus: 'done', parts: updatedParts };
                    chatService.setMessages(newMessages);
                  }
                  return { messages: newMessages };
                });
                return { ...prev, isTaskRunning: false, activeTaskId: null, taskProgress: [] };
              });
            }
          } catch (error) {
            console.error('Failed to send tool result:', error);
            updateProgressForTool(toolName, explanation, 'failed', 'Connection error');
          }
        } else {
          updateProgressForTool(toolName, explanation, 'failed', result.error || 'Tool execution failed');
          stateVersion.current++;
          wsClient
            .send({
              type: 'tool/response',
              call_id: requestId,
              success: false,
              data: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
              error: result.error ?? undefined,
              state_version: stateVersion.current,
            })
            .catch(err => console.error('Failed to send tool error response:', err));
        }
      } else if (event.type === 'task/status') {
        const status = event.status;
        const statusMessage = event.message || '';

        if (status === 'running') {
          // 'running' is the canonical in-progress wire status.
          pendingTaskRef.current = {
            ...pendingTaskRef.current,
            agentRunning: true,
            apiTaskId: pendingTaskRef.current.apiTaskId || event.task_id || undefined,
          };
          maybeActivateTask();
        } else if (status === 'has_question') {
          // Task is paused awaiting a user answer — not terminal. Stop the running
          // spinner and flip the active message to the "waiting for you" indicator,
          // but leave taskStatus unset (no done/failed icon) so a follow-up answer can resume.
          pendingTaskRef.current = {};
          setTaskState_(prev => {
            chatService.setTaskState(false, null, []);
            setMessages(msgPrev => {
              const found = findMessageForProgress({
                messages: msgPrev.messages,
                isTaskRunning: prev.isTaskRunning,
                currentMode: currentModeRef.current,
                requireContent: false,
              });
              const newMessages = [...msgPrev.messages];
              if (found) {
                const cleared = updateThinkingMarker(found.message, false, currentModeRef.current);
                newMessages[found.index] = {
                  ...cleared,
                  placeholderState: 'waiting-for-user',
                  ...(statusMessage && { content: statusMessage }),
                };
                chatService.setMessages(newMessages);
              }
              return { messages: newMessages };
            });
            isTaskRunningRef.current = false;
            return { ...prev, isTaskRunning: false, activeTaskId: null, taskProgress: [] };
          });
        } else if (status === 'completed' || status === 'failed' || status === 'stopped') {
          processedRequestIds.current.clear();
          pendingTaskRef.current = {};
          setTaskState_(prev => {
            chatService.setTaskState(false, null, []);
            setMessages(msgPrev => {
              const found = findMessageForProgress({
                messages: msgPrev.messages,
                isTaskRunning: prev.isTaskRunning,
                currentMode: currentModeRef.current,
                requireContent: false,
              });
              const newMessages = [...msgPrev.messages];
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
              return { messages: newMessages };
            });
            isTaskRunningRef.current = false;
            return { ...prev, isTaskRunning: false, activeTaskId: null, taskProgress: [] };
          });
        }
      } else if (event.type === 'chat/response') {
        setMessages(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id !== event.request_id) return msg;
            const newParts = [...(msg.parts ?? []), { type: 'text' as const, content: event.text }];
            return {
              ...msg,
              content: event.text,
              isPlaceholder: false,
              placeholderState: undefined,
              parts: newParts,
              ...(event.task_id && { taskId: event.task_id }),
            };
          });
          chatService.setMessages(newMessages);

          if (event.task_id) {
            pendingTaskRef.current = { ...pendingTaskRef.current, apiTaskId: event.task_id };
            maybeActivateTask();
          }

          return { messages: newMessages };
        });
        uiActions.setLoading(false);
      } else if (event.type === 'chat/error') {
        setMessages(prev => {
          const newMessages = prev.messages.map(msg => {
            if (msg.id !== event.request_id) return msg;
            const errorMessage = `Error: ${event.error}`;
            const newParts = [...(msg.parts ?? []), { type: 'text' as const, content: errorMessage }];
            return {
              ...msg,
              content: errorMessage,
              isPlaceholder: false,
              placeholderState: undefined,
              parts: newParts,
            };
          });
          chatService.setMessages(newMessages);
          return { messages: newMessages };
        });
        uiActions.setLoading(false);
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
  }, [previewMode, updateProgressForTool, maybeActivateTask, addProcessedRequestId, setMessages, uiActions]);

  // -------------------------------------------------------------------------
  // Public actions
  // -------------------------------------------------------------------------
  const setTaskStateAction = useCallback(
    (payload: { activeTaskId: string | null; isTaskRunning: boolean; taskProgress?: TaskProgress[] }) => {
      setTaskState_(prev => {
        chatService.setTaskState(payload.isTaskRunning, payload.activeTaskId, payload.taskProgress ?? []);
        return { ...prev, ...payload };
      });
    },
    [],
  );

  const stopTask = useCallback(async () => {
    const taskId = activeTaskIdRef.current ?? undefined;

    setTaskState_(prev => {
      setMessages(msgPrev => {
        const found = findMessageForProgress({
          messages: msgPrev.messages,
          isTaskRunning: prev.isTaskRunning,
          currentMode: currentModeRef.current,
          requireContent: false,
        });
        const newMessages = [...msgPrev.messages];
        if (found) {
          newMessages[found.index] = { ...found.message, taskStatus: 'stopped' };
          if (!previewMode) chatService.setMessages(newMessages);
        }
        return { messages: newMessages };
      });

      if (!previewMode) chatService.setTaskState(false, null, []);
      isTaskRunningRef.current = false;
      return { ...prev, isTaskRunning: false, activeTaskId: null, taskProgress: [] };
    });

    if (previewMode) return;

    StreamClient.getInstance()
      .send({ type: 'chat/stop' as const, ...(taskId && { task_id: taskId }) })
      .catch(err => console.error('Failed to stop task remotely:', err));
  }, [previewMode, setMessages, activeTaskIdRef]);

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
