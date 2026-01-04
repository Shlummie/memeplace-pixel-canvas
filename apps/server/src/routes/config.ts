import type { FastifyInstance } from 'fastify';

export function registerConfigRoute(app: FastifyInstance) {
  app.get('/v1/config', async (_, reply) => {
    const {
      ctx: {
        env: { MEME_MINT, SEASON_LABEL },
        config: { pixelCost, walletCooldownSeconds, maxPixelsPerBatch },
      },
    } = app;

    return reply.send({
      pixelCost,
      memeMint: MEME_MINT,
      season: SEASON_LABEL,
      walletCooldownSeconds,
      maxPixelsPerBatch,
    });
  });
}


