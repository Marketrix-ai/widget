import { useCallback, useRef, useState } from 'react';

import { readLocal, writeLocal } from '../services/StorageService';

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 0.85; // fraction of viewport

function parsePx(value: string | undefined): number {
  if (!value) return 360;
  const num = parseInt(value.replace(/px|rem|em/gi, ''), 10);
  return isNaN(num) ? 360 : num;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const STORAGE_KEY_PREFIX = 'marketrix_widget_size_';

export type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// growX/growY: which way a corner grows the panel when the pointer moves in +x / +y.
const RESIZE_CORNERS: Record<ResizeCorner, { growX: 1 | -1; growY: 1 | -1; cursor: string }> = {
  'bottom-right': { growX: 1, growY: 1, cursor: 'nwse-resize' },
  'bottom-left': { growX: -1, growY: 1, cursor: 'nesw-resize' },
  'top-right': { growX: 1, growY: -1, cursor: 'nesw-resize' },
  'top-left': { growX: -1, growY: -1, cursor: 'nwse-resize' },
};

function readStoredSize(storageKey: string): { width: number; height: number } | null {
  try {
    const stored = JSON.parse(readLocal(storageKey) ?? 'null') as { width?: unknown; height?: unknown };
    if (typeof stored?.width !== 'number' || typeof stored?.height !== 'number') return null;
    return {
      width: clamp(stored.width, MIN_WIDTH, MAX_WIDTH),
      height: clamp(stored.height, MIN_HEIGHT, Math.floor(window.innerHeight * MAX_HEIGHT)),
    };
  } catch (error) {
    console.debug('[useResize] Ignoring an unparseable stored size:', error);
    return null;
  }
}

export function useResize(
  settingsWidth: string | undefined,
  settingsHeight: string | undefined,
  workspaceId: string,
  isPreviewMode: boolean,
) {
  const storageKey = `${STORAGE_KEY_PREFIX}${workspaceId}`;
  const dimsRef = useRef<{ width: number; height: number }>({ width: 360, height: 450 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(
    () => readStoredSize(storageKey) ?? { width: parsePx(settingsWidth), height: parsePx(settingsHeight) },
  );

  dimsRef.current = dimensions;

  const handleResizeStart = useCallback(
    (corner: ResizeCorner) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPreviewMode) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = dimsRef.current.width;
      const startH = dimsRef.current.height;
      const { growX, growY, cursor } = RESIZE_CORNERS[corner];

      if (containerRef.current) {
        containerRef.current.dataset.resizing = 'true';
      }

      const onMove = (moveEvent: MouseEvent) => {
        const next = {
          width: clamp(startW + (moveEvent.clientX - startX) * growX, MIN_WIDTH, MAX_WIDTH),
          height: clamp(
            startH + (moveEvent.clientY - startY) * growY,
            MIN_HEIGHT,
            Math.floor(window.innerHeight * MAX_HEIGHT),
          ),
        };
        dimsRef.current = next;

        // Direct DOM update — skip React re-renders during drag
        if (containerRef.current) {
          containerRef.current.style.width = `${next.width}px`;
          containerRef.current.style.height = `${next.height}px`;
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (containerRef.current) {
          delete containerRef.current.dataset.resizing;
        }

        setDimensions({ ...dimsRef.current });

        if (!isPreviewMode) {
          const { width, height } = dimsRef.current;
          writeLocal(storageKey, JSON.stringify({ width, height }));
        }
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isPreviewMode, storageKey],
  );

  return {
    widthPx: `${dimensions.width}px`,
    heightPx: `${dimensions.height}px`,
    onResizeStart: handleResizeStart,
    containerRef,
  };
}
