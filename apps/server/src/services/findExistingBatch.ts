import type { Pool } from 'pg';

import type { DecodedBatch } from './decodeBatch';

interface ExistingBatchMatch {
  signature: string;
  tile: number;
  commit: string;
}

export async function findExistingBatch(
  pool: Pool,
  signature: string,
  tile: number,
  batch: DecodedBatch,
): Promise<ExistingBatchMatch | undefined> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<ExistingBatchMatch & { batch_bytes?: Buffer }>(
      `SELECT bt.signature, bt.tile, bt.commit, btb.batch_bytes
       FROM batch_tiles bt
       LEFT JOIN batch_tile_bytes btb ON btb.signature = bt.signature AND btb.tile = bt.tile
       WHERE bt.signature = $1 AND bt.tile = $2`,
      [signature, tile],
    );

    if (rows.length === 0) {
      return undefined;
    }

    const [row] = rows;

    if (row.commit !== batch.commit) {
      return undefined;
    }

    if (row.batch_bytes && !row.batch_bytes.equals(Buffer.from(batch.originalBytes))) {
      return undefined;
    }

    return { signature: row.signature, tile: row.tile, commit: row.commit };
  } finally {
    client.release();
  }
}


