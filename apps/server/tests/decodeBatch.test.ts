import { describe, expect, it } from 'vitest';

import { sha256 } from '@memeplace/shared';
import { decodeBatch } from '../src/services/decodeBatch';

const encodePixels = (...pixels: Array<{ x: number; y: number; color: number }>) => {
  const buffer = new Uint8Array(2 + pixels.length * 5);
  const view = new DataView(buffer.buffer);
  view.setUint16(0, pixels.length, false);
  pixels.forEach((pixel, index) => {
    const base = 2 + index * 5;
    buffer[base] = pixel.x;
    buffer[base + 1] = pixel.y;
    buffer[base + 2] = (pixel.color >> 16) & 0xff;
    buffer[base + 3] = (pixel.color >> 8) & 0xff;
    buffer[base + 4] = pixel.color & 0xff;
  });
  return Buffer.from(buffer);
};

describe('decodeBatch', () => {
  it('decodes batch and computes commit', () => {
    const buffer = encodePixels(
      { x: 10, y: 20, color: 0xff0000 },
      { x: 30, y: 40, color: 0x00ff00 },
    );
    const result = decodeBatch(buffer, 5);

    expect(result.tile).toBe(5);
    expect(result.pixelCount).toBe(2);
    expect(result.pixels).toEqual([
      { x: 10, y: 20, color: 0xff0000 },
      { x: 30, y: 40, color: 0x00ff00 },
    ]);
    expect(result.commit).toMatch(/^[0-9a-f]{64}$/);
    expect(result.commit).toEqual(sha256(new Uint8Array(buffer)));
  });

  it('throws on invalid length', () => {
    const buffer = Buffer.from([0x00, 0x01, 10, 20, 0xff, 0x00]);
    expect(() => decodeBatch(buffer, 0)).toThrow('Batch length mismatch');
  });

  it('throws when batch too large', () => {
    const buffer = Buffer.alloc(2 + 257 * 5, 0);
    const view = new DataView(buffer.buffer);
    view.setUint16(0, 257, false);
    expect(() => decodeBatch(Buffer.from(buffer), 0)).toThrow('Batch exceeds maximum size');
  });

  it('deduplicates overlapping pixels', () => {
    const buffer = encodePixels(
      { x: 1, y: 1, color: 0x010203 },
      { x: 1, y: 1, color: 0x040506 },
    );
    const result = decodeBatch(buffer, 0);

    expect(result.pixelCount).toBe(1);
    expect(result.pixels).toEqual([{ x: 1, y: 1, color: 0x010203 }]);
  });

  it('rejects out-of-bounds pixel', () => {
    const buffer = encodePixels({ x: 255, y: 101, color: 0x000000 });
    expect(() => decodeBatch(buffer, 0)).toThrow(/Pixel out of bounds/);
  });

  it('allows color value zero', () => {
    const buffer = encodePixels({ x: 1, y: 1, color: 0x000000 });
    const result = decodeBatch(buffer, 0);
    expect(result.pixels).toEqual([{ x: 1, y: 1, color: 0x000000 }]);
  });
});

