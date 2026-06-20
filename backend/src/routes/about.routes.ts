import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authGuard, adminGuard } from '../middleware/auth.js';
import { sanitizeContent } from '../lib/sanitize.js';
import { updateAboutSchema } from '../schemas/about.schema.js';

export default async function aboutRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/about — public, returns first About record or null
  fastify.get('/about', async () => {
    const record = await prisma.about.findUnique({ where: { id: 1 } });
    if (!record) return null;
    return record;
  });

  // PUT /api/admin/about — admin upsert
  fastify.put('/admin/about', {
    preHandler: [authGuard, adminGuard],
    schema: { body: updateAboutSchema },
  }, async (request) => {
    const body = request.body as {
      greetingTitle: string;
      greetingContent: string;
      aboutTitle: string;
      aboutContent: string;
      email?: string | null;
      github?: string | null;
      location?: string | null;
    };

    const record = await prisma.about.upsert({
      where: { id: 1 },
      update: {
        greetingTitle: sanitizeContent(body.greetingTitle),
        greetingContent: sanitizeContent(body.greetingContent),
        aboutTitle: sanitizeContent(body.aboutTitle),
        aboutContent: sanitizeContent(body.aboutContent),
        email: body.email?.trim() ?? null,
        github: body.github?.trim() ?? null,
        location: body.location ? sanitizeContent(body.location) : null,
      },
      create: {
        id: 1,
        greetingTitle: sanitizeContent(body.greetingTitle),
        greetingContent: sanitizeContent(body.greetingContent),
        aboutTitle: sanitizeContent(body.aboutTitle),
        aboutContent: sanitizeContent(body.aboutContent),
        email: body.email?.trim() ?? null,
        github: body.github?.trim() ?? null,
        location: body.location ? sanitizeContent(body.location) : null,
      },
    });

    return record;
  });
}
