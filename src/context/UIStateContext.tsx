/**
 * `UIStateProvider` / `useUIStateContext` — the widget's view state: open/closed, active view, current
 * mode (tell/show/do) and the error toast. Actions are
 * stable: `reportFailure` logs a failed call and toasts its visitor-facing message, and `applyState` merges
 * any partial view state. The published mode is always one the tenant enabled, whatever was stored or picked
 * before the settings changed.
 */
import React, { createContext, useMemo, useState } from 'react';

import { useRequiredContext, useWidgetConfig } from '../hooks/useWidget';
import type { WidgetState } from '../types';
import { effectiveMode } from '../utils/chat';

type UIState = Pick<WidgetState, 'isOpen' | 'activeView' | 'currentMode' | 'error'>;

interface UIStateActions {
  toggleWidget: () => void;
  setError: (error: string | undefined) => void;
  reportFailure: (message: string) => (error: unknown) => void;
  applyState: (payload: Partial<UIState>) => void;
}

interface UIStateContextType {
  uiState: UIState;
  uiActions: UIStateActions;
}

const UIStateContext = createContext<UIStateContextType | null>(null);

export const UIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useWidgetConfig();
  const [uiState, setUIState] = useState<UIState>({
    isOpen: false,
    activeView: 'home',
    currentMode: 'tell',
  });

  const uiActions = useMemo<UIStateActions>(() => {
    const setError = (error: string | undefined) => setUIState(prev => ({ ...prev, error }));
    return {
      toggleWidget: () => setUIState(prev => ({ ...prev, isOpen: !prev.isOpen })),
      setError,
      reportFailure: message => (error: unknown) => {
        console.error(`[Widget] ${message}`, error);
        setError(message);
      },
      applyState: payload => setUIState(prev => ({ ...prev, ...payload })),
    };
  }, []);

  const currentMode = effectiveMode(config, uiState.currentMode);
  const contextValue = useMemo<UIStateContextType>(
    () => ({ uiState: { ...uiState, currentMode }, uiActions }),
    [uiState, currentMode, uiActions],
  );

  return <UIStateContext.Provider value={contextValue}>{children}</UIStateContext.Provider>;
};

export const useUIStateContext = () => useRequiredContext(UIStateContext, 'UIStateProvider');
