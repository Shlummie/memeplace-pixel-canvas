
import { registerConfigRoute } from './config';
import { registerCooldownRoute } from './cooldown';
import { registerSubmitRoute } from './submit';
import { registerTileRoute } from './tile';
import { registerWsRoute } from './ws';

import type { FastifyInstance } from 'fastify';

export function registerRoutes(app: FastifyInstance) {
  registerConfigRoute(app);
  registerCooldownRoute(app);
  registerSubmitRoute(app);
  registerTileRoute(app);
  registerWsRoute(app);
}

