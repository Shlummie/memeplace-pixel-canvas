import { create } from 'zustand';

import type { Pixel } from '@memeplace/shared';

export const TILE_DIMENSION = 100;
export const TILES_PER_SIDE = 10;
export const TOTAL_TILES = TILES_PER_SIDE * TILES_PER_SIDE;
export const CANVAS_DIMENSION = TILE_DIMENSION * TILES_PER_SIDE;

const BYTES_PER_PIXEL = 3;
const TILE_PIXELS = TILE_DIMENSION * TILE_DIMENSION * BYTES_PER_PIXEL;
const BOARD_PIXELS = CANVAS_DIMENSION * CANVAS_DIMENSION * BYTES_PER_PIXEL;
const DEFAULT_COLOR = 255;

interface BoardState {
  board: Uint8Array;
  version: number;
  tiles: Record<number, Uint8Array>;
  setTile: (tile: number, bytes: Uint8Array) => void;
  applyDiff: (tile: number, diff: Pixel[]) => void;
  getTile: (tile: number) => Uint8Array | undefined;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: createBoardBuffer(),
  version: 0,
  tiles: {},
  setTile: (tile, bytes) =>
    set((state) => {
      validateTileId(tile);
      const normalized = normalizeTileBytes(bytes);
      const nextBoard = state.board.slice();
      blitTileOntoBoard(nextBoard, tile, normalized);
      return {
        board: nextBoard,
        tiles: { ...state.tiles, [tile]: normalized },
        version: state.version + 1,
      } satisfies Partial<BoardState>;
    }),
  applyDiff: (tile, diff) =>
    set((state) => {
      validateTileId(tile);
      const base = state.tiles[tile]
        ? new Uint8Array(state.tiles[tile])
        : createTileBuffer();

      diff.forEach(({ x, y, color }) => {
        if (x < 0 || x >= TILE_DIMENSION || y < 0 || y >= TILE_DIMENSION) return;
        const index = (y * TILE_DIMENSION + x) * BYTES_PER_PIXEL;
        base[index] = (color >> 16) & 0xff;
        base[index + 1] = (color >> 8) & 0xff;
        base[index + 2] = color & 0xff;
      });

      const nextBoard = state.board.slice();
      blitTileOntoBoard(nextBoard, tile, base);

      return {
        board: nextBoard,
        tiles: { ...state.tiles, [tile]: base },
        version: state.version + 1,
      } satisfies Partial<BoardState>;
    }),
  getTile: (tile) => {
    validateTileId(tile);
    const existing = get().tiles[tile];
    return existing ? new Uint8Array(existing) : undefined;
  },
}));

export function tileIdFromCoords(x: number, y: number): number {
  const tileX = Math.floor(x / TILE_DIMENSION);
  const tileY = Math.floor(y / TILE_DIMENSION);
  return tileY * TILES_PER_SIDE + tileX;
}

export function toLocalCoords(x: number, y: number) {
  return { x: x % TILE_DIMENSION, y: y % TILE_DIMENSION };
}

function createTileBuffer(): Uint8Array {
  const buffer = new Uint8Array(TILE_PIXELS);
  for (let i = 0; i < TILE_DIMENSION * TILE_DIMENSION; i += 1) {
    const offset = i * BYTES_PER_PIXEL;
    buffer[offset] = 0xff;
    buffer[offset + 1] = 0xff;
    buffer[offset + 2] = 0xff;
  }
  return buffer;
}

function createBoardBuffer(): Uint8Array {
  const buffer = new Uint8Array(BOARD_PIXELS);
  for (let i = 0; i < CANVAS_DIMENSION * CANVAS_DIMENSION; i += 1) {
    const offset = i * BYTES_PER_PIXEL;
    buffer[offset] = 0xff;
    buffer[offset + 1] = 0xff;
    buffer[offset + 2] = 0xff;
  }
  return buffer;
}

function blitTileOntoBoard(board: Uint8Array, tile: number, tileBytes: Uint8Array) {
  const tileRow = Math.floor(tile / TILES_PER_SIDE);
  const tileCol = tile % TILES_PER_SIDE;

  for (let y = 0; y < TILE_DIMENSION; y += 1) {
    const boardY = tileRow * TILE_DIMENSION + y;
    const boardRowOffset = boardY * CANVAS_DIMENSION * BYTES_PER_PIXEL;
    const tileRowOffset = y * TILE_DIMENSION * BYTES_PER_PIXEL;

    for (let x = 0; x < TILE_DIMENSION; x += 1) {
      const boardX = tileCol * TILE_DIMENSION + x;
      const boardIndex = boardRowOffset + boardX * BYTES_PER_PIXEL;
      const tileIndex = tileRowOffset + x * BYTES_PER_PIXEL;
      board[boardIndex] = tileBytes[tileIndex];
      board[boardIndex + 1] = tileBytes[tileIndex + 1];
      board[boardIndex + 2] = tileBytes[tileIndex + 2];
    }
  }
}

function normalizeTileBytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length === TILE_PIXELS) {
    return new Uint8Array(bytes);
  }

  if (bytes.length > TILE_PIXELS) {
    return new Uint8Array(bytes.slice(0, TILE_PIXELS));
  }

  const buffer = createTileBuffer();
  buffer.set(bytes);
  return buffer;
}

function validateTileId(tile: number) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= TOTAL_TILES) {
    throw new Error(`Invalid tile id: ${tile}`);
  }
}



