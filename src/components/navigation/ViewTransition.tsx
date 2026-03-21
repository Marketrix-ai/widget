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
 * Animation driven by data-view-transition + data-direction CSS selectors in index.css.
 */
export const ViewTransition: React.FC<ViewTransitionProps> = ({ children, direction }) => {
  return (
    <Surface data-view-transition data-direction={direction} style={{ width: '100%', height: '100%' }}>
      {children}
    </Surface>
  );
};
