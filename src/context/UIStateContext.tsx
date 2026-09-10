/**
 * `UIStateProvider` / `useUIStateContext` — the widget's view state: open/closed, active view, current
 * mode (tell/show/do) and the error banner. Actions are stable (memoised once) so consumers can depend
 * on them without re-rendering; `applyState` merges a partial for restore-from-storage.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';

import type { InstructionType, WidgetView } from '../types';

export interface UIState {
  isOpen: boolean;
  activeView: WidgetView;
  currentMode: InstructionType;
  error?: string;
}

interface UIStateActions {
  setActiveView: (view: WidgetView) => void;
  toggleWidget: () => void;
  closeWidget: () => void;
  setMode: (mode: InstructionType) => void;
  setError: (error: string | undefined) => void;
  applyState: (payload: Partial<UIState>) => void;
}

interface UIStateContextType {
  uiState: UIState;
  uiActions: UIStateActions;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export const UIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uiState, setUIState] = useState<UIState>({
    isOpen: false,
    activeView: 'home',
    currentMode: 'tell',
  });

  const uiActions = useMemo<UIStateActions>(
    () => ({
      setActiveView: (view: WidgetView) => setUIState(prev => ({ ...prev, activeView: view })),

      toggleWidget: () => setUIState(prev => ({ ...prev, isOpen: !prev.isOpen })),

      closeWidget: () => setUIState(prev => ({ ...prev, isOpen: false })),

      setMode: (mode: InstructionType) => setUIState(prev => ({ ...prev, currentMode: mode })),

      setError: (error: string | undefined) => setUIState(prev => ({ ...prev, error })),

      applyState: (payload: Partial<UIState>) => setUIState(prev => ({ ...prev, ...payload })),
    }),
    [],
  );

  return <UIStateContext.Provider value={{ uiState, uiActions }}>{children}</UIStateContext.Provider>;
};

export const useUIStateContext = (): UIStateContextType => {
  const ctx = useContext(UIStateContext);
  if (!ctx) throw new Error('useUIStateContext must be used within UIStateProvider');
  return ctx;
};
