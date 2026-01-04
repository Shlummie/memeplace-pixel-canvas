import type { FastifyInstance } from 'fastify';

import { registerConfigRoute } from './config';
import { registerCooldownRoute } from './cooldown';
import { registerSubmitRoute } from './submit';
import { registerTileRoute } from './tile';
import { registerWsRoute } from './ws';

export function registerRoutes(app: FastifyInstance) {
  registerConfigRoute(app);
  registerCooldownRoute(app);
  registerSubmitRoute(app);
  registerTileRoute(app);
  registerWsRoute(app);
}

