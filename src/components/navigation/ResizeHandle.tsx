/**
 * `ResizeHandle` — a 20px corner grip for resizing the panel, positioned from its `ResizeGrip` and
 * exposed as a labelled `separator`; `touchAction: none` so the drag is not hijacked by scrolling.
 */
import React from 'react';

import type { ResizeGrip } from '../../utils/widgetPositioning';

export interface ResizeHandleProps {
  grip: ResizeGrip;
  onMouseDown: (e: React.MouseEvent) => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ grip, onMouseDown }) => (
  <div
    role='separator'
    aria-label={`Resize widget from ${grip.vertical} ${grip.horizontal}`}
    title='Drag to resize'
    style={{
      position: 'absolute',
      [grip.vertical]: 0,
      [grip.horizontal]: 0,
      width: '20px',
      height: '20px',
      padding: '4px',
      touchAction: 'none',
      zIndex: 10,
      display: 'flex',
      alignItems: grip.vertical === 'top' ? 'flex-start' : 'flex-end',
      justifyContent: grip.horizontal === 'left' ? 'flex-start' : 'flex-end',
      cursor: grip.cursor,
    }}
    onMouseDown={onMouseDown}
  />
);
