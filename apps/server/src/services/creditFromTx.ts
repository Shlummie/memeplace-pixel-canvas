import { Connection, PublicKey } from '@solana/web3.js';

import type { AppContext } from '../lib/context';
import type { ParsedInstruction, ParsedTransactionMeta, TokenBalance } from '@solana/web3.js';
import type { PoolClient } from 'pg';


const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

interface BatchInfo {
  tile: number;
  commit: string;
  pixelCount: number;
  bytes?: Buffer;
}

export async function creditFromTx(
  ctx: AppContext,
  sig: string,
  wallet: string,
  batches: BatchInfo[],
  memoB64: string,
  client: PoolClient,
) {
  const connection = new Connection(ctx.env.RPC_URL, 'confirmed');
  const tx = await connection.getParsedTransaction(sig, { commitment: 'confirmed' });

  if (!tx) {
    throw new Error('Transaction not found');
  }

  const memoInstruction = tx.transaction.message.instructions.find((instruction) => {
    return 'programId' in instruction && instruction.programId.equals(MEMO_PROGRAM_ID);
  }) as ParsedInstruction | undefined;

  if (!memoInstruction) {
    throw new Error('Memo not found');
  }

  const memoData = extractMemoData(memoInstruction);
  if (!memoData) {
    throw new Error('Memo payload missing');
  }

  const parsedMemo = JSON.parse(memoData) as {
    v: number;
    canvas: string;
    commits: { tile: number; commit: string }[];
  };

  if (parsedMemo.v !== 1 || parsedMemo.canvas !== 'main') {
    throw new Error('Memo mismatch');
  }

  const memoMap = new Map(parsedMemo.commits.map(({ tile, commit }) => [tile, commit]));
  batches.forEach(({ tile, commit }) => {
    if (memoMap.get(tile) !== commit) {
      throw new Error('Memo mismatch');
    }
  });

  const baseCredits = extractCredits(tx.meta, ctx.env.MEME_MINT, wallet, ctx.config.pixelCost);
  const multiplier = ctx.events.getCurrentMultiplier();
  const credits = Math.floor(baseCredits * multiplier);

  if (credits <= 0) {
    throw new Error('No credits found in transaction');
  }

  await client.query(
    `INSERT INTO batches (signature, wallet, memo_b64, credits)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (signature) DO UPDATE SET memo_b64 = EXCLUDED.memo_b64, credits = EXCLUDED.credits`,
    [sig, wallet, memoB64, credits],
  );

  await client.query('DELETE FROM batch_tiles WHERE signature = $1', [sig]);
  await client.query('DELETE FROM batch_tile_bytes WHERE signature = $1', [sig]);

  for (const { tile, commit, pixelCount, bytes } of batches) {
    await client.query(
      `INSERT INTO batch_tiles (signature, tile, commit, pixel_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (signature, tile) DO UPDATE SET commit = EXCLUDED.commit, pixel_count = EXCLUDED.pixel_count`,
      [sig, tile, commit, pixelCount],
    );

    if (bytes) {
      await client.query(
        `INSERT INTO batch_tile_bytes (signature, tile, batch_bytes)
         VALUES ($1, $2, $3)
         ON CONFLICT (signature, tile) DO UPDATE SET batch_bytes = EXCLUDED.batch_bytes`,
        [sig, tile, bytes],
      );
    }
  }

  return credits;
}

function extractMemoData(instruction: ParsedInstruction): string | undefined {
  const parsed: unknown = instruction.parsed;
  if (typeof parsed === 'string') {
    return parsed;
  }

  const info = extractParsedInfo(parsed);
  if (typeof info?.memo === 'string') {
    return info.memo;
  }

  if ('data' in instruction && typeof instruction.data === 'string') {
    return Buffer.from(instruction.data, 'base64').toString();
  }

  return undefined;
}

function extractCredits(meta: ParsedTransactionMeta | null, mint: string, wallet: string, pixelCost: number) {
  if (!meta) {
    throw new Error('Missing transaction metadata');
  }

  const mintKey = new PublicKey(mint).toBase58();
  const pixelCostBigInt = BigInt(Math.floor(pixelCost));
  if (pixelCostBigInt <= 0n) {
    throw new Error('PIXEL_COST must be a positive integer');
  }

  const burnedFromBalances = calculateBurnFromBalances(meta, mintKey, wallet);
  if (burnedFromBalances > 0n) {
    return Number(burnedFromBalances / pixelCostBigInt);
  }

  const burnedFromInstructions = calculateBurnFromInstructions(meta, mintKey);
  return Math.floor(Number(burnedFromInstructions) / Number(pixelCostBigInt));
}

function calculateBurnFromBalances(meta: ParsedTransactionMeta, mintKey: string, wallet: string): bigint {
  const balanceMap = new Map<number, { pre?: TokenBalance; post?: TokenBalance }>();

  for (const balance of meta.preTokenBalances ?? []) {
    balanceMap.set(balance.accountIndex, { pre: balance });
  }

  for (const balance of meta.postTokenBalances ?? []) {
    const entry = balanceMap.get(balance.accountIndex) ?? {};
    entry.post = balance;
    balanceMap.set(balance.accountIndex, entry);
  }

  let burned = 0n;

  for (const { pre, post } of balanceMap.values()) {
    const target = pre ?? post;
    if (!target) continue;
    if (target.mint !== mintKey) continue;
    const owner = pre?.owner ?? post?.owner;
    if (owner !== wallet) continue;

    const preAmount = BigInt(pre?.uiTokenAmount.amount ?? '0');
    const postAmount = BigInt(post?.uiTokenAmount.amount ?? '0');

    if (preAmount > postAmount) {
      burned += preAmount - postAmount;
    }
  }

  return burned;
}

function calculateBurnFromInstructions(meta: ParsedTransactionMeta, mintKey: string): bigint {
  let total = 0n;

  for (const inner of meta.innerInstructions ?? []) {
    for (const instruction of inner.instructions) {
      if ('parsed' in instruction) {
        const info = extractParsedInfo(instruction.parsed as unknown);
        if (info?.mint === mintKey && typeof info.amount === 'string') {
          total += BigInt(info.amount);
        }
      }
    }
  }

  return total;
}

function extractParsedInfo(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || !('info' in value)) {
    return undefined;
  }
  const info = value.info;
  return typeof info === 'object' && info !== null ? (info as Record<string, unknown>) : undefined;
}

