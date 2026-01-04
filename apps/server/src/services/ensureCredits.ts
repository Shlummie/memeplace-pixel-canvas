import type { PoolClient } from 'pg';

import type { AppContext } from '../lib/context';
import { creditFromTx } from './creditFromTx';

interface CreditRow {
  credits: number;
}

type BatchInfo = {
  tile: number;
  commit: string;
  pixelCount: number;
  bytes?: Buffer;
};

export async function ensureCredits(
  ctx: AppContext,
  sig: string,
  wallet: string,
  batches: BatchInfo[],
  memoB64: string,
) {
  const totalPixels = batches.reduce((sum, batch) => sum + batch.pixelCount, 0);
  const client: PoolClient = await ctx.pg.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<CreditRow>(
      'SELECT credits FROM batches WHERE signature = $1 FOR UPDATE',
      [sig],
    );

    let credits = rows[0]?.credits ?? 0;

    if (rows.length === 0) {
      credits = await creditFromTx(ctx, sig, wallet, batches, memoB64, client);
      if (credits <= 0) {
        throw new Error('No credits available for signature');
      }
    }

    if (credits < totalPixels) {
      throw new Error('Insufficient credits');
    }

    await client.query('UPDATE batches SET credits = credits - $2 WHERE signature = $1', [sig, totalPixels]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

