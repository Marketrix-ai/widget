import React from 'react';

import { RESIZE_CORNERS, type ResizeCorner } from '../../hooks/useResize';

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
    cursor: RESIZE_CORNERS[corner].cursor,
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
    {(Object.keys(RESIZE_CORNERS) as ResizeCorner[]).map(corner => (
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
