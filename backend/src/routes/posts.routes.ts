import { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';
import { slugify } from '../lib/slugify.js';
import { notFound } from '../lib/errors.js';
import { authGuard, adminGuard } from '../middleware/auth.js';
import { paginationSchema, searchQuerySchema } from '../schemas/common.schema.js';
import {
  createPostSchema,
  updatePostSchema,
  toggleLikeBodySchema,
  postSlugParamsSchema,
  postIdParamsSchema,
} from '../schemas/post.schema.js';

const summarySelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  status: true,
  tags: true,
  viewCount: true,
  likeCount: true,
  createdAt: true,
  author: { select: { id: true, username: true } },
  _count: { select: { comments: true } },
} as const;

async function makeUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 2;
  while (await prisma.post.findFirst({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}

export default async function postsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/posts — list published (paginated, optional tag filter)
  fastify.get('/posts', {
    schema: { querystring: paginationSchema },
  }, async (request) => {
    const q = request.query as { page?: number; limit?: number; tag?: string };
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const where = {
      status: 'PUBLISHED' as const,
      ...(q.tag ? { tags: { has: q.tag } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: summarySelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /api/posts/:slug — single post + increment viewCount
  fastify.get('/posts/:slug', {
    schema: { params: postSlugParamsSchema },
  }, async (request) => {
    const { slug } = request.params as { slug: string };

    const post = await prisma.post.findUnique({
      where: { slug },
      include: { author: { select: { id: true, username: true } }, _count: { select: { comments: true } } },
    });

    if (!post || post.status !== 'PUBLISHED') throw notFound('Post');

    // fire-and-forget viewCount increment
    // Uses fastify.log (route-scoped) instead of request.log (may be GC'd) to ensure safe error logging
    void (async () => {
      try {
        await prisma.post.updateMany({
          where: { slug, status: 'PUBLISHED' },
          data: { viewCount: { increment: 1 } },
        });
      } catch (err) {
        fastify.log.warn({ err }, 'Failed to increment viewCount for slug=%s', slug);
      }
    })();

    return post;
  });

  // POST /api/posts/:slug/toggle-like — toggle like/unlike
  fastify.post('/posts/:slug/toggle-like', {
    schema: {
      params: postSlugParamsSchema,
      body: toggleLikeBodySchema,
    },
  }, async (request) => {
    const { slug } = request.params as { slug: string };
    const { liked } = request.body as { liked: boolean };

    const newCount = await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { slug },
        select: { id: true, status: true, likeCount: true },
      });
      if (!post || post.status !== 'PUBLISHED') throw notFound('Post');

      const count = Math.max(0, post.likeCount + (liked ? 1 : -1));
      await tx.post.update({ where: { slug }, data: { likeCount: count } });
      return count;
    });

    return { likeCount: newCount };
  });

  // GET /api/search
  fastify.get('/search', {
    schema: { querystring: searchQuerySchema },
  }, async (request) => {
    const { q } = request.query as { q: string };

    const data = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { title: { contains: q, mode: 'insensitive' as const } },
          { content: { contains: q, mode: 'insensitive' as const } },
          { tags: { has: q } },
        ],
      },
      select: summarySelect,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return { data, total: data.length, page: 1, totalPages: 1 };
  });

  // GET /api/admin/posts — list all posts (protected, paginated, optional search/status)
  fastify.get('/admin/posts', {
    preHandler: [authGuard],
    schema: { querystring: paginationSchema },
  }, async (request) => {
    const q = request.query as { page?: number; limit?: number; search?: string; status?: string };
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (q.status === 'PUBLISHED' || q.status === 'DRAFT') {
      where.status = q.status;
    }
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' as const } },
        { content: { contains: q.search, mode: 'insensitive' as const } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: summarySelect,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /api/admin/posts/:id — single post by ID (protected, any status)
  fastify.get('/admin/posts/:id', {
    preHandler: [authGuard],
    schema: { params: postIdParamsSchema },
  }, async (request) => {
    const { id } = request.params as { id: number };

    const post = await prisma.post.findUnique({
      where: { id },
      include: { author: { select: { id: true, username: true } }, _count: { select: { comments: true } } },
    });

    if (!post) throw notFound('Post');

    return post;
  });

  // POST /api/admin/posts — create (protected, admin only)
  fastify.post('/admin/posts', {
    preHandler: [authGuard, adminGuard],
    schema: { body: createPostSchema },
  }, async (request, reply) => {
    const body = request.body as {
      title: string; content: string; excerpt?: string;
      coverImage?: string; status?: string; tags?: string[];
    };

    const post = await prisma.post.create({
      data: {
        title: body.title,
        slug: await makeUniqueSlug(slugify(body.title)),
        content: body.content,
        excerpt: body.excerpt ?? null,
        coverImage: body.coverImage ?? null,
        status: body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        tags: body.tags ?? [],
        authorId: request.userId!,
      },
    });

    return reply.status(201).send(post);
  });

  // PUT /api/admin/posts/:id — update (protected, admin only)
  fastify.put('/admin/posts/:id', {
    preHandler: [authGuard, adminGuard],
    schema: { body: updatePostSchema, params: postIdParamsSchema },
  }, async (request) => {
    const { id } = request.params as { id: number };
    const body = request.body as {
      title?: string; content?: string; excerpt?: string;
      coverImage?: string; status?: string; tags?: string[];
    };

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw notFound('Post');

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) {
      updateData.title = body.title;
      updateData.slug = await makeUniqueSlug(slugify(body.title));
    }
    if (body.content !== undefined) updateData.content = body.content;
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt;
    if (body.coverImage !== undefined) updateData.coverImage = body.coverImage;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.tags !== undefined) updateData.tags = body.tags;

    return prisma.post.update({ where: { id }, data: updateData });
  });

  // DELETE /api/admin/posts/:id — delete (protected, admin only)
  fastify.delete('/admin/posts/:id', {
    preHandler: [authGuard, adminGuard],
    schema: { params: postIdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: number };

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw notFound('Post');

    await prisma.post.delete({ where: { id } });

    return reply.status(204).send();
  });
}
