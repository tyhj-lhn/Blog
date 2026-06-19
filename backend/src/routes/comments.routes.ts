import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { notFound, validationError } from '../lib/errors.js';
import { buildCommentTree, FlatComment } from '../lib/comments.js';
import { authGuard } from '../middleware/auth.js';
import { rateLimitPresets } from '../middleware/rate-limit.js';
import {
  createCommentSchema,
  commentPostIdParamsSchema,
  commentIdParamsSchema,
} from '../schemas/comment.schema.js';

function threadedQuery(postId: number) {
  return prisma.$queryRawUnsafe<FlatComment[]>(
    `WITH RECURSIVE comment_tree AS (
  SELECT c.id, c.content, c.post_id AS "postId", c.username,
         c.email, c.website_url AS "websiteUrl",
         c.parent_id AS "parentId", c.created_at AS "createdAt",
         0 AS depth, ARRAY[c.id] AS path
  FROM comments c
  WHERE c.post_id = $1 AND c.parent_id IS NULL
  UNION ALL
  SELECT c.id, c.content, c.post_id AS "postId", c.username,
         c.email, c.website_url AS "websiteUrl",
         c.parent_id AS "parentId", c.created_at AS "createdAt",
         ct.depth + 1, ct.path || c.id
  FROM comments c
  JOIN comment_tree ct ON c.parent_id = ct.id
)
SELECT * FROM comment_tree ORDER BY path;`,
    postId,
  );
}

export default async function commentsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/comments/:postId — threaded
  fastify.get('/comments/:postId', {
    schema: { params: commentPostIdParamsSchema },
  }, async (request) => {
    const { postId } = request.params as { postId: number };

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw notFound('Post');

    const flat = await threadedQuery(postId);
    return { data: buildCommentTree(flat), total: flat.length };
  });

  // POST /api/comments — create (public, no auth needed)
  fastify.post('/comments', {
    config: { rateLimit: rateLimitPresets.comment },
    schema: { body: createCommentSchema },
  }, async (request, reply) => {
    const body = request.body as {
      content: string; postId: number; username: string;
      email?: string; websiteUrl?: string; parentId?: number;
    };

    const post = await prisma.post.findUnique({
      where: { id: body.postId },
      select: { id: true, status: true },
    });
    if (!post) throw notFound('Post');
    if (post.status !== 'PUBLISHED') throw validationError('Cannot comment on unpublished post');

    if (body.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: body.parentId },
        select: { postId: true },
      });
      if (!parent) throw notFound('Parent comment');
      if (parent.postId !== body.postId) throw validationError('Parent comment does not belong to this post');
    }

    const comment = await prisma.comment.create({
      data: {
        content: body.content.trim(),
        postId: body.postId,
        username: body.username.trim(),
        email: body.email?.trim() ?? null,
        websiteUrl: body.websiteUrl?.trim() ?? null,
        parentId: body.parentId ?? null,
      },
    });

    return reply.status(201).send(comment);
  });

  // DELETE /api/admin/comments/:id — admin only
  fastify.delete('/admin/comments/:id', {
    preHandler: [authGuard],
    schema: { params: commentIdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: number };

    const existing = await prisma.comment.findUnique({ where: { id } });
    if (!existing) throw notFound('Comment');

    await prisma.comment.delete({ where: { id } });

    return reply.status(204).send();
  });
}
