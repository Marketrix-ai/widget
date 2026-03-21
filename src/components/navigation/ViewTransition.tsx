import React from 'react';

import { Surface } from '../base/Surface';

type ViewDirection = 'forward' | 'back';

interface ViewTransitionProps {
  children: React.ReactNode;
  direction: ViewDirection;
}

/**
 * Wrapper that applies view slide animation.
 * Forward: enter from right (translateX 20px → 0).
 * Back: enter from left (translateX -20px → 0).
 */
export const ViewTransition: React.FC<ViewTransitionProps> = ({ children, direction }) => {
  return (
    <Surface
      className={`view-slide-enter view-slide-enter-active ${direction}`}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </Surface>
  );
};
