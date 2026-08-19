import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { config } from '@huddly/config';
import { authRoutes } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { ticketRoutes } from './routes/tickets.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  // Plugins
  await app.register(sensible);
  await app.register(cors, {
    origin: config.CORS_ORIGINS,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  // Auth decorator
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        type: 'https://huddly.app/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid Bearer authentication token is required.',
        code: 'ERR_UNAUTHORIZED',
      });
    }
  });

  // Global Healthcheck
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));
  app.get('/api/v1/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(roomRoutes, { prefix: '/api/v1/rooms' });
  await app.register(ticketRoutes, { prefix: '/api/v1/realtime' });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const start = async () => {
    const server = await buildApp();
    try {
      await server.listen({ port: config.PORT, host: config.HOST });
      server.log.info(`[Huddly API] Server listening on http://${config.HOST}:${config.PORT}`);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };
  void start();
}
