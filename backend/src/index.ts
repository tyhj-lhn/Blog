import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppError } from './lib/errors.js';
import prisma from './lib/prisma.js';
import { rateLimitPresets } from './middleware/rate-limit.js';
import { validateSecrets } from './lib/jwt.js';

import authRoutes from './routes/auth.routes.js';
import guestbookRoutes from './routes/guestbook.routes.js';
import postsRoutes from './routes/posts.routes.js';
import commentsRoutes from './routes/comments.routes.js';
import tagsRoutes from './routes/tags.routes.js';
import adminRoutes from './routes/admin.routes.js';

export function buildApp() {
  const fastify = Fastify({
    logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug' },
    bodyLimit: 524288, // 512 KB — sufficient for blog content, prevents DoS
  });

  // Validate JWT secrets at startup (production safety check)
  validateSecrets(fastify.log);

  // ---- Plugins ----
  fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  fastify.register(helmet, { contentSecurityPolicy: false });

  fastify.register(rateLimit, rateLimitPresets.global);

  // ---- Routes ----
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(guestbookRoutes, { prefix: '/api' });
  fastify.register(postsRoutes, { prefix: '/api' });
  fastify.register(commentsRoutes, { prefix: '/api' });
  fastify.register(tagsRoutes, { prefix: '/api' });
  fastify.register(adminRoutes, { prefix: '/api' });

  // ---- Error handler ----
  fastify.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    const err = error as { validation?: unknown; message?: string; statusCode?: number; code?: string };
    if (err.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message ?? 'Validation failed',
          details: err.validation,
        },
      });
    }

    // Handle Fastify framework errors that carry their own statusCode
    if (err.statusCode) {
      return reply.status(err.statusCode).send({
        error: { code: err.code ?? 'REQUEST_ERROR', message: err.message ?? 'Request error' },
      });
    }

    request.log.error(error instanceof Error ? error : String(error));
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  // ---- Graceful shutdown ----
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return fastify;
}

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const app = buildApp();
  try {
    await app.listen({ port: Number(process.env.PORT) || 3001, host: process.env.HOST || '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
