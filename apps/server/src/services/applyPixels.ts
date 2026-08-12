
import type { AppContext } from '../lib/context';
import type { PixelDiff, TileStore } from '../lib/tileStore';
import type { Pixel } from '@memeplace/shared';

export async function applyPixels(
  ctx: AppContext,
  tileStore: TileStore,
  tile: number,
  pixels: Pixel[],
  signature: string,
) {
  const diff: PixelDiff[] = pixels.map(({ x, y, color }) => ({ x, y, color }));
  await tileStore.applyDiff(tile, diff);

  const insertQuery = `
    INSERT INTO placements (signature, tile, x, y, color)
    VALUES ($1, $2, $3, $4, $5)
  `;

  const client = await ctx.pg.connect();
  try {
    await client.query('BEGIN');
    for (const pixel of pixels) {
      await client.query(insertQuery, [signature, tile, pixel.x, pixel.y, pixel.color]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

