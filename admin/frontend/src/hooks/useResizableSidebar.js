import { useEffect, useRef, useState } from 'react';

const DEFAULT_WIDTH = 248;
const MIN_WIDTH = 190;
const MAX_WIDTH = 360;

function clampWidth(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  const width = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(maximum, Math.max(minimum, width));
}

export default function useResizableSidebar({
  storageKey,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
} = {}) {
  const resizeRef = useRef(null);
  const clamp = (value) => clampWidth(value, minWidth, maxWidth, defaultWidth);
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth;

    try {
      return clamp(localStorage.getItem(storageKey));
    } catch {
      return defaultWidth;
    }
  });
  const [resizing, setResizing] = useState(false);

  const persistWidth = (nextWidth) => {
    try {
      localStorage.setItem(storageKey, String(clamp(nextWidth)));
    } catch {
      // Resizing should still work when browser storage is unavailable.
    }
  };

  const stopResize = (event) => {
    const resize = resizeRef.current;
    if (!resize || (event && event.pointerId !== resize.pointerId)) return;

    if (resize.handle?.hasPointerCapture?.(resize.pointerId)) {
      resize.handle.releasePointerCapture(resize.pointerId);
    }

    persistWidth(resize.lastWidth);
    document.body.style.cursor = resize.previousCursor;
    document.body.style.userSelect = resize.previousUserSelect;
    resizeRef.current = null;
    setResizing(false);
  };

  const startResize = (event) => {
    if (event.button !== 0 || window.innerWidth <= 900) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
      lastWidth: width,
      handle: event.currentTarget,
      previousCursor: document.body.style.cursor,
      previousUserSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    setResizing(true);
  };

  const moveResize = (event) => {
    const resize = resizeRef.current;
    if (!resize || event.pointerId !== resize.pointerId) return;

    const nextWidth = clamp(resize.startWidth + event.clientX - resize.startX);
    resize.lastWidth = nextWidth;
    setWidth(nextWidth);
  };

  const resizeWithKeyboard = (event) => {
    let nextWidth = width;
    if (event.key === 'ArrowLeft') nextWidth -= 8;
    else if (event.key === 'ArrowRight') nextWidth += 8;
    else if (event.key === 'Home') nextWidth = minWidth;
    else if (event.key === 'End') nextWidth = maxWidth;
    else return;

    event.preventDefault();
    const clampedWidth = clamp(nextWidth);
    setWidth(clampedWidth);
    persistWidth(clampedWidth);
  };

  const resetWidth = () => {
    setWidth(defaultWidth);
    persistWidth(defaultWidth);
  };

  useEffect(() => () => {
    const resize = resizeRef.current;
    if (!resize) return;
    document.body.style.cursor = resize.previousCursor;
    document.body.style.userSelect = resize.previousUserSelect;
  }, []);

  return {
    width,
    resizing,
    minWidth,
    maxWidth,
    startResize,
    moveResize,
    stopResize,
    resizeWithKeyboard,
    resetWidth,
  };
}
