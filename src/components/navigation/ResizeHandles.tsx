import React from 'react';

import type { ResizeCorner } from '../../hooks/useResize';

const RESIZE_CORNERS: ResizeCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function getCornerStyle(corner: ResizeCorner): React.CSSProperties {
  const isTop = corner.startsWith('top');
  const isLeft = corner.endsWith('left');
  return {
    position: 'absolute',
    width: '20px',
    height: '20px',
    padding: '4px',
    touchAction: 'none',
    zIndex: 10,
    display: 'flex',
    alignItems: isTop ? 'flex-start' : 'flex-end',
    justifyContent: isLeft ? 'flex-start' : 'flex-end',
    cursor: (isTop && isLeft) || (!isTop && !isLeft) ? 'nwse-resize' : 'nesw-resize',
    top: isTop ? 0 : undefined,
    bottom: isTop ? undefined : 0,
    left: isLeft ? 0 : undefined,
    right: isLeft ? undefined : 0,
  };
}

export interface ResizeHandlesProps {
  onResizeStart: (corner: ResizeCorner) => (e: React.MouseEvent) => void;
}

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ onResizeStart }) => (
  <>
    {RESIZE_CORNERS.map(corner => (
      <div
        key={corner}
        role='separator'
        aria-label={`Resize widget from ${corner.replace('-', ' ')}`}
        title='Drag to resize'
        style={getCornerStyle(corner)}
        onMouseDown={onResizeStart(corner)}
      />
    ))}
  </>
);
