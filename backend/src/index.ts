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

// ---- Global error handlers (must be set before any async work) ----

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — process will exit:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // Log but do NOT exit — unhandled rejections are often transient
  // (e.g. Prisma internal connection cleanup)
  console.error('UNHANDLED REJECTION:', {
    type: reason instanceof Error ? 'Error' : typeof reason,
    name: reason instanceof Error ? reason.name : undefined,
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// PM2 sends SIGINT for graceful shutdown
let isShuttingDown = false;
process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('SIGINT received — graceful shutdown in progress');
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('SIGTERM received — graceful shutdown in progress');
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
});

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
      request.log.warn({ code: error.code, statusCode: error.statusCode }, error.message);
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      });
    }

    const err = error as { validation?: unknown; message?: string; statusCode?: number; code?: string };
    if (err.validation) {
      request.log.warn({ validation: true }, err.message ?? 'Validation failed');
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
      request.log.warn({ statusCode: err.statusCode, code: err.code }, err.message ?? 'Request error');
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

/**
 * Start the server: connect to DB, listen on port, signal PM2 ready.
 * Exported so CJS boot wrappers can call it directly without relying on
 * `process.argv[1]` (which breaks when PM2 runs a wrapper script).
 */
export async function startServer(): Promise<void> {
  const app = buildApp();

  // Proactive database connection with retry
  // Avoids lazy-connect-on-first-request which can fail silently
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await prisma.$connect();
      app.log.info('Database connected');
      break;
    } catch (dbErr) {
      app.log.error({ attempt, err: dbErr }, 'Database connection attempt failed');
      if (attempt === 2) {
        console.error('FATAL: Could not connect to database after 2 attempts');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 3000)); // 3s delay before retry
    }
  }

  await app.listen({ port: Number(process.env.PORT) || 3001, host: process.env.HOST || '0.0.0.0' });

  // Signal PM2 that the app is ready (matches wait_ready: true in ecosystem.config.cjs)
  if (typeof process.send === 'function') {
    process.send('ready');
  }
}

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  startServer().catch((err) => {
    console.error('FATAL: Failed to start server:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
