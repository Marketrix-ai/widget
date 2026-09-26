/**
 * `UIStateProvider` / `useUIStateContext` — the widget's view state: open/closed, active view, current
 * mode (tell/show/do) and the error toast with whether its Retry can redial the stream. Actions are
 * stable, and `applyState` merges any partial view state. The published mode is always one the
 * tenant enabled, whatever was stored or picked before the settings changed.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';

import { useWidgetConfig } from '../hooks/useWidget';
import type { WidgetState } from '../types';
import { effectiveMode } from '../utils/chat';

type UIState = Pick<WidgetState, 'isOpen' | 'activeView' | 'currentMode' | 'error' | 'canRetry'>;

interface UIStateActions {
  toggleWidget: () => void;
  setError: (error: string | undefined, canRetry?: boolean) => void;
  applyState: (payload: Partial<UIState>) => void;
}

interface UIStateContextType {
  uiState: UIState;
  uiActions: UIStateActions;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export const UIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useWidgetConfig();
  const [uiState, setUIState] = useState<UIState>({
    isOpen: false,
    activeView: 'home',
    currentMode: 'tell',
    canRetry: false,
  });

  const uiActions = useMemo<UIStateActions>(
    () => ({
      toggleWidget: () => setUIState(prev => ({ ...prev, isOpen: !prev.isOpen })),

      setError: (error: string | undefined, canRetry = false) => setUIState(prev => ({ ...prev, error, canRetry })),

      applyState: (payload: Partial<UIState>) => setUIState(prev => ({ ...prev, ...payload })),
    }),
    [],
  );

  const currentMode = effectiveMode(config, uiState.currentMode);
  const contextValue = useMemo<UIStateContextType>(
    () => ({ uiState: { ...uiState, currentMode }, uiActions }),
    [uiState, currentMode, uiActions],
  );

  return <UIStateContext.Provider value={contextValue}>{children}</UIStateContext.Provider>;
};

export const useUIStateContext = (): UIStateContextType => {
  const ctx = useContext(UIStateContext);
  if (!ctx) throw new Error('useUIStateContext must be used within UIStateProvider');
  return ctx;
};
