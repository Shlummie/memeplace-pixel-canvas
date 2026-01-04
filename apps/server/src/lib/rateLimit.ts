import type { RedisClient } from './context';

export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfterSeconds: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

const WINDOW_SECONDS = 60;
const IP_LIMIT = 60;
const WALLET_LIMIT = 30;
const TILE_LIMIT = 120;

export async function enforceSubmitRateLimits(redis: RedisClient, ip: string, wallet: string) {
  const ipKey = getKey('submit:ip', ip);
  const walletKey = getKey('submit:wallet', wallet);

  const ipCount = await increment(redis, ipKey);
  if (ipCount > IP_LIMIT) {
    throw new RateLimitError('Too many submissions from this IP', WINDOW_SECONDS);
  }

  const walletCount = await increment(redis, walletKey);
  if (walletCount > WALLET_LIMIT) {
    throw new RateLimitError('Too many submissions from this wallet', WINDOW_SECONDS);
  }
}

export async function enforceTileRateLimit(redis: RedisClient, ip: string, tile: number) {
  const key = getKey('tile', `${ip}:${tile}`);
  const count = await increment(redis, key);
  if (count > TILE_LIMIT) {
    throw new RateLimitError('Too many tile requests', WINDOW_SECONDS);
  }
}

async function increment(redis: RedisClient, key: string): Promise<number> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return count;
}

function getKey(scope: string, value: string) {
  return `ratelimit:${scope}:${value}`;
}


