import { sha256, type Pixel } from '@memeplace/shared';

export interface DecodedBatch {
  tile: number;
  pixels: Pixel[];
  commit: string;
  pixelCount: number;
  originalBytes: Uint8Array;
}

const MAX_PIXELS_PER_BATCH_DEFAULT = 256;
const TILE_BOUND = 100;
const PIXEL_STRIDE = 5;

export function decodeBatch(batchBytes: Buffer, tile: number, maxPixelsPerBatch = MAX_PIXELS_PER_BATCH_DEFAULT): DecodedBatch {
  if (batchBytes.length < 2) {
    throw new Error('Batch too small');
  }

  const declaredCount = batchBytes.readUInt16BE(0);
  if (declaredCount > maxPixelsPerBatch) {
    throw new Error('Batch exceeds maximum size');
  }

  const expectedLength = 2 + declaredCount * PIXEL_STRIDE;
  if (batchBytes.length !== expectedLength) {
    throw new Error('Batch length mismatch');
  }

  const uniquePixels: Pixel[] = [];
  const seen = new Set<string>();

  let offset = 2;
  for (let i = 0; i < declaredCount; i += 1) {
    const x = batchBytes.readUInt8(offset);
    const y = batchBytes.readUInt8(offset + 1);
    const r = batchBytes.readUInt8(offset + 2);
    const g = batchBytes.readUInt8(offset + 3);
    const b = batchBytes.readUInt8(offset + 4);
    const color = (r << 16) | (g << 8) | b;

    if (x < 0 || x >= TILE_BOUND || y < 0 || y >= TILE_BOUND) {
      throw new Error(`Pixel out of bounds: (${x}, ${y})`);
    }

    const key = `${x}-${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePixels.push({ x, y, color });
    }

    offset += PIXEL_STRIDE;
  }

  const dedupedBuffer = new Uint8Array(2 + uniquePixels.length * PIXEL_STRIDE);
  const view = new DataView(dedupedBuffer.buffer);
  view.setUint16(0, uniquePixels.length, false);
  uniquePixels.forEach((pixel, index) => {
    const base = 2 + index * PIXEL_STRIDE;
    dedupedBuffer[base] = pixel.x;
    dedupedBuffer[base + 1] = pixel.y;
    dedupedBuffer[base + 2] = (pixel.color >> 16) & 0xff;
    dedupedBuffer[base + 3] = (pixel.color >> 8) & 0xff;
    dedupedBuffer[base + 4] = pixel.color & 0xff;
  });

  return {
    tile,
    pixels: uniquePixels,
    commit: sha256(dedupedBuffer),
    pixelCount: uniquePixels.length,
    originalBytes: dedupedBuffer,
  };
}

