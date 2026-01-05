"use client";

import { useMemo } from 'react';

import { create } from 'zustand';

import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { sha256, type Pixel } from '@memeplace/shared';

import { usePaintConfig } from './usePaintConfig';
import { useSettings } from './useSettings';
import { useWallet } from './useWallet';

import { hexToColor } from '../lib/colors';

const TILE_DIMENSION = 100;
const TILES_PER_SIDE = 10;
const CANVAS_DIMENSION = TILE_DIMENSION * TILES_PER_SIDE;

interface TileStoreState {
  stagedPixels: Pixel[];
  isSubmitting: boolean;
  error?: string;
  stagePixel: (pixel: Pixel) => void;
  undoLast: () => void;
  clear: () => void;
  setSubmitting: (value: boolean) => void;
  setError: (message?: string) => void;
}

export interface UseTileStateValue {
  stagedPixels: Pixel[];
  groupedPixels: Map<number, Pixel[]>;
  batchBytesByTile: Map<number, Uint8Array>;
  commitsByTile: Map<number, string>;
  isSubmitting: boolean;
  error?: string;
  activeColor: string;
  setActiveColor: (color: string) => void;
  stagePixelAt: (x: number, y: number) => void;
  undoLast: () => void;
  clear: () => void;
  applyDiff: (tile: number, diff: Pixel[]) => void;
  burnAndSubmit: () => Promise<void>;
  checkCooldown: () => Promise<{ onCooldown: boolean; remainingSeconds: number }>;
}

const useTileStore = create<TileStoreState>((set, get) => ({
  stagedPixels: [],
  isSubmitting: false,
  error: undefined,
  stagePixel: (pixel) => {
    const { stagedPixels: current } = get();
    const exists = current.some((p) => p.x === pixel.x && p.y === pixel.y);
    if (exists) return;
    set({ stagedPixels: [...current, pixel] });
  },
  undoLast: () =>
    set((state) => {
      if (state.stagedPixels.length === 0) {
        return state;
      }
      return {
        stagedPixels: state.stagedPixels.slice(0, -1),
      } satisfies Partial<TileStoreState>;
    }),
  clear: () =>
    set((state) => {
      if (state.stagedPixels.length === 0) {
        return state;
      }
      return { stagedPixels: [] } satisfies Partial<TileStoreState>;
    }),
  setSubmitting: (value) => set({ isSubmitting: value }),
  setError: (message) => set({ error: message }),
}));

