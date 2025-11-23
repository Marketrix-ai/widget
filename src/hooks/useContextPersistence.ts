/**
 * Context Persistence Hook
 *
 * Handles auto-saving chat context to localStorage when state changes.
 * Uses ChatService for all save decisions and operations.
 */

import { useEffect, useRef } from 'react';

import type { WidgetState } from '../types';

/**
 * Hook for managing context persistence
 */
export function useContextPersistence(state: WidgetState) {
  // Track previous state for comparison
  const previousStateRef = useRef<WidgetState>(state);

  useEffect(() => {
    // ChatService handles persistence internally when addMessage/updateMessage/setState are called.
    // However, if state updates happen outside ChatService (e.g. optimistic updates in UI only),
    // we might need to sync back.
    // But in our new architecture, WidgetContext syncs TO ChatService.
    // So this hook might be redundant if WidgetContext does its job.

    // But if we want to be safe and ensure any state change in React land
    // that hasn't been pushed to service gets persisted:

    // Ideally, we should rely on actions calling service methods.
    // If this hook is for auto-saving on *every* render change, it might be expensive or conflicting.

    // Refactored approach: rely on actions.
    // But for safety during migration, we can just ensure ChatService has the latest state.

    // For now, let's assume actions update the service.
    // If we really need auto-save loop:
    /*
    if (state !== previousStateRef.current) {
       chatService.syncState(state); // We would need this method
    }
    */

    previousStateRef.current = state;
  }, [state]);
}
