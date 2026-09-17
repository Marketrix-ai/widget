/**
 * Keeps a ref mirrored to the latest render's value so a stale closure (an event handler captured once,
 * an effect that should not re-run on every value change) can still read the current value without
 * itself becoming a dependency. Two consumers: `ChatView`'s screen-share callbacks/state and
 * `ChatContext`'s `currentModeRef`. `ChatContext`'s `stateRef` is NOT a consumer — its own header
 * documents that it must be written only from `commit()`, never resynced every render, which this
 * hook's always-resync contract would violate.
 */
import { useRef } from 'react';

export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
