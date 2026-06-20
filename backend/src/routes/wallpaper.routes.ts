import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authGuard, adminGuard } from '../middleware/auth.js';
import { updateWallpaperSchema } from '../schemas/wallpaper.schema.js';

export default async function wallpaperRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/wallpaper — public, for homepage hero
  fastify.get('/wallpaper', async () => {
    const wp = await prisma.wallpaper.findUnique({ where: { id: 1 } });
    if (!wp) return null;
    return { type: wp.type, url: wp.url };
  });

  // GET /api/admin/wallpaper — admin read
  fastify.get('/admin/wallpaper', {
    preHandler: [authGuard, adminGuard],
  }, async () => {
    const wp = await prisma.wallpaper.findUnique({ where: { id: 1 } });
    if (!wp) return null;
    return wp;
  });

  // PUT /api/admin/wallpaper — admin upsert
  fastify.put('/admin/wallpaper', {
    preHandler: [authGuard, adminGuard],
    schema: { body: updateWallpaperSchema },
  }, async (request) => {
    const { type, url } = request.body as { type: string; url: string };

    const wp = await prisma.wallpaper.upsert({
      where: { id: 1 },
      update: { type, url },
      create: { id: 1, type, url },
    });

    return wp;
  });

  // DELETE /api/admin/wallpaper — admin reset to default
  fastify.delete('/admin/wallpaper', {
    preHandler: [authGuard, adminGuard],
  }, async (_request, reply) => {
    await prisma.wallpaper.deleteMany();
    reply.code(204).send();
  });
}
