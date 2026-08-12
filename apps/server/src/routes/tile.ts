
import { enforceTileRateLimit, RateLimitError } from '../lib/rateLimit';
import { parseTileId } from '../services/parseTileId';

import type { FastifyInstance } from 'fastify';

export function registerTileRoute(app: FastifyInstance) {
  app.get('/v1/tile/:id', async (request, reply) => {
    const tileParam = request.params as { id?: string };
    const tile = parseTileId(tileParam.id);

    if (tile.kind === 'error') {
      return reply.status(400).send({ error: tile.message });
    }

    try {
      await enforceTileRateLimit(app.ctx.redis, request.ip, tile.value);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply.status(429).header('retry-after', error.retryAfterSeconds).send({ error: error.message });
      }
      throw error;
    }

    const buffer = await app.tileStore.getTile(tile.value);
    return reply.header('content-type', 'application/octet-stream').send(Buffer.from(buffer));
  });
}

