import { z } from 'zod';

import type { FastifyInstance } from 'fastify';

const KEY_PREFIX = 'cooldown:wallet';

const paramsSchema = z.object({
  wallet: z.string().min(32).max(44),
});

export function registerCooldownRoute(app: FastifyInstance) {
  app.get('/v1/cooldown/:wallet', async (request, reply) => {
    const { wallet } = paramsSchema.parse(request.params);
    const ctx = request.server.ctx;

    const key = `${KEY_PREFIX}:${wallet}`;
    const ttl = await ctx.redis.ttl(key);

    if (ttl > 0) {
      return reply.status(200).send({
        onCooldown: true,
        remainingSeconds: ttl,
      });
    }

    return reply.status(200).send({
      onCooldown: false,
      remainingSeconds: 0,
    });
  });
}

