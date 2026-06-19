import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { authGuard } from '../middleware/auth.js';

export default async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/admin/stats', {
    preHandler: [authGuard],
  }, async () => {
    const [
      totalPosts, publishedPosts, draftPosts,
      totalComments, totalGuestbook,
      recentPosts, recentComments,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: 'PUBLISHED' } }),
      prisma.post.count({ where: { status: 'DRAFT' } }),
      prisma.comment.count(),
      prisma.guestbook.count(),
      prisma.post.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, viewCount: true, createdAt: true },
      }),
      prisma.comment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, content: true, username: true, createdAt: true,
          post: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      totalPosts, publishedPosts, draftPosts,
      totalComments, totalGuestbook,
      recentPosts, recentComments,
    };
  });
}
