import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

export function registerWsRoute(app: FastifyInstance) {
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    app.connections.add(socket);

    socket.once('close', () => {
      app.connections.delete(socket);
    });
  });
}

