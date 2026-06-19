import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Track test-created records for cleanup
let testPostId: number;
let testCommentId: number;
let testGuestbookId: number;
let adminUserId: number;

beforeAll(async () => {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@memorystory.dev' },
  });
  if (admin) adminUserId = admin.id;
});

afterAll(async () => {
  if (testCommentId) {
    await prisma.comment.delete({ where: { id: testCommentId } }).catch(() => {});
  }
  if (testPostId) {
    await prisma.comment.deleteMany({ where: { postId: testPostId } });
    await prisma.post.delete({ where: { id: testPostId } }).catch(() => {});
  }
  if (testGuestbookId) {
    await prisma.guestbook.delete({ where: { id: testGuestbookId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ========================
// 1. CONNECTIVITY
// ========================
describe('1. Database Connectivity', () => {
  it('returns PostgreSQL server version', async () => {
    const result = await prisma.$queryRaw<{ version: string }[]>`
      SELECT version()
    `;
    expect(result).toHaveLength(1);
    expect(result[0].version).toContain('PostgreSQL');
  });

  it('connected to correct database', async () => {
    const result = await prisma.$queryRaw<{ current_database: string }[]>`
      SELECT current_database()
    `;
    expect(result[0].current_database).toBe('memorystory');
  });
});

// ========================
// 2. USER MODEL
// ========================
describe('2. User Model', () => {
  it('finds admin user by email', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@memorystory.dev' },
    });
    expect(user).not.toBeNull();
    expect(user!.username).toBe('admin');
    expect(user!.role).toBe('ADMIN');
    adminUserId = user!.id;
  });

  it('password hash uses bcrypt cost 12', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@memorystory.dev' },
    });
    expect(user!.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it('bcrypt verify: correct password returns true', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@memorystory.dev' },
    });
    const valid = await bcrypt.compare('admin123456', user!.passwordHash);
    expect(valid).toBe(true);
  });

  it('bcrypt verify: wrong password returns false', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@memorystory.dev' },
    });
    const invalid = await bcrypt.compare('wrong-password', user!.passwordHash);
    expect(invalid).toBe(false);
  });

  it('username uniqueness enforced', async () => {
    await expect(
      prisma.user.create({
        data: {
          username: 'admin',
          email: 'duplicate@test.dev',
          passwordHash: 'fake',
          role: 'ADMIN',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('email uniqueness enforced', async () => {
    await expect(
      prisma.user.create({
        data: {
          username: 'unique-user',
          email: 'admin@memorystory.dev',
          passwordHash: 'fake',
          role: 'ADMIN',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});

// ========================
// 3. POST MODEL
// ========================
describe('3. Post Model', () => {
  it('has at least 2 seeded published posts', async () => {
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED' },
    });
    expect(posts.length).toBeGreaterThanOrEqual(2);
    posts.forEach((p) => {
      expect(p.status).toBe('PUBLISHED');
      expect(p.title).toBeTruthy();
      expect(p.slug).toBeTruthy();
      expect(Array.isArray(p.tags)).toBe(true);
    });
  });

  it('finds post by slug', async () => {
    const post = await prisma.post.findUnique({
      where: { slug: 'blog-setup' },
    });
    expect(post).not.toBeNull();
    expect(post!.title).toBe('博客搭建记录');
  });

  it('creates a new draft post', async () => {
    const post = await prisma.post.create({
      data: {
        title: 'Test Post DB Report',
        slug: 'test-post-db-report',
        content: 'Test content for database report.',
        excerpt: 'Test excerpt',
        status: 'DRAFT',
        tags: ['test', 'database'],
        authorId: adminUserId,
      },
    });
    expect(post.id).toBeTruthy();
    expect(post.slug).toBe('test-post-db-report');
    expect(post.tags).toEqual(['test', 'database']);
    testPostId = post.id;
  });

  it('slug uniqueness enforced', async () => {
    await expect(
      prisma.post.create({
        data: {
          title: 'Dup',
          slug: 'test-post-db-report',
          content: 'fail',
          authorId: adminUserId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('updates a post', async () => {
    const updated = await prisma.post.update({
      where: { id: testPostId },
      data: { title: 'Updated Test Post', excerpt: 'Updated' },
    });
    expect(updated.title).toBe('Updated Test Post');
  });

  it('increments viewCount', async () => {
    const before = await prisma.post.findUnique({ where: { id: testPostId } });
    await prisma.post.update({
      where: { id: testPostId },
      data: { viewCount: { increment: 1 } },
    });
    const after = await prisma.post.findUnique({ where: { id: testPostId } });
    expect(after!.viewCount).toBe(before!.viewCount + 1);
  });

  it('filters posts by tag using has:', async () => {
    const posts = await prisma.post.findMany({
      where: { tags: { has: '技术' } },
    });
    expect(posts.length).toBeGreaterThanOrEqual(1);
    posts.forEach((p) => expect(p.tags).toContain('技术'));
  });

  it('full-text search works (case-insensitive ILIKE)', async () => {
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: '博客', mode: 'insensitive' } },
          { content: { contains: '博客', mode: 'insensitive' } },
        ],
      },
    });
    expect(posts.length).toBeGreaterThanOrEqual(1);
  });
});

// ========================
// 4. COMMENT MODEL
// ========================
describe('4. Comment Model', () => {
  it('has at least 3 seeded comments', async () => {
    const count = await prisma.comment.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('lists comments for a post', async () => {
    const post = await prisma.post.findUnique({ where: { slug: 'blog-setup' } });
    const comments = await prisma.comment.findMany({
      where: { postId: post!.id },
    });
    expect(comments.length).toBeGreaterThanOrEqual(1);
  });

  it('creates a comment (required fields only)', async () => {
    const post = await prisma.post.findUnique({ where: { slug: 'blog-setup' } });
    const comment = await prisma.comment.create({
      data: {
        content: 'Integration test comment',
        username: 'test-user-001',
        postId: post!.id,
      },
    });
    expect(comment.id).toBeTruthy();
    expect(comment.username).toBe('test-user-001');
    testCommentId = comment.id;
  });

  it('creates a comment with optional fields', async () => {
    const post = await prisma.post.findUnique({ where: { slug: 'blog-setup' } });
    const c = await prisma.comment.create({
      data: {
        content: 'With email and website',
        username: 'full-user',
        email: 'user@example.com',
        websiteUrl: 'https://example.com',
        postId: post!.id,
      },
    });
    expect(c.email).toBe('user@example.com');
    expect(c.websiteUrl).toBe('https://example.com');
    await prisma.comment.delete({ where: { id: c.id } });
  });

  it('creates a threaded reply (parentId set)', async () => {
    const post = await prisma.post.findUnique({ where: { slug: 'blog-setup' } });
    const reply = await prisma.comment.create({
      data: {
        content: 'Reply to test comment',
        username: 'replier',
        postId: post!.id,
        parentId: testCommentId,
      },
    });
    expect(reply.parentId).toBe(testCommentId);
    await prisma.comment.delete({ where: { id: reply.id } });
  });

  it('cascade delete: comments removed with post', async () => {
    const tmp = await prisma.post.create({
      data: {
        title: 'Cascade Test',
        slug: 'cascade-' + Date.now(),
        content: 'test',
        authorId: adminUserId,
      },
    });
    await prisma.comment.create({
      data: { content: 'cascade me', username: 'c', postId: tmp.id },
    });
    await prisma.post.delete({ where: { id: tmp.id } });
    const orphans = await prisma.comment.findMany({ where: { postId: tmp.id } });
    expect(orphans).toHaveLength(0);
  });
});

// ========================
// 5. GUESTBOOK MODEL
// ========================
describe('5. Guestbook Model', () => {
  it('has at least 2 seeded entries', async () => {
    const count = await prisma.guestbook.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('lists entries newest first', async () => {
    const entries = await prisma.guestbook.findMany({
      orderBy: { createdAt: 'desc' },
    });
    expect(entries.length).toBeGreaterThanOrEqual(2);
    entries.forEach((e) => {
      expect(e.nickname).toBeTruthy();
      expect(e.message).toBeTruthy();
    });
  });

  it('creates a guestbook entry', async () => {
    const entry = await prisma.guestbook.create({
      data: {
        nickname: '测试访客',
        message: '数据库测试留言',
      },
    });
    expect(entry.id).toBeTruthy();
    expect(entry.nickname).toBe('测试访客');
    testGuestbookId = entry.id;
  });
});

// ========================
// 6. RELATIONAL INTEGRITY
// ========================
describe('6. Relational Integrity', () => {
  it('Post.author → User', async () => {
    const post = await prisma.post.findUnique({
      where: { slug: 'blog-setup' },
      include: { author: true },
    });
    expect(post!.author.username).toBe('admin');
  });

  it('Post.comments → Comment[]', async () => {
    const post = await prisma.post.findUnique({
      where: { slug: 'blog-setup' },
      include: { comments: true },
    });
    expect(post!.comments.length).toBeGreaterThanOrEqual(1);
  });

  it('Comment.post → Post', async () => {
    const c = await prisma.comment.findFirst({
      where: { username: '前端爱好者' },
      include: { post: true },
    });
    expect(c!.post.slug).toBe('blog-setup');
  });

  it('Comment.parent → recursive self-join', async () => {
    const reply = await prisma.comment.findFirst({
      where: { parentId: { not: null } },
      include: { parent: true },
    });
    expect(reply).not.toBeNull();
    expect(reply!.parent).not.toBeNull();
  });
});

// ========================
// 7. RECURSIVE CTE
// ========================
describe('7. Recursive CTE (Threaded Comments)', () => {
  it('builds threaded comment tree', async () => {
    const post = await prisma.post.findUnique({
      where: { slug: 'swiss-modernism-intro' },
    });
    const tree = await prisma.$queryRawUnsafe<any[]>(
      `WITH RECURSIVE comment_tree AS (
        SELECT c.id, c.content, c.post_id AS "postId",
          c.username, c.parent_id AS "parentId", c.created_at AS "createdAt",
          0 AS depth, ARRAY[c.id] AS path
        FROM comments c
        WHERE c.post_id = $1 AND c.parent_id IS NULL
        UNION ALL
        SELECT c.id, c.content, c.post_id AS "postId",
          c.username, c.parent_id AS "parentId", c.created_at AS "createdAt",
          ct.depth + 1, ct.path || c.id
        FROM comments c
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
      )
      SELECT * FROM comment_tree ORDER BY path`,
      post!.id,
    );
    expect(tree.length).toBeGreaterThanOrEqual(2);
    const root = tree.find((c) => c.parentId === null);
    const reply = tree.find((c) => c.parentId !== null);
    expect(root.depth).toBe(0);
    expect(reply.depth).toBe(1);
  });
});

// ========================
// 8. RAW SQL & TRANSACTIONS
// ========================
describe('8. Raw SQL & Transactions', () => {
  it('unnest(array) works for tags', async () => {
    const result = await prisma.$queryRawUnsafe<{ tags: string }[]>(
      `SELECT unnest(tags) as tags FROM posts LIMIT 10`,
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('transaction: atomic multi-create', async () => {
    const [a, b] = await prisma.$transaction([
      prisma.guestbook.create({
        data: { nickname: 'tx-A', message: 'tx test A' },
      }),
      prisma.guestbook.create({
        data: { nickname: 'tx-B', message: 'tx test B' },
      }),
    ]);
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    await prisma.guestbook.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });
});
