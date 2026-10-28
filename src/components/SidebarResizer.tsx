import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";

const STORAGE_KEY = "gridfinity-labels:sidebar-width";
export const DEFAULT_SIDEBAR_WIDTH = 340;
const MIN_WIDTH = 260;
const MAX_WIDTH = 900;
/** Always leave this much room for the 3D preview. */
const MIN_VIEWER_WIDTH = 320;
const KEY_STEP = 20;

function clamp(width: number, windowWidth = window.innerWidth) {
  const max = Math.min(MAX_WIDTH, windowWidth - MIN_VIEWER_WIDTH);
  return Math.round(Math.max(MIN_WIDTH, Math.min(max, width)));
}

function loadWidth() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return stored > 0 ? stored : DEFAULT_SIDEBAR_WIDTH;
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

/** The sidebar width the user dragged to, remembered between visits. */
export function useSidebarWidth() {
  const [width, setWidth] = useState(loadWidth);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      // Not critical; the width just won't be remembered.
    }
  }, [width]);
  // A remembered width can be too wide for a smaller window; clamp only what is shown.
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return [clamp(width, windowWidth), (w: number) => setWidth(clamp(w))] as const;
}

interface Props {
  width: number;
  onChange: (width: number) => void;
}

/** Drag handle on the sidebar's right edge. Double-click resets to the default width. */
export function SidebarResizer({ width, onChange }: Props) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) onChange(e.clientX);
  };
  const stop = () => setDragging(false);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") onChange(width - KEY_STEP);
    else if (e.key === "ArrowRight") onChange(width + KEY_STEP);
    else if (e.key === "Home") onChange(DEFAULT_SIDEBAR_WIDTH);
    else return;
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("resizing");
    return () => document.body.classList.remove("resizing");
  }, [dragging]);

  return (
    <div
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={MIN_WIDTH}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      style={{ left: width }}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onChange(DEFAULT_SIDEBAR_WIDTH)}
      onKeyDown={onKeyDown}
    />
  );
}
