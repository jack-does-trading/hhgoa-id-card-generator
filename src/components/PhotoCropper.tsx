"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";

export type PhotoCropperHandle = {
  /** Renders the current crop into a fresh square canvas at `outputSize` px. */
  getCroppedCanvas: (outputSize: number) => HTMLCanvasElement | null;
};

type Props = {
  /** Already HEIC-normalized image blob/file. */
  file: Blob;
  /** Display size of the square crop window, in CSS px. */
  size?: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Fixed-aspect (square) crop window with drag-to-pan and pinch/wheel-to-zoom.
 * This is the actual answer to "handles portrait, landscape, off-center
 * crops, different aspect ratios" — we don't try to guess a smart crop, we
 * let the user nudge their own photo into the frame in a couple of seconds.
 */
const PhotoCropper = forwardRef<PhotoCropperHandle, Props>(function PhotoCropper(
  { file, size = 320 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null
  );

  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  // Load the image whenever the source file changes.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(MIN_ZOOM);
      setOffset({ x: 0, y: 0 });
      setImgLoaded(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = useCallback(() => {
    const img = imgRef.current;
    if (!img) return 1;
    // "Cover" fit: the smaller ratio would letterbox, so use the larger one.
    return Math.max(size / img.width, size / img.height);
  }, [size]);

  const clampOffset = useCallback(
    (ox: number, oy: number, z: number) => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };
      const scale = baseScale() * z;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const maxX = Math.max(0, (drawW - size) / 2);
      const maxY = Math.max(0, (drawH - size) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, ox)),
        y: Math.min(maxY, Math.max(-maxY, oy)),
      };
    },
    [baseScale, size]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    const scale = baseScale() * zoom;
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = size / 2 - drawW / 2 + offset.x;
    const dy = size / 2 - drawH / 2 + offset.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  }, [baseScale, dpr, offset, size, zoom]);

  useEffect(() => {
    if (imgLoaded) draw();
  }, [imgLoaded, draw]);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, getPos(e));
    if (pointers.current.size === 1) {
      const p = getPos(e);
      panStart.current = { x: p.x, y: p.y, ox: offset.x, oy: offset.y };
    } else if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStart.current = { dist, zoom };
      panStart.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, getPos(e));

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / (pinchStart.current.dist || 1);
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, pinchStart.current.zoom * ratio)
      );
      setZoom(nextZoom);
      setOffset((o) => clampOffset(o.x, o.y, nextZoom));
    } else if (pointers.current.size === 1 && panStart.current) {
      const p = getPos(e);
      const nx = panStart.current.ox + (p.x - panStart.current.x);
      const ny = panStart.current.oy + (p.y - panStart.current.y);
      setOffset(clampOffset(nx, ny, zoom));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom - e.deltaY * 0.0015)
    );
    setZoom(nextZoom);
    setOffset((o) => clampOffset(o.x, o.y, nextZoom));
  };

  useImperativeHandle(ref, () => ({
    getCroppedCanvas(outputSize: number) {
      const img = imgRef.current;
      if (!img) return null;
      const out = document.createElement("canvas");
      out.width = outputSize;
      out.height = outputSize;
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      const factor = outputSize / size;
      const scale = baseScale() * zoom * factor;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = outputSize / 2 - drawW / 2 + offset.x * factor;
      const dy = outputSize / 2 - drawH / 2 + offset.y * factor;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      return out;
    },
  }));

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, touchAction: "none" }}
        className="rounded-2xl border-2 border-bland-line bg-bland-bg cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onWheel={onWheel}
      />
      <label className="flex w-full max-w-[320px] items-center gap-2 text-xs text-bland-muted">
        <span>Zoom</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            const z = Number(e.target.value);
            setZoom(z);
            setOffset((o) => clampOffset(o.x, o.y, z));
          }}
          className="flex-1 accent-hh-green"
        />
      </label>
      <p className="text-[11px] text-bland-muted">
        Drag to reposition · pinch or scroll to zoom
      </p>
    </div>
  );
});

export default PhotoCropper;
