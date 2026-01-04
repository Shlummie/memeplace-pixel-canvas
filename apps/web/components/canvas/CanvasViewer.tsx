"use client";

import { useEffect, useRef } from 'react';

import type { Pixel } from '@memeplace/shared';

import { CANVAS_DIMENSION } from '../../hooks/useBoard';
import type { ToolMode } from '../../hooks/usePaintConfig';
import { colorToRgb } from '../../lib/colors';

interface CanvasViewerProps {
  boardBytes: Uint8Array;
  boardVersion: number;
  stagedPixels: Pixel[];
  scale: number;
  translate: { x: number; y: number };
  showGrid: boolean;
  toolMode: ToolMode;
  onPixelClick?: (x: number, y: number) => void;
  onPointerMove?: (args: { canvasX: number; canvasY: number; clientX: number; clientY: number }) => void;
  onPointerLeave?: () => void;
}

export function CanvasViewer({ boardBytes, boardVersion, stagedPixels, scale, translate, showGrid, toolMode, onPixelClick, onPointerMove, onPointerLeave }: CanvasViewerProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dimension = CANVAS_DIMENSION;
    const imageData = ctx.createImageData(dimension, dimension);

    for (let i = 0; i < dimension * dimension; i += 1) {
      const base = i * 3;
      const { r, g, b } = colorToRgb(
        ((boardBytes[base] ?? 0) << 16) | ((boardBytes[base + 1] ?? 0) << 8) | (boardBytes[base + 2] ?? 0),
      );
      const offset = i * 4;
      imageData.data[offset] = r;
      imageData.data[offset + 1] = g;
      imageData.data[offset + 2] = b;
      imageData.data[offset + 3] = 255;
    }

    stagedPixels.forEach(({ x, y, color }) => {
      if (x < 0 || y < 0 || x >= dimension || y >= dimension) return;
      const index = y * dimension + x;
      const offset = index * 4;
      const { r, g, b } = colorToRgb(color);
      imageData.data[offset] = r;
      imageData.data[offset + 1] = g;
      imageData.data[offset + 2] = b;
      imageData.data[offset + 3] = 255;
    });

    ctx.putImageData(imageData, 0, 0);
  }, [boardBytes, boardVersion, stagedPixels]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = CANVAS_DIMENSION;
    overlay.height = CANVAS_DIMENSION;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_DIMENSION, CANVAS_DIMENSION);
    
    if (!showGrid) return;
    
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= CANVAS_DIMENSION; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i + 0.5, 0);
      ctx.lineTo(i + 0.5, CANVAS_DIMENSION);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i + 0.5);
      ctx.lineTo(CANVAS_DIMENSION, i + 0.5);
      ctx.stroke();
    }
  }, [showGrid]);
  
  // Use different cursor for paint vs eyedropper
  const cursorStyle = toolMode === 'eyedropper' ? 'copy' : 'crosshair';

  return (
    <div
      style={{
        position: 'relative',
        width: CANVAS_DIMENSION,
        height: CANVAS_DIMENSION,
        transformOrigin: '0 0',
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
      }}
    >
      <canvas
        ref={ref}
        width={CANVAS_DIMENSION}
        height={CANVAS_DIMENSION}
        style={{ cursor: cursorStyle, position: 'absolute', inset: 0 }}
        onClick={(event) => {
          if (!onPixelClick) return;
          const canvas = ref.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const adjustedX = (event.clientX - rect.left) / scale;
          const adjustedY = (event.clientY - rect.top) / scale;
          const x = Math.floor(adjustedX);
          const y = Math.floor(adjustedY);
          onPixelClick(x, y);
        }}
        onPointerMove={(event) => {
          if (!onPointerMove) return;
          const canvas = ref.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const adjustedX = (event.clientX - rect.left) / scale;
          const adjustedY = (event.clientY - rect.top) / scale;
          onPointerMove({
            canvasX: Math.floor(adjustedX),
            canvasY: Math.floor(adjustedY),
            clientX: event.clientX,
            clientY: event.clientY,
          });
        }}
        onPointerLeave={() => {
          onPointerLeave?.();
        }}
      />
      <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    </div>
  );
}

