import React, { createContext, useContext, useMemo, useState } from 'react';

import { chatService } from '../services/ChatService';
import type { InstructionType, WidgetView } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UIState {
  isOpen: boolean;
  isMinimized: boolean;
  activeView: WidgetView;
  currentMode: InstructionType;
  agentAvailable: boolean;
  isLoading: boolean;
  error?: string;
}

export interface UIStateActions {
  setActiveView: (view: WidgetView) => void;
  toggleWidget: () => void;
  closeWidget: () => void;
  setMode: (mode: InstructionType) => void;
  setLoading: (loading: boolean) => void;
  setAgentAvailable: (available: boolean) => void;
  setError: (error: string | undefined) => void;
  clearError: () => void;
  /** Bulk-apply partial state overrides. */
  applyState: (payload: Partial<UIState>) => void;
}

interface UIStateContextType {
  uiState: UIState;
  uiActions: UIStateActions;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface UIStateProviderProps {
  children: React.ReactNode;
  initialMode?: InstructionType;
  initialIsOpen?: boolean;
  initialIsMinimized?: boolean;
}

export const UIStateProvider: React.FC<UIStateProviderProps> = ({
  children,
  initialMode = 'tell',
  initialIsOpen = false,
  initialIsMinimized = false,
}) => {
  const [uiState, setUIState] = useState<UIState>({
    isOpen: initialIsOpen,
    isMinimized: initialIsMinimized,
    activeView: 'home',
    currentMode: initialMode,
    agentAvailable: false,
    isLoading: false,
  });

  const uiActions = useMemo<UIStateActions>(
    () => ({
      setActiveView: (view: WidgetView) => setUIState(prev => ({ ...prev, activeView: view })),

      toggleWidget: () =>
        setUIState(prev => {
          const newState = {
            ...prev,
            isOpen: !prev.isOpen,
            isMinimized: !prev.isOpen ? false : true,
          };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),

      closeWidget: () =>
        setUIState(prev => {
          const newState = { ...prev, isOpen: false, isMinimized: true };
          chatService.setWidgetState(newState.isOpen, newState.isMinimized);
          return newState;
        }),

      setMode: (mode: InstructionType) =>
        setUIState(prev => {
          chatService.setMode(mode);
          return { ...prev, currentMode: mode };
        }),

      setLoading: (loading: boolean) => {
        chatService.setIsLoading(loading);
        setUIState(prev => ({ ...prev, isLoading: loading }));
      },

      setAgentAvailable: (available: boolean) => setUIState(prev => ({ ...prev, agentAvailable: available })),

      setError: (error: string | undefined) => setUIState(prev => ({ ...prev, error })),

      clearError: () => setUIState(prev => ({ ...prev, error: undefined })),

      applyState: (payload: Partial<UIState>) => setUIState(prev => ({ ...prev, ...payload })),
    }),
    [],
  );

  return <UIStateContext.Provider value={{ uiState, uiActions }}>{children}</UIStateContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useUIStateContext = (): UIStateContextType => {
  const ctx = useContext(UIStateContext);
  if (!ctx) throw new Error('useUIStateContext must be used within UIStateProvider');
  return ctx;
};
