import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import styles from '../../app/page.module.css';
import { CANVAS_DIMENSION, useBoardStore } from '../../hooks/useBoard';
import { useDiffSocket } from '../../hooks/useDiffSocket';
import { usePaintConfig } from '../../hooks/usePaintConfig';
import { useSettings } from '../../hooks/useSettings';
import { useTileState } from '../../hooks/useTileState';
import { colorToHex } from '../../lib/colors';

import { CoordinateOverlay } from './CoordinateOverlay';
import { ToolPanel } from './ToolPanel';

import type { Pixel } from '@memeplace/shared';

const Canvas = dynamic(async () => import('./CanvasViewer').then((module) => module.CanvasViewer));

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;
const ZOOM_FACTOR = 0.1;

const fetchTile = async (apiBase: string, tile: number) => {
  const response = await fetch(`${apiBase}/v1/tile/${tile}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch tile ${tile}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

export function CanvasPanel() {
  const { stagePixelAt, stagedPixels, applyDiff, isSubmitting, error, undoLast } = useTileState();
  const { settings } = useSettings();
  const { 
    toolMode, 
    setToolMode, 
    toggleToolMode, 
    showGrid, 
    toggleGrid,
    setActiveColor,
  } = usePaintConfig();

  const boardBytes = useBoardStore((state) => state.board);
  const boardVersion = useBoardStore((state) => state.version);
  const setTileBytes = useBoardStore((state) => state.setTile);
  const applyBoardDiff = useBoardStore((state) => state.applyDiff);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const [loadingTiles, setLoadingTiles] = useState(false);
  const [loadedTileCount, setLoadedTileCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [pointerInfo, setPointerInfo] = useState<{ canvasX: number; canvasY: number; clientX: number; clientY: number } | null>(null);
  const pointerRef = useRef<{ id: number | null; button: number | null; x: number; y: number }>({
    id: null,
    button: null,
    x: 0,
    y: 0,
  });

  const getViewportBounds = useCallback(
    (scaleValue: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return null;

      const rect = viewport.getBoundingClientRect();
      const scaledWidth = CANVAS_DIMENSION * scaleValue;
      const scaledHeight = CANVAS_DIMENSION * scaleValue;

      const horizontalCenter = (rect.width - scaledWidth) / 2;
      const verticalCenter = (rect.height - scaledHeight) / 2;

      const minX = scaledWidth <= rect.width ? horizontalCenter : rect.width - scaledWidth;
      const maxX = scaledWidth <= rect.width ? horizontalCenter : 0;
      const minY = scaledHeight <= rect.height ? verticalCenter : rect.height - scaledHeight;
      const maxY = scaledHeight <= rect.height ? verticalCenter : 0;

      return { minX, maxX, minY, maxY } as const;
    },
    [],
  );

  const clampTranslate = useCallback(
    (next: { x: number; y: number }, scaleValue: number) => {
      const bounds = getViewportBounds(scaleValue);
      if (!bounds) return next;

      const clampedX = Math.min(bounds.maxX, Math.max(bounds.minX, next.x));
      const clampedY = Math.min(bounds.maxY, Math.max(bounds.minY, next.y));

      return { x: clampedX, y: clampedY };
    },
    [getViewportBounds],
  );

  const getCenteredTranslate = useCallback(
    (scaleValue: number) => {
      const bounds = getViewportBounds(scaleValue);
      if (!bounds) {
        return { x: 0, y: 0 };
      }
      return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      };
    },
    [getViewportBounds],
  );

  useEffect(() => {
    let active = true;
    setLoadingTiles(true);
    setLoadedTileCount(0);
    
    // Load ALL 100 tiles on startup (10x10 grid)
    const TOTAL_TILES = 100;
    const loadAllTiles = async () => {
      const promises = [];
      for (let tile = 0; tile < TOTAL_TILES; tile++) {
        promises.push(
          fetchTile(settings.apiBase, tile)
            .then((bytes) => {
              if (active) {
                setTileBytes(tile, bytes);
                setLoadedTileCount((prev) => prev + 1);
              }
            })
            .catch((err) => {
              console.error(`Failed to load tile ${tile}:`, err);
              if (active) {
                setLoadedTileCount((prev) => prev + 1);
              }
            })
        );
      }
      await Promise.all(promises);
    };

    void loadAllTiles().finally(() => {
      if (active) {
        setLoadingTiles(false);
      }
    });

    return () => {
      active = false;
    };
  }, [settings.apiBase, setTileBytes]);
  
  // Zoom helper functions
  const zoomIn = useCallback(() => {
    const nextScale = Math.min(MAX_ZOOM, scale * 1.25);
    setScale(nextScale);
  }, [scale]);
  
  const zoomOut = useCallback(() => {
    const nextScale = Math.max(MIN_ZOOM, scale / 1.25);
    setScale(nextScale);
  }, [scale]);
  
  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate(getCenteredTranslate(1));
  }, [getCenteredTranslate]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl+Z or Cmd+Z for undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        undoLast();
        return;
      }
      
      // E for eyedropper toggle
      if (event.key === 'e' || event.key === 'E') {
        toggleToolMode();
        return;
      }
      
      // G for grid toggle
      if (event.key === 'g' || event.key === 'G') {
        toggleGrid();
        return;
      }
      
      // + or = for zoom in
      if (event.key === '+' || event.key === '=') {
        zoomIn();
        return;
      }
      
      // - for zoom out
      if (event.key === '-') {
        zoomOut();
        return;
      }
      
      // 0 for reset zoom
      if (event.key === '0' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        resetZoom();
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoLast, toggleToolMode, toggleGrid, zoomIn, zoomOut, resetZoom]);

  const handleDiff = useCallback(
    (tile: number, diff: Pixel[]) => {
      applyBoardDiff(tile, diff);
      applyDiff(tile, diff);
    },
    [applyBoardDiff, applyDiff],
  );

  useDiffSocket(handleDiff);

  const handlePixelClick = useCallback(
    (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= CANVAS_DIMENSION || y >= CANVAS_DIMENSION) {
        return;
      }

      if (toolMode === 'eyedropper') {
        // Pick color from the canvas
        const index = (y * CANVAS_DIMENSION + x) * 3;
        const r = boardBytes[index] ?? 255;
        const g = boardBytes[index + 1] ?? 255;
        const b = boardBytes[index + 2] ?? 255;
        const color = (r << 16) | (g << 8) | b;
        setActiveColor(colorToHex(color));
        // Switch back to paint mode after picking
        setToolMode('paint');
      } else {
        stagePixelAt(x, y);
      }
    },
    [stagePixelAt, toolMode, boardBytes, setActiveColor, setToolMode],
  );

  const stagedPixelsGlobal = stagedPixels;

  // Use a ref to store latest values for the wheel handler
  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);
  useEffect(() => {
    scaleRef.current = scale;
    translateRef.current = translate;
  }, [scale, translate]);

  // Attach non-passive wheel listener to prevent page scroll while zooming
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const rect = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const currentScale = scaleRef.current;
      const currentTranslate = translateRef.current;

      const delta = Math.sign(event.deltaY) * ZOOM_FACTOR;
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentScale * (1 - delta)));
      if (nextScale === currentScale) return;

      const scaleRatio = nextScale / currentScale;
      const nextTranslate = {
        x: (currentTranslate.x - pointerX) * scaleRatio + pointerX,
        y: (currentTranslate.y - pointerY) * scaleRatio + pointerY,
      };

      setScale(nextScale);
      setTranslate(clampTranslate(nextTranslate, nextScale));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [clampTranslate]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1) return;
    pointerRef.current = { id: event.pointerId, button: event.button, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerRef.current.id !== event.pointerId || pointerRef.current.button !== 1) return;
      const dx = event.clientX - pointerRef.current.x;
      const dy = event.clientY - pointerRef.current.y;
      pointerRef.current = {
        id: event.pointerId,
        button: pointerRef.current.button,
        x: event.clientX,
        y: event.clientY,
      };
      setTranslate((current) => clampTranslate({ x: current.x + dx, y: current.y + dy }, scale));
    },
    [clampTranslate, scale],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current.id === event.pointerId) {
      pointerRef.current = { id: null, button: null, x: 0, y: 0 };
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    setTranslate(getCenteredTranslate(1));
    setScale(1);
  }, [getCenteredTranslate]);

  useEffect(() => {
    setTranslate((current) => clampTranslate(current, scale));
  }, [clampTranslate, scale]);

  const overlayInfo = useMemo(() => {
    if (!pointerInfo) return null;
    const { canvasX, canvasY, clientX, clientY } = pointerInfo;
    if (canvasX < 0 || canvasY < 0 || canvasX >= CANVAS_DIMENSION || canvasY >= CANVAS_DIMENSION) {
      return null;
    }
    return { canvasX, canvasY, clientX, clientY };
  }, [pointerInfo]);

  return (
    <div className={styles.canvasLayout}>
      <aside className={styles.toolColumn}>
        <ToolPanel />
      </aside>
      <div className={styles.stack}>
        <header className={styles.canvasHeader}>
          <div className={styles.canvasMeta}>
            <span>{stagedPixels.length} staged</span>
            {loadingTiles && <span>Loading {loadedTileCount}/100 tiles…</span>}
          </div>
          
          {/* Zoom Controls */}
          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.zoomButton}
              onClick={zoomOut}
              title="Zoom Out (-)"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className={styles.zoomBadge}
              onClick={resetZoom}
              title="Reset Zoom (Ctrl+0)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              onClick={zoomIn}
              title="Zoom In (+)"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          
          {/* Tool toggles */}
          <div className={styles.toolToggles}>
            <button
              type="button"
              className={`${styles.toolToggle} ${showGrid ? styles.toolToggleActive : ''}`}
              onClick={toggleGrid}
              title="Toggle Grid (G)"
              aria-label="Toggle grid"
            >
              #
            </button>
          </div>
          
          <div className={styles.status}>
            {isSubmitting && <strong>Submitting…</strong>}
            {error && <span>Error: {error}</span>}
          </div>
        </header>
        <div className={styles.canvasSurface}>
          <div
            className={styles.canvasViewport}
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={(event) => {
              handlePointerUp(event);
              setPointerInfo(null);
            }}
          >
            <Canvas
              boardBytes={boardBytes}
              boardVersion={boardVersion}
              stagedPixels={stagedPixelsGlobal}
              showGrid={showGrid}
              toolMode={toolMode}
              onPixelClick={handlePixelClick}
              onPointerMove={(info) => setPointerInfo(info)}
              onPointerLeave={() => setPointerInfo(null)}
              translate={translate}
              scale={scale}
            />
            {overlayInfo && <CoordinateOverlay info={overlayInfo} />}
          </div>
        </div>
      </div>
    </div>
  );
}

