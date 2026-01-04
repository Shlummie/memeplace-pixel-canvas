"use client";

import { create } from 'zustand';

const resolveDefaultApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE;
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    const { hostname, protocol } = window.location;
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

    if (isLocalhost) {
      return `${protocol}//localhost:3001`;
    }

    return window.location.origin;
  }
  return 'http://localhost:3001';
};

const DEFAULT_API_BASE = resolveDefaultApiBase();
const DEFAULT_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? deriveSocketUrl(DEFAULT_API_BASE);

const DEFAULT_SETTINGS = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
  apiBase: DEFAULT_API_BASE,
  memeMint: process.env.NEXT_PUBLIC_MEME_MINT ?? '',
  pixelCost: sanitizePositiveNumber(process.env.NEXT_PUBLIC_PIXEL_COST, 1),
  socketUrl: DEFAULT_SOCKET_URL,
  maxPixelsPerBatch: 64,
  walletCooldownSeconds: 5 * 60,
};

type Settings = typeof DEFAULT_SETTINGS;

interface SettingsState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  loadRemoteConfig: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (patch) =>
    set((state) => {
      const nextPixelCost =
        patch.pixelCost !== undefined
          ? sanitizePositiveNumber(patch.pixelCost, state.settings.pixelCost)
          : state.settings.pixelCost;

      const nextMaxPixels =
        patch.maxPixelsPerBatch !== undefined
          ? sanitizePositiveInteger(patch.maxPixelsPerBatch, state.settings.maxPixelsPerBatch)
          : state.settings.maxPixelsPerBatch;

      const nextCooldown =
        patch.walletCooldownSeconds !== undefined
          ? sanitizePositiveInteger(patch.walletCooldownSeconds, state.settings.walletCooldownSeconds)
          : state.settings.walletCooldownSeconds;

      const nextApiBase = patch.apiBase ?? state.settings.apiBase;

      const shouldUpdateSocket = (() => {
        if (patch.socketUrl !== undefined) return false;
        const currentDerived = deriveSocketUrl(state.settings.apiBase);
        return state.settings.socketUrl === currentDerived;
      })();

      const nextSocketUrl =
        patch.socketUrl ?? (shouldUpdateSocket ? deriveSocketUrl(nextApiBase) : state.settings.socketUrl);

      return {
        settings: {
          ...state.settings,
          ...patch,
          apiBase: nextApiBase,
          pixelCost: nextPixelCost,
          maxPixelsPerBatch: nextMaxPixels,
          walletCooldownSeconds: nextCooldown,
          socketUrl: nextSocketUrl,
        },
      };
    }),
  loadRemoteConfig: async () => {
    const { apiBase } = get().settings;
    try {
      const response = await fetch(`${apiBase}/v1/config`);
      if (!response.ok) {
        throw new Error(`Failed to load config (${response.status})`);
      }
      const config: Partial<Settings> & {
        pixelCost?: unknown;
        maxPixelsPerBatch?: unknown;
        walletCooldownSeconds?: unknown;
        memeMint?: unknown;
      } = await response.json();

      set((state) => ({
        settings: {
          ...state.settings,
          pixelCost: sanitizePositiveNumber(config.pixelCost, state.settings.pixelCost),
          maxPixelsPerBatch: sanitizePositiveInteger(
            config.maxPixelsPerBatch,
            state.settings.maxPixelsPerBatch,
          ),
          walletCooldownSeconds: sanitizePositiveInteger(
            config.walletCooldownSeconds,
            state.settings.walletCooldownSeconds,
          ),
          memeMint: typeof config.memeMint === 'string' && config.memeMint.length > 0
            ? config.memeMint
            : state.settings.memeMint,
        },
      }));
    } catch (error) {
      console.error('Failed to load remote config', error);
    }
  },
}));

function deriveSocketUrl(apiBase: string) {
  try {
    const endpoint = new URL(apiBase);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    endpoint.pathname = '/ws';
    endpoint.search = '';
    endpoint.hash = '';
    return endpoint.toString();
  } catch (error) {
    console.error('Failed to derive socket URL from apiBase', error);
    return process.env.NEXT_PUBLIC_SOCKET_URL ?? 'ws://localhost:3001/ws';
  }
}

function sanitizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.floor(numeric);
}

function sanitizePositiveNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
}

