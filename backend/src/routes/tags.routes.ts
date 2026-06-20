import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

interface TagRow {
  tag: string;
  count: number;
}

export default async function tagsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/tags', async () => {
    const rows = await prisma.$queryRawUnsafe<TagRow[]>(
      `SELECT unnest(tags) AS tag, COUNT(*)::int AS count
       FROM posts WHERE status = 'PUBLISHED'
       GROUP BY tag ORDER BY count DESC;`,
    );

    return {
      data: rows.map((r) => ({ tag: r.tag, count: r.count })),
    };
  });
}
