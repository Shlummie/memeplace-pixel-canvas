import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AppConfig } from '../lib/context';

// Resolve config path relative to this file's location, not cwd
// From src/config/ -> ../../config/appConfig.json (apps/server/config/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config', 'appConfig.json');

const DEFAULT_CONFIG: AppConfig = {
  pixelCost: 50,
  walletCooldownSeconds: 30,
  maxPixelsPerBatch: 64,
};

export function loadConfig(): AppConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      pixelCost: sanitizePositiveInteger(parsed.pixelCost, DEFAULT_CONFIG.pixelCost),
      walletCooldownSeconds: sanitizePositiveInteger(
        parsed.walletCooldownSeconds,
        DEFAULT_CONFIG.walletCooldownSeconds,
      ),
      maxPixelsPerBatch: sanitizePositiveInteger(parsed.maxPixelsPerBatch, DEFAULT_CONFIG.maxPixelsPerBatch),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[config] Failed to load config file, using defaults', error);
    }
    return DEFAULT_CONFIG;
  }
}

function sanitizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.floor(numeric);
}
