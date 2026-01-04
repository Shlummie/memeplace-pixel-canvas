import type { RedisClient } from './context';

export interface PixelDiff {
  x: number;
  y: number;
  color: number;
}

const TILE_COUNT = 100;
const TILE_DIMENSION = 100;
const BYTES_PER_PIXEL = 3;
const TILE_BYTES = TILE_DIMENSION * TILE_DIMENSION * BYTES_PER_PIXEL;
const DEFAULT_FILL = 0xffffff;

function createTileBuffer(): Buffer {
  const buffer = Buffer.alloc(TILE_BYTES);
  for (let i = 0; i < TILE_DIMENSION * TILE_DIMENSION; i += 1) {
    const offset = i * BYTES_PER_PIXEL;
    buffer[offset] = 0xff;
    buffer[offset + 1] = 0xff;
    buffer[offset + 2] = 0xff;
  }
  return buffer;
}

export interface TileStore {
  getTile(tile: number): Promise<Uint8Array>;
  applyDiff(tile: number, diff: PixelDiff[]): Promise<Uint8Array>;
}

export async function createTileStore(redis: RedisClient): Promise<TileStore> {
  console.info('[tileStore] initializing tiles');

  const pipeline = redis.multi();
  for (let i = 0; i < TILE_COUNT; i += 1) {
    pipeline.exists(getTileKey(i));
  }

  const existsResults = await pipeline.exec();
  if (!existsResults) {
    console.info('[tileStore] pipeline returned null (redis multi aborted)');
  }

  const missingKeys: number[] = [];
  existsResults?.forEach((result, index) => {
    let error: Error | null = null;
    let value: number | undefined;

    if (Array.isArray(result)) {
      const tuple = result as [Error | null, number | undefined];
      [error, value] = tuple;
    } else if (typeof result === 'number') {
      value = result;
    } else if (result != null && typeof (result as { value?: unknown }).value === 'number') {
      value = (result as { value?: number }).value;
    }

    if (error) {
      console.error('[tileStore] exists check failed', { tile: index, error });
      return;
    }

    if ((value ?? 0) === 0) {
      missingKeys.push(index);
    }
  });

  console.info('[tileStore] missing tiles count', missingKeys.length);

  if (missingKeys.length > 0) {
    const seedPipeline = redis.multi();
    missingKeys.forEach((tile) => seedPipeline.set(getTileKey(tile), createTileBuffer()));
    await seedPipeline.exec();
  }

  console.info('[tileStore] initialization complete');

  return {
    async getTile(tile: number) {
      validateTileId(tile);
      const key = getTileKey(tile);
      // Use getBuffer to ensure we get raw bytes, not string
      const reply = await redis.get(redis.commandOptions({ returnBuffers: true }), key) as Buffer | null;
      if (!reply) {
        const fresh = createTileBuffer();
        await redis.set(key, fresh);
        return new Uint8Array(fresh);
      }
      return new Uint8Array(reply);
    },
    async applyDiff(tile: number, diff: PixelDiff[]) {
      validateTileId(tile);
      const key = getTileKey(tile);
      // Use returnBuffers to get raw bytes
      const existing = await redis.get(redis.commandOptions({ returnBuffers: true }), key) as Buffer | null;
      const tileBuffer = new Uint8Array(existing ?? createTileBuffer());

      diff.forEach(({ x, y, color }) => {
        if (x < 0 || y < 0 || x >= TILE_DIMENSION || y >= TILE_DIMENSION) {
          throw new Error(`Pixel out of bounds: (${x}, ${y})`);
        }
        const index = y * TILE_DIMENSION + x;
        const offset = index * BYTES_PER_PIXEL;
        tileBuffer[offset] = (color >> 16) & 0xff;
        tileBuffer[offset + 1] = (color >> 8) & 0xff;
        tileBuffer[offset + 2] = color & 0xff;
      });

      await redis.set(key, Buffer.from(tileBuffer));
      return tileBuffer;
    },
  };
}

function getTileKey(tile: number) {
  return `tile:${tile}`;
}

function validateTileId(tile: number) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_COUNT) {
    throw new Error(`Invalid tile id: ${tile}`);
  }
}

