import {
  createClient as createRedisClient,
  type RedisClientType,
  type RedisDefaultModules,
  type RedisFunctions,
  type RedisScripts,
} from 'redis';

import { loadConfig } from '../config/loadConfig';
import { env as envSchema } from '../env';

import { createPool } from './db';
import { createEventManager, type EventManager } from './events';

import type { Env } from '../env';
import type { PgPool } from './db';


export type RedisClient = RedisClientType<RedisDefaultModules, RedisFunctions, RedisScripts>;

export interface AppConfig {
  pixelCost: number;
  walletCooldownSeconds: number;
  maxPixelsPerBatch: number;
}

export interface AppContext {
  env: Env;
  redis: RedisClient;
  pg: PgPool;
  wsAllowedOrigins: string[];
  broadcast: (message: unknown) => void;
  events: EventManager;
  config: AppConfig;
}

export async function createContext(env: Env = envSchema): Promise<AppContext> {
  const redis: RedisClient = createRedisClient({ url: env.REDIS_URL });
  const pg = createPool(env.DATABASE_URL);
  const events = createEventManager();
  const config = loadConfig();

  redis.on('error', (error: Error) => {
    console.error('[redis] connection error', error);
  });

  console.info('[context] connecting to redis…');
  await redis.connect();
  console.info('[context] redis connected');

  return {
    env,
    redis,
    pg,
    wsAllowedOrigins: env.WS_ALLOWED_ORIGINS ?? [],
    broadcast: () => undefined,
    events,
    config,
  };
}

