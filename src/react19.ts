export { useSyncExternalStore } from 'react';

export function useSyncExternalStoreWithSelector(): never {
  throw new Error('React 19 uses its native useSyncExternalStore');
}
