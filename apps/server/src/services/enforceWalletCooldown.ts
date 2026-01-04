import { RateLimitError } from '../lib/rateLimit';
import type { RedisClient } from '../lib/context';

const KEY_PREFIX = 'cooldown:wallet';

export async function enforceWalletCooldown(redis: RedisClient, wallet: string, cooldownSeconds: number) {
  const key = `${KEY_PREFIX}:${wallet}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) {
    throw new RateLimitError('Wallet cooldown active', ttl);
  }
}

export async function setWalletCooldown(redis: RedisClient, wallet: string, cooldownSeconds: number) {
  const key = `${KEY_PREFIX}:${wallet}`;
  await redis.set(key, '1', { EX: cooldownSeconds });
}

