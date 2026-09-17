/**
 * Keeps a ref mirrored to the latest render's value so a stale closure (an event handler captured once,
 * an effect that should not re-run on every value change) can still read the current value without
 * itself becoming a dependency. Four consumers: `ChatView`'s screen-share callbacks, `ChatContext`'s
 * `currentModeRef`/`stateRef`, and `MessengerShell`'s `dimsRef`.
 */
import { useRef } from 'react';

export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