export function useTileState(): UseTileStateValue {
  const stagedPixels = useTileStore((state) => state.stagedPixels);
  const isSubmitting = useTileStore((state) => state.isSubmitting);
  const error = useTileStore((state) => state.error);
  const undoLast = useTileStore((state) => state.undoLast);
  const clear = useTileStore((state) => state.clear);
  const setSubmitting = useTileStore((state) => state.setSubmitting);
  const setError = useTileStore((state) => state.setError);

  const { activeColor, setActiveColor } = usePaintConfig();
  const { settings } = useSettings();
  const { wallet } = useWallet();

  const groupedPixels = useMemo(() => {
    const grouped = new Map<number, Pixel[]>();
    stagedPixels.forEach((pixel) => {
      const tileX = Math.floor(pixel.x / TILE_DIMENSION);
      const tileY = Math.floor(pixel.y / TILE_DIMENSION);
      const tile = tileY * TILES_PER_SIDE + tileX;
      const localX = pixel.x % TILE_DIMENSION;
      const localY = pixel.y % TILE_DIMENSION;
      const normalizedPixel = { x: localX, y: localY, color: pixel.color } satisfies Pixel;
      const existing = grouped.get(tile) ?? [];
      const deduped = existing.filter((entry) => !(entry.x === normalizedPixel.x && entry.y === normalizedPixel.y));
      grouped.set(tile, [...deduped, normalizedPixel]);
    });
    return grouped;
  }, [stagedPixels]);

  const batchBytesByTile = useMemo(() => {
    const result = new Map<number, Uint8Array>();
    for (const [tile, pixels] of groupedPixels.entries()) {
      const buffer = new Uint8Array(2 + pixels.length * 5);
      const view = new DataView(buffer.buffer);
      view.setUint16(0, pixels.length, false);
      pixels.forEach((pixel, index) => {
        const offset = 2 + index * 5;
        buffer[offset] = pixel.x;
        buffer[offset + 1] = pixel.y;
        buffer[offset + 2] = (pixel.color >> 16) & 0xff;
        buffer[offset + 3] = (pixel.color >> 8) & 0xff;
        buffer[offset + 4] = pixel.color & 0xff;
      });
      result.set(tile, buffer);
    }
    return result;
  }, [groupedPixels]);

  const commitsByTile = useMemo(() => {
    const result = new Map<number, string>();
    for (const [tile, buffer] of batchBytesByTile.entries()) {
      result.set(tile, sha256(buffer));
    }
    return result;
  }, [batchBytesByTile]);

  const stagePixelAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= CANVAS_DIMENSION || y >= CANVAS_DIMENSION) return;

    const color = hexToColor(activeColor);
    useTileStore.getState().stagePixel({ x, y, color });
  };

  const applyDiff = (_tile: number, _diff: Pixel[]) => {
    // Board store already handles remote diffs; no staging mutation required.
  };

  const burnAndSubmit = async () => {
    console.log('[burnAndSubmit] Starting...', { stagedPixels: stagedPixels.length, wallet: wallet.publicKey?.toBase58(), memeMint: settings.memeMint });
    if (stagedPixels.length === 0) return;
    if (stagedPixels.length > settings.maxPixelsPerBatch) {
      setError(`Max ${settings.maxPixelsPerBatch} pixels per burn. You have ${stagedPixels.length} staged.`);
      return;
    }
    if (!wallet.publicKey) {
      setError('Connect your wallet before burning');
      return;
    }
    if (!settings.memeMint) {
      setError('Missing MEME_MINT configuration');
      return;
    }

    try {
      setSubmitting(true);
      setError(undefined);

      const owner = wallet.publicKey;

      // Check cooldown BEFORE burning tokens to prevent wasted burns
      const cooldownResponse = await fetch(`${settings.apiBase}/v1/cooldown/${owner.toBase58()}`);
      if (cooldownResponse.ok) {
        const cooldownData = await cooldownResponse.json() as { onCooldown: boolean; remainingSeconds: number };
        if (cooldownData.onCooldown) {
          const minutes = Math.floor(cooldownData.remainingSeconds / 60);
          const seconds = cooldownData.remainingSeconds % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
          setError(`Wallet on cooldown. Wait ${timeStr} before burning.`);
          setSubmitting(false);
          return;
        }
      }

      const connection = new Connection(settings.rpcUrl, 'confirmed');
      const mint = new PublicKey(settings.memeMint);

      const { tokenProgramId, associatedTokenProgramId } = await deriveTokenPrograms(connection, mint);
      const ata = await getAssociatedTokenAddress(mint, owner, false, tokenProgramId, associatedTokenProgramId);

      const burnAmount = BigInt(settings.pixelCost) * BigInt(stagedPixels.length);
      const burnIx = createBurnInstruction(ata, mint, owner, burnAmount, [], tokenProgramId);

      const commits = Array.from(commitsByTile.entries()).map(([tile, tileCommit]) => ({ tile, commit: tileCommit }));
      const memoPayload = { v: 1, canvas: 'main', commits };
      const memoJson = JSON.stringify(memoPayload);
      const memoB64 = Buffer.from(memoJson, 'utf8').toString('base64');

      const memoIx = new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoJson, 'utf8'),
      });

      const blockhash = await connection.getLatestBlockhash('confirmed');
      const transaction = new Transaction({
        feePayer: owner,
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
      }).add(burnIx, memoIx);

      const signature = await wallet.sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, ...blockhash }, 'confirmed');

      if (!wallet.signMessage) {
        throw new Error('Wallet does not support message signing');
      }

      const message = `BURN_COMMIT:${signature}:${memoB64}`;
      console.log('[burnAndSubmit] Requesting message signature...');
      const signedMessage = await wallet.signMessage(new TextEncoder().encode(message));
      const signedMsgB64 = Buffer.from(signedMessage).toString('base64');
      console.log('[burnAndSubmit] Message signed, preparing submit payload...');

      const batchesPayload = Array.from(batchBytesByTile.entries()).map(([tile, bytes]) => {
        const commit = commitsByTile.get(tile);
        if (!commit) {
          throw new Error(`Missing commit for tile ${tile}`);
        }
        return {
          tile,
          batchBytesB64: Buffer.from(bytes).toString('base64'),
          commit,
        };
      });

      console.log('[burnAndSubmit] Submitting to', `${settings.apiBase}/v1/submit`);
      console.log('[burnAndSubmit] Payload:', { sig: signature, wallet: owner.toBase58(), memoB64, batches: batchesPayload.length });
      
      const response = await fetch(`${settings.apiBase}/v1/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sig: signature,
          wallet: owner.toBase58(),
          memoB64,
          batches: batchesPayload,
          signedMsgB64,
        }),
      });

      console.log('[burnAndSubmit] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[burnAndSubmit] Submit failed:', errorText);
        throw new Error(errorText || 'Submit failed');
      }

      console.log('[burnAndSubmit] Success! Clearing staged pixels.');
      clear();
    } catch (error) {
      console.error('[burnAndSubmit] FAILED:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[burnAndSubmit] Error message:', errorMessage);
      setError(errorMessage);
    } finally {
      console.log('[burnAndSubmit] Finished, setting submitting=false');
      setSubmitting(false);
    }
  };

  const checkCooldown = async (): Promise<{ onCooldown: boolean; remainingSeconds: number }> => {
    if (!wallet.publicKey) {
      return { onCooldown: false, remainingSeconds: 0 };
    }

    try {
      const response = await fetch(`${settings.apiBase}/v1/cooldown/${wallet.publicKey.toBase58()}`);
      if (response.ok) {
        return await response.json() as { onCooldown: boolean; remainingSeconds: number };
      }
    } catch (error) {
      console.error('Failed to check cooldown', error);
    }
    return { onCooldown: false, remainingSeconds: 0 };
  };

  return {
    stagedPixels,
    groupedPixels,
    batchBytesByTile,
    commitsByTile,
    isSubmitting,
    error,
    activeColor,
    setActiveColor,
    stagePixelAt,
    undoLast,
    clear,
    applyDiff,
    burnAndSubmit,
    checkCooldown,
  };
}

type TokenProgramConfig = {
  tokenProgramId: PublicKey;
  associatedTokenProgramId: PublicKey;
};

const TOKEN_PROGRAM_CACHE = new Map<string, TokenProgramConfig>();

async function deriveTokenPrograms(connection: Connection, mint: PublicKey): Promise<TokenProgramConfig> {
  const cacheKey = mint.toBase58();
  const cached = TOKEN_PROGRAM_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const accountInfo = await connection.getAccountInfo(mint, 'confirmed');
  if (!accountInfo) {
    throw new Error('Mint account not found');
  }

  let config: TokenProgramConfig | undefined;

  if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    config = {
      tokenProgramId: TOKEN_PROGRAM_ID,
      associatedTokenProgramId: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
  } else if (accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    config = {
      tokenProgramId: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgramId: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
  }

  if (!config) {
    throw new Error(`Unsupported token program: ${accountInfo.owner.toBase58()}`);
  }

  TOKEN_PROGRAM_CACHE.set(cacheKey, config);
  return config;
}

export function isPixel(value: unknown): value is Pixel {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Pixel).x === 'number' &&
    typeof (value as Pixel).y === 'number' &&
    typeof (value as Pixel).color === 'number'
  );
}

export function isUseTileStateValue(value: unknown): value is UseTileStateValue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<UseTileStateValue>;

  return (
    typeof candidate.stagedPixels === 'object' &&
    Array.isArray(candidate.stagedPixels) &&
    candidate.stagedPixels.every(isPixel) &&
    typeof candidate.activeColor === 'string' &&
    typeof candidate.setActiveColor === 'function' &&
    typeof candidate.undoLast === 'function' &&
    typeof candidate.clear === 'function' &&
    typeof candidate.burnAndSubmit === 'function' &&
    typeof candidate.isSubmitting === 'boolean'
  );
}

function hexToGray(hex: string) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return 255;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
}

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

