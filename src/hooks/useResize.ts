import { useCallback, useRef, useState } from 'react';

import { readLocal, writeLocal } from '../services/StorageService';

interface Size {
  width: number;
  height: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 320;
const DEFAULT_SIZE: Size = { width: 360, height: 450 };

const maxHeightPx = (): number => Math.floor(window.innerHeight * 0.85);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampSize({ width, height }: Size): Size {
  return { width: clamp(width, MIN_WIDTH, MAX_WIDTH), height: clamp(height, MIN_HEIGHT, maxHeightPx()) };
}

function parsePx(value: string | undefined, fallback: number): number {
  const px = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value ?? '');
  return px ? Number(px[1]) : fallback;
}

const STORAGE_KEY_PREFIX = 'marketrix_widget_size_';

// growX/growY: which way a corner grows the panel when the pointer moves in +x / +y.
export const RESIZE_CORNERS = {
  'top-left': { growX: -1, growY: -1, cursor: 'nwse-resize' },
  'top-right': { growX: 1, growY: -1, cursor: 'nesw-resize' },
  'bottom-left': { growX: -1, growY: 1, cursor: 'nesw-resize' },
  'bottom-right': { growX: 1, growY: 1, cursor: 'nwse-resize' },
} as const;

export type ResizeCorner = keyof typeof RESIZE_CORNERS;

function readStoredSize(storageKey: string): Size | null {
  try {
    const stored = JSON.parse(readLocal(storageKey) ?? 'null') as { width?: unknown; height?: unknown };
    if (typeof stored?.width !== 'number' || typeof stored?.height !== 'number') return null;
    return clampSize({ width: stored.width, height: stored.height });
  } catch (error) {
    console.warn('[useResize] Ignoring an unparseable stored size:', error);
    return null;
  }
}

export function useResize(
  settingsWidth: string | undefined,
  settingsHeight: string | undefined,
  tenantScope: string,
  isPreviewMode: boolean,
) {
  const storageKey = `${STORAGE_KEY_PREFIX}${tenantScope}`;
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState<Size>(
    () =>
      readStoredSize(storageKey) ??
      clampSize({
        width: parsePx(settingsWidth, DEFAULT_SIZE.width),
        height: parsePx(settingsHeight, DEFAULT_SIZE.height),
      }),
  );

  const dimsRef = useRef<Size>(dimensions);
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
        const next = clampSize({
          width: startW + (moveEvent.clientX - startX) * growX,
          height: startH + (moveEvent.clientY - startY) * growY,
        });
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
