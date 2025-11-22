/**
 * Widget State Hook
 *
 * Manages core widget state with reducer pattern for cleaner state updates.
 * Provides state ref for synchronous access and action creators for state updates.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';

import { widgetStateManager } from '../services/widgetStateManager';
import type { ChatMessage, InstructionType, TaskProgress, WidgetState } from '../types';

type WidgetStateAction =
  | { type: 'SET_STATE'; payload: Partial<WidgetState> }
  | { type: 'TOGGLE_WIDGET' }
  | { type: 'CLOSE_WIDGET' }
  | { type: 'SET_MODE'; payload: InstructionType }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AGENT_AVAILABLE'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | undefined }
  | { type: 'CLEAR_ERROR' }
  | {
      type: 'SET_TASK_STATE';
      payload: {
        activeTaskId: string | null;
        isTaskRunning: boolean;
        taskProgress?: TaskProgress[];
      };
    }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { messageId: string; updates: Partial<ChatMessage> } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'RESET_STATE' };

function widgetStateReducer(state: WidgetState, action: WidgetStateAction): WidgetState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };

    case 'TOGGLE_WIDGET': {
      const newIsOpen = !state.isOpen;
      return {
        ...state,
        isOpen: newIsOpen,
        isMinimized: newIsOpen ? false : true, // When opening, clear minimized; when closing, set minimized
      };
    }

    case 'CLOSE_WIDGET':
      return {
        ...state,
        isOpen: false,
        isMinimized: true,
      };

    case 'SET_MODE':
      return { ...state, currentMode: action.payload };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_AGENT_AVAILABLE':
      return { ...state, agentAvailable: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined };

    case 'SET_TASK_STATE':
      return {
        ...state,
        activeTaskId: action.payload.activeTaskId,
        isTaskRunning: action.payload.isTaskRunning,
        taskProgress: action.payload.taskProgress ?? state.taskProgress,
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.messageId ? { ...msg, ...action.payload.updates } : msg
        ),
      };

    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter((msg) => msg.id !== action.payload),
      };

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };

    case 'RESET_STATE':
      return {
        ...state,
        messages: [],
        isTaskRunning: false,
        activeTaskId: null,
        taskProgress: [],
        currentMode: 'tell',
        error: undefined,
      };

    default:
      return state;
  }
}

const initialState: WidgetState = {
  isOpen: false,
  isMinimized: false,
  isLoading: false,
  messages: [],
  currentMode: 'tell',
  agentAvailable: false,
  activeTaskId: null,
  isTaskRunning: false,
  taskProgress: [],
};

/**
 * Hook for managing widget state with reducer pattern
 * Provides state, dispatch, and ref for synchronous access
 */
export function useWidgetState() {
  const [state, dispatch] = useReducer(widgetStateReducer, initialState);

  // Ref to store latest state for synchronous access (e.g., in page unload handlers)
  const stateRef = useRef<WidgetState>(state);
  useEffect(() => {
    stateRef.current = state;
    widgetStateManager.setStateRef(state);
  }, [state]);

  // Action creators
  const setState: React.Dispatch<React.SetStateAction<WidgetState>> = useCallback(
    (payload: React.SetStateAction<WidgetState>) => {
      if (typeof payload === 'function') {
        // Use stateRef to get current state for functional updates
        dispatch({ type: 'SET_STATE', payload: payload(stateRef.current) });
      } else {
        dispatch({ type: 'SET_STATE', payload });
      }
    },
    [] // Empty deps - stateRef.current is always current
  );

  const actions = {
    setState,

    toggleWidget: () => dispatch({ type: 'TOGGLE_WIDGET' }),

    closeWidget: () => dispatch({ type: 'CLOSE_WIDGET' }),

    setMode: (mode: InstructionType) => dispatch({ type: 'SET_MODE', payload: mode }),

    setLoading: (loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }),

    setAgentAvailable: (available: boolean) =>
      dispatch({ type: 'SET_AGENT_AVAILABLE', payload: available }),

    setError: (error: string | undefined) => dispatch({ type: 'SET_ERROR', payload: error }),

    clearError: () => dispatch({ type: 'CLEAR_ERROR' }),

    setTaskState: (payload: {
      activeTaskId: string | null;
      isTaskRunning: boolean;
      taskProgress?: TaskProgress[];
    }) => dispatch({ type: 'SET_TASK_STATE', payload }),

    addMessage: (message: ChatMessage) => dispatch({ type: 'ADD_MESSAGE', payload: message }),

    updateMessage: (messageId: string, updates: Partial<ChatMessage>) =>
      dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, updates } }),

    removeMessage: (messageId: string) => dispatch({ type: 'REMOVE_MESSAGE', payload: messageId }),

    setMessages: (messages: ChatMessage[]) => dispatch({ type: 'SET_MESSAGES', payload: messages }),

    resetState: () => dispatch({ type: 'RESET_STATE' }),
  };

  return {
    state,
    stateRef,
    dispatch,
    setState,
    actions,
  };
}
