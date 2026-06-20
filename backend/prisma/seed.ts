import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ---------- Admin user ----------
  const passwordHash = await bcrypt.hash('admin123456', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@memorystory.dev' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@memorystory.dev',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // ---------- Sample posts (idempotent via upsert on unique slug) ----------
  const post1 = await prisma.post.upsert({
    where: { slug: 'blog-setup' },
    update: {},
    create: {
      title: '博客搭建记录',
      slug: 'blog-setup',
      content: `## 为什么选择这个技术栈

在搭建这个博客之前，我花了很长时间做技术调研。最终选择了 Fastify + React + PostgreSQL 的组合。

### 后端：Fastify 5

Fastify 以性能著称，它的 JSON Schema 验证和插件体系非常适合 API 开发。

### 前端：React 19 + Vite

React 生态成熟，Vite 的热更新体验极佳。

### 数据库：PostgreSQL 16

PG 的 JSONB、全文搜索和递归 CTE 都是博客开发中很实用的功能。`.trim(),
      excerpt: '技术选型背后的思考',
      status: 'PUBLISHED',
      tags: ['技术', '博客'],
      authorId: admin.id,
    },
  });

  const post2 = await prisma.post.upsert({
    where: { slug: 'swiss-modernism-intro' },
    update: {},
    create: {
      title: '瑞士现代主义设计入门',
      slug: 'swiss-modernism-intro',
      content: `## 少即是多

瑞士现代主义在 20 世纪 50 年代兴起，以简洁、功能性和网格系统闻名。

### 核心理念

1. **网格系统**：为内容提供结构，但不可见
2. **排版优先**：无衬线字体，清晰的层级
3. **留白**：给内容呼吸的空间
4. **功能导向**：每个元素都有存在的理由

这套设计理念至今仍然深深影响着网页设计。`.trim(),
      excerpt: '了解瑞士现代主义设计的基本原则',
      status: 'PUBLISHED',
      tags: ['设计', 'UI/UX'],
      authorId: admin.id,
    },
  });

  // ---------- Sample comments (idempotent — skip if posts already have comments) ----------
  const existingComments = await prisma.comment.count({ where: { postId: post1.id } });
  if (existingComments === 0) {
    await prisma.comment.create({
      data: {
        content: '期待更多技术分享！',
        username: '前端爱好者',
        email: 'reader1@example.com',
        websiteUrl: 'https://example.dev',
        postId: post1.id,
      },
    });

    const parentComment = await prisma.comment.create({
      data: {
        content: '网格系统真的非常重要，我最近也在学习。',
        username: '设计师小王',
        postId: post2.id,
      },
    });

    // Reply to parent (threaded)
    await prisma.comment.create({
      data: {
        content: '同感，推荐看看 Josef Müller-Brockmann 的书。',
        username: 'typography-ninja',
        websiteUrl: 'https://my-blog.example.com',
        postId: post2.id,
        parentId: parentComment.id,
      },
    });
  }

  // ---------- Sample guestbook messages (idempotent — skip if any exist) ----------
  const existingGuestbook = await prisma.guestbook.count();
  if (existingGuestbook === 0) {
    await prisma.guestbook.create({
      data: {
        nickname: '过路人',
        message: '偶然发现了这里，设计很舒服，留个足迹 👋',
      },
    });

    await prisma.guestbook.create({
      data: {
        nickname: '老读者',
        message: '从 RSS 过来的，每一篇都追了，继续加油！',
      },
    });
  }

  // ---------- About page content ----------
  await prisma.about.upsert({
    where: { id: 1 },
    update: {},
    create: {
      greetingTitle: '你好',
      greetingContent: '欢迎来到 MemoryStory，这是我的个人博客。在这里，我记录技术思考，分享生活感悟，整理学习笔记。',
      aboutTitle: '关于这个博客',
      aboutContent: '这个博客使用 React + TypeScript + Fastify + PostgreSQL 构建，采用瑞士现代主义设计风格（Swiss Modernism），追求简洁、清晰、克制的视觉表达。评论系统支持盖楼模式，欢迎在任何文章下留下你的想法。',
      email: 'hello@example.com',
      github: 'https://github.com',
      location: 'Earth, Solar System',
    },
  });

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
