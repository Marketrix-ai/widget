import { useCallback, useMemo, useRef, useState } from 'react';

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

function getDeltaAndCursor(
  corner: ResizeCorner,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): { dx: number; dy: number; cursor: string } {
  const cursors: Record<ResizeCorner, string> = {
    'bottom-right': 'nwse-resize',
    'bottom-left': 'nesw-resize',
    'top-right': 'nesw-resize',
    'top-left': 'nwse-resize',
  };
  switch (corner) {
    case 'bottom-right':
      return { dx: currentX - startX, dy: currentY - startY, cursor: cursors[corner] };
    case 'bottom-left':
      return { dx: startX - currentX, dy: currentY - startY, cursor: cursors[corner] };
    case 'top-right':
      return { dx: currentX - startX, dy: startY - currentY, cursor: cursors[corner] };
    case 'top-left':
      return { dx: startX - currentX, dy: startY - currentY, cursor: cursors[corner] };
  }
}

export function useResize(
  settingsWidth: string | undefined,
  settingsHeight: string | undefined,
  workspaceId: string,
  isMinimized: boolean,
  isPreviewMode: boolean,
) {
  const storageKey = useMemo(() => `${STORAGE_KEY_PREFIX}${workspaceId}`, [workspaceId]);
  const dimsRef = useRef<{ width: number; height: number }>({ width: 360, height: 450 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => {
    if (typeof localStorage === 'undefined') {
      return { width: parsePx(settingsWidth), height: parsePx(settingsHeight) };
    }
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { width: number; height: number };
        if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
          const w = clamp(parsed.width, MIN_WIDTH, MAX_WIDTH);
          const h = clamp(parsed.height, MIN_HEIGHT, Math.floor(window.innerHeight * MAX_HEIGHT));
          dimsRef.current = { width: w, height: h };
          return { width: w, height: h };
        }
      } catch {
        /* ignore */
      }
    }
    const w = parsePx(settingsWidth);
    const h = parsePx(settingsHeight);
    dimsRef.current = { width: w, height: h };
    return { width: w, height: h };
  });

  dimsRef.current = dimensions;

  const handleResizeStart = useCallback(
    (corner: ResizeCorner) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMinimized || isPreviewMode) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = dimsRef.current.width;
      const startH = dimsRef.current.height;
      const { cursor } = getDeltaAndCursor(corner, startX, startY, startX, startY);

      // Disable transitions during resize for instant visual feedback
      if (containerRef.current) {
        containerRef.current.dataset.resizing = 'true';
      }

      const onMove = (moveEvent: MouseEvent) => {
        const { dx, dy } = getDeltaAndCursor(corner, startX, startY, moveEvent.clientX, moveEvent.clientY);
        const maxH = Math.floor(window.innerHeight * MAX_HEIGHT);
        const next = {
          width: clamp(startW + dx, MIN_WIDTH, MAX_WIDTH),
          height: clamp(startH + dy, MIN_HEIGHT, maxH),
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

        // Re-enable transitions
        if (containerRef.current) {
          delete containerRef.current.dataset.resizing;
        }

        // Sync React state once on mouseup
        setDimensions({ ...dimsRef.current });

        if (!isPreviewMode && typeof localStorage !== 'undefined') {
          const { width, height } = dimsRef.current;
          localStorage.setItem(storageKey, JSON.stringify({ width, height }));
        }
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isMinimized, isPreviewMode, storageKey],
  );

  return {
    width: dimensions.width,
    height: dimensions.height,
    widthPx: `${dimensions.width}px`,
    heightPx: `${dimensions.height}px`,
    onResizeStart: handleResizeStart,
    containerRef,
  };
}
