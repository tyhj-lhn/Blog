import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { AppError } from './lib/errors.js';
import prisma from './lib/prisma.js';
import { rateLimitPresets } from './middleware/rate-limit.js';
import { validateSecrets } from './lib/jwt.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.routes.js';
import guestbookRoutes from './routes/guestbook.routes.js';
import postsRoutes from './routes/posts.routes.js';
import commentsRoutes from './routes/comments.routes.js';
import tagsRoutes from './routes/tags.routes.js';
import adminRoutes from './routes/admin.routes.js';
import wallpaperRoutes from './routes/wallpaper.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import aboutRoutes from './routes/about.routes.js';

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

  fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
      },
    },
  });

  fastify.register(rateLimit, rateLimitPresets.global);

  // File upload
  fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB

  // Serve uploaded files
  fastify.register(fastifyStatic, {
    root: join(__dirname, '..', 'uploads'),
    prefix: '/uploads/',
  });

  // ---- Routes ----
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(uploadRoutes, { prefix: '/api' });
  fastify.register(guestbookRoutes, { prefix: '/api' });
  fastify.register(postsRoutes, { prefix: '/api' });
  fastify.register(commentsRoutes, { prefix: '/api' });
  fastify.register(tagsRoutes, { prefix: '/api' });
  fastify.register(adminRoutes, { prefix: '/api' });
  fastify.register(wallpaperRoutes, { prefix: '/api' });
  fastify.register(aboutRoutes, { prefix: '/api' });

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
