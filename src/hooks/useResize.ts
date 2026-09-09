/**
 * Drag-to-resize for the messenger panel: the size it opens at, the bounds it is held to, and the one
 * grip that drives it.
 *
 * `useResize` returns `widthPx`/`heightPx`, the `grip` its handle renders from, `onResizeStart` for
 * that handle's mousedown, and `containerRef` for the element being sized. The opening size is this
 * tenant's stored one if there is one, else the dashboard's `widget_width`/`widget_height` — both
 * through `clampSize`, so a setting outside the drag range lands on the same bounds a drag has.
 * `parsePx` accepts a bare px length only, since `rem`/`em`/`%` can't be resolved without layout, and
 * `readStoredSize` parses the tenant-scoped `marketrix_widget_size_<scope>` entry, warning-then-defaulting
 * on anything unparseable since corrupted host-page localStorage must not leave the panel unsizable.
 * `clampSize` bounds width to MIN_WIDTH..MAX_WIDTH, height to MIN_HEIGHT..85% of the viewport, measured
 * at call time so a resize re-clamps on the next drag.
 *
 * The grip is on the corner diagonally opposite the pinned one (`getResizeGrip`); `growX`/`growY` turn
 * pointer delta into size delta for whichever corner that is. During a drag the new size is written
 * straight to the element's inline style and held in `dimsRef` — React state commits once, on mouseup,
 * so pointer motion never re-renders the tree. `data-resizing` keys `index.css`'s CSS transition off.
 * Preview mode has no grip — `onResizeStart` returns before binding, so it never writes a visitor size.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { readLocal, writeLocal } from '../services/StorageService';
import type { WidgetPosition } from '../types';
import { getResizeGrip } from '../utils/widgetPositioning';

interface Size {
  width: number;
  height: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 320;
const DEFAULT_SIZE: Size = { width: 360, height: 450 };

function clampSize({ width, height }: Size): Size {
  return {
    width: Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH),
    height: Math.min(Math.max(height, MIN_HEIGHT), Math.floor(window.innerHeight * 0.85)),
  };
}

function parsePx(value: string | undefined, fallback: number): number {
  const px = /^\s*(\d+(?:\.\d+)?)px\s*$/.exec(value ?? '');
  return px ? Number(px[1]) : fallback;
}

const STORAGE_KEY_PREFIX = 'marketrix_widget_size_';

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
  position: WidgetPosition,
  tenantScope: string,
  isPreviewMode: boolean,
) {
  const storageKey = `${STORAGE_KEY_PREFIX}${tenantScope}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const grip = useMemo(() => getResizeGrip(position), [position]);

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
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPreviewMode) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = dimsRef.current.width;
      const startH = dimsRef.current.height;
      const { growX, growY, cursor } = grip;

      if (containerRef.current) {
        containerRef.current.dataset.resizing = 'true';
      }

      const onMove = (moveEvent: MouseEvent) => {
        const next = clampSize({
          width: startW + (moveEvent.clientX - startX) * growX,
          height: startH + (moveEvent.clientY - startY) * growY,
        });
        dimsRef.current = next;

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
        writeLocal(storageKey, JSON.stringify(dimsRef.current));
      };

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [isPreviewMode, storageKey, grip],
  );

  return {
    widthPx: `${dimensions.width}px`,
    heightPx: `${dimensions.height}px`,
    grip,
    onResizeStart: handleResizeStart,
    containerRef,
  };
}
