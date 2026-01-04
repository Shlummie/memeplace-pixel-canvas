import { applyPixels } from '../services/applyPixels';
import { decodeBatch } from '../services/decodeBatch';
import { ensureCredits } from '../services/ensureCredits';
import { findExistingBatch } from '../services/findExistingBatch';
import { verifyCommitSignature } from '../services/verifyCommitSignature';
import { enforceSubmitRateLimits, RateLimitError } from '../lib/rateLimit';
import { enforceWalletCooldown, setWalletCooldown } from '../services/enforceWalletCooldown';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const submitSchema = z.object({
  sig: z.string(),
  wallet: z.string(),
  memoB64: z.string(),
  batches: z
    .array(
      z.object({
        tile: z.number().int().min(0).max(99),
        batchBytesB64: z.string(),
        commit: z.string(),
      }),
    )
    .min(1),
  signedMsgB64: z.string(),
});

export function registerSubmitRoute(app: FastifyInstance) {
  app.post('/v1/submit', async (request, reply) => {
    console.log('[SUBMIT] POST /v1/submit received!', { 
      ip: request.ip, 
      bodyKeys: Object.keys(request.body as object || {}),
      timestamp: new Date().toISOString()
    });
    const payload = submitSchema.parse(request.body);
    const ctx = request.server.ctx;
    const tileStore = request.server.tileStore;

    try {
      await enforceSubmitRateLimits(ctx.redis, request.ip, payload.wallet);
      await enforceWalletCooldown(ctx.redis, payload.wallet, ctx.config.walletCooldownSeconds);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return reply
          .status(429)
          .header('retry-after', error.retryAfterSeconds)
          .send({ error: error.message });
      }
      throw error;
    }

    const memoJson = Buffer.from(payload.memoB64, 'base64').toString('utf8');
    const memoPayload = JSON.parse(memoJson) as {
      v: number;
      canvas: string;
      commits: Array<{ tile: number; commit: string }>;
    };

    if (memoPayload.v !== 1 || memoPayload.canvas !== 'main') {
      return reply.status(400).send({ error: 'Invalid memo payload' });
    }

    const decodedBatches = payload.batches.map((entry) => {
      const bytes = Buffer.from(entry.batchBytesB64, 'base64');
      const decoded = decodeBatch(bytes, entry.tile, ctx.config.maxPixelsPerBatch);
      return {
        raw: entry,
        decoded,
        bytes,
      };
    });

    const batchInfo = decodedBatches.map(({ decoded, bytes }) => ({
      tile: decoded.tile,
      commit: decoded.commit,
      pixelCount: decoded.pixelCount,
      bytes,
    }));

    const memoMap = new Map(memoPayload.commits.map(({ tile, commit }) => [tile, commit]));
    for (const { decoded } of decodedBatches) {
      const expectedCommit = memoMap.get(decoded.tile);
      if (expectedCommit !== decoded.commit) {
        return reply.status(400).send({ error: 'Memo commit mismatch' });
      }
    }

    const primaryBatch = decodedBatches[0];
    const existing = await findExistingBatch(ctx.pg, payload.sig, primaryBatch.decoded.tile, primaryBatch.decoded);
    if (existing) {
      return reply.status(202).send({ status: 'accepted', commits: batchInfo.map(({ tile, commit }) => ({ tile, commit })), idempotent: true });
    }

    await ensureCredits(ctx, payload.sig, payload.wallet, batchInfo, payload.memoB64);
    verifyCommitSignature(payload.wallet, payload.signedMsgB64, payload.sig, payload.memoB64);

    await Promise.all(
      decodedBatches.map(({ decoded }) => applyPixels(ctx, tileStore, decoded.tile, decoded.pixels, payload.sig)),
    );

    await setWalletCooldown(ctx.redis, payload.wallet, ctx.config.walletCooldownSeconds);

    decodedBatches.forEach(({ decoded }) => {
      ctx.broadcast({
        type: 'tile_update',
        tile: decoded.tile,
        diff: decoded.pixels.map(({ x, y, color }) => ({ x, y, color })),
      });
    });

    return reply.status(202).send({
      status: 'accepted',
      commits: batchInfo.map(({ tile, commit }) => ({ tile, commit })),
    });
  });
}

