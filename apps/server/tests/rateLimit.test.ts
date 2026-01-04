import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enforceSubmitRateLimits, enforceTileRateLimit, RateLimitError } from '../src/lib/rateLimit';

const createMockRedis = () => {
  const store = new Map<string, number>();
  return {
    incr: vi.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => true),
  } as unknown as Parameters<typeof enforceSubmitRateLimits>[0];
};

describe('enforceSubmitRateLimits', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('allows requests under limit', async () => {
    await expect(enforceSubmitRateLimits(redis, '1.1.1.1', 'wallet')).resolves.not.toThrow();
  });

  it('throws when IP exceeds limit', async () => {
    for (let i = 0; i < 60; i += 1) {
      await enforceSubmitRateLimits(redis, '1.1.1.1', `wallet-${i}`);
    }

    await expect(enforceSubmitRateLimits(redis, '1.1.1.1', 'wallet-final')).rejects.toThrow(
      'Too many submissions from this IP',
    );
  });

  it('throws when wallet exceeds limit', async () => {
    for (let i = 0; i < 30; i += 1) {
      await enforceSubmitRateLimits(redis, '2.2.2.2', 'wallet');
    }

    await expect(enforceSubmitRateLimits(redis, '3.3.3.3', 'wallet')).rejects.toBeInstanceOf(RateLimitError);
  });
});

describe('enforceTileRateLimit', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('allows requests under limit', async () => {
    await expect(enforceTileRateLimit(redis, '1.1.1.1', 5)).resolves.not.toThrow();
  });

  it('throws when tile requests exceed limit', async () => {
    for (let i = 0; i < 120; i += 1) {
      await enforceTileRateLimit(redis, '1.1.1.1', 5);
    }

    await expect(enforceTileRateLimit(redis, '1.1.1.1', 5)).rejects.toBeInstanceOf(RateLimitError);
  });
});


