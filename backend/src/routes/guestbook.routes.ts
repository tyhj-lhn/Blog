import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { paginationSchema } from '../schemas/common.schema.js';
import { createGuestbookSchema } from '../schemas/guestbook.schema.js';
import { rateLimitPresets } from '../middleware/rate-limit.js';
import { sanitizeContent } from '../lib/sanitize.js';

export default async function guestbookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/guestbook', {
    schema: { querystring: paginationSchema },
  }, async (request) => {
    const q = request.query as { page?: number; limit?: number };
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.guestbook.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.guestbook.count(),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  });

  fastify.post('/guestbook', {
    config: { rateLimit: rateLimitPresets.guestbook },
    schema: { body: createGuestbookSchema },
  }, async (request, reply) => {
    const { nickname, message } = request.body as { nickname: string; message: string };

    const entry = await prisma.guestbook.create({
      data: {
        nickname: sanitizeContent(nickname),
        message: sanitizeContent(message),
      },
    });

    return reply.status(201).send(entry);
  });
}
