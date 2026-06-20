import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authGuard } from '../middleware/auth.js';
import { updateAboutSchema } from '../schemas/about.schema.js';

export default async function aboutRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/about — public, returns first About record or null
  fastify.get('/about', async () => {
    const record = await prisma.about.findFirst();
    if (!record) return null;
    return record;
  });

  // PUT /api/admin/about — admin upsert
  fastify.put('/admin/about', {
    preHandler: [authGuard],
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
      update: body,
      create: { id: 1, ...body },
    });

    return record;
  });
}
