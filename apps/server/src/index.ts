import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import Fastify from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';

import { env } from './env';
import { createContext } from './lib/context';
import { createTileStore } from './lib/tileStore';
import { registerRoutes } from './routes';

import WebSocket from 'ws';
import type { AppContext } from './lib/context';
import type { TileStore } from './lib/tileStore';

export async function buildServer() {
  const ctx: AppContext = await createContext(env);
  console.info('[server] creating tile store');
  const tileStore = await createTileStore(ctx.redis);
  console.info('[server] tile store ready');

  const app = Fastify({ logger: true, pluginTimeout: 60000 }).withTypeProvider<ZodTypeProvider>();

  app.log.info('Bootstrapping server…');
  app.log.info({ env: env.SEASON_LABEL }, 'Environment parsed');

  app.addHook('onClose', async () => {
    try {
      await ctx.redis.quit();
    } catch (error) {
      app.log.error({ err: error }, 'Failed to close redis client');
    }
    try {
      await ctx.pg.end();
    } catch (error) {
      app.log.error({ err: error }, 'Failed to close postgres pool');
    }
  });

  await app.register(cors, { origin: true });

  await app.register(websocketPlugin, {
    options: {
      clientTracking: true,
      maxPayload: 1024 * 1024,
    },
  });

  app.log.info('Decorating instance with context');
  app.decorate('ctx', ctx);
  app.decorate('tileStore', tileStore);
  app.decorate('connections', new Set<WebSocket>());

  ctx.broadcast = (message: unknown) => {
    const payload = JSON.stringify(message);
    for (const client of app.connections) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  app.log.info('Registering routes…');
  try {
    registerRoutes(app);
    app.log.info('Routes registered successfully');
  } catch (error) {
    app.log.error({ err: error }, 'Failed to register routes');
    throw error;
  }

  app.log.info('Server bootstrapped');

  return { app, ctx };
}

async function start() {
  const { app } = await buildServer();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

start().catch((error) => {
  appLog('fatal', 'Server failed to start', error);
  process.exit(1);
});

function appLog(level: 'info' | 'error' | 'fatal', message: string, error?: unknown) {
  switch (level) {
    case 'info':
      console.info(`[server] ${message}`, error ?? '');
      break;
    case 'error':
      console.error(`[server] ${message}`, error ?? '');
      break;
    case 'fatal':
      console.error(`[server] ${message}`, error ?? '');
      break;
    default:
      console.log(`[server] ${message}`, error ?? '');
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
    tileStore: TileStore;
    connections: Set<WebSocket>;
  }
}

