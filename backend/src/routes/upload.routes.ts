import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { readdir, stat, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join, extname } from 'node:path';
import { authGuard } from '../middleware/auth.js';

const UPLOADS_DIR = join(import.meta.dirname, '../../uploads');
// Ensure the uploads directory exists (Node.js createWriteStream doesn't auto-create dirs)
mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'video/mp4'];
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.mp4']);

function extToType(ext: string): 'image' | 'video' | null {
  const e = ext.toLowerCase();
  if (e === '.jpg' || e === '.jpeg' || e === '.png') return 'image';
  if (e === '.mp4') return 'video';
  return null;
}

export default async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/admin/upload — upload image/video file
  fastify.post('/admin/upload', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: '请选择文件' } });
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      // discard the stream
      data.file.resume();
      return reply.status(400).send({ error: { code: 'INVALID_TYPE', message: '仅支持 JPG、PNG 和 MP4 文件' } });
    }

    const ext = extname(data.filename).toLowerCase() || '.jpg';
    // Defense-in-depth: validate extension as well
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      data.file.resume();
      return reply.status(400).send({ error: { code: 'INVALID_TYPE', message: '仅支持 JPG、PNG 和 MP4 文件' } });
    }

    const safeExt = ext === '.jpeg' ? '.jpg' : ext;
    const filename = `${randomUUID()}${safeExt}`;
    const filepath = join(UPLOADS_DIR, filename);

    await pipeline(data.file, createWriteStream(filepath));

    const url = `/uploads/${filename}`;
    return reply.status(201).send({ url });
  });

  // GET /api/admin/uploads — list all uploaded files
  fastify.get('/admin/uploads', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    try {
      const dirents = await readdir(UPLOADS_DIR, { withFileTypes: true });
      const files = await Promise.all(
        dirents
          .filter((d) => {
            if (!d.isFile()) return false;
            const ext = extname(d.name).toLowerCase();
            return ALLOWED_EXTENSIONS.has(ext);
          })
          .map(async (d) => {
            const filepath = join(UPLOADS_DIR, d.name);
            const s = await stat(filepath);
            const ext = extname(d.name).toLowerCase();
            const safeExt = ext === '.jpeg' ? '.jpg' : ext;
            return {
              filename: d.name,
              url: `/uploads/${d.name}`,
              type: extToType(safeExt)!,
              size: s.size,
              modifiedAt: s.mtime.toISOString(),
            };
          }),
      );

      // Sort newest first
      files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

      return reply.send(files);
    } catch (err) {
      request.log.error(err, 'Failed to list uploads');
      return reply.status(500).send({ error: { code: 'LIST_ERROR', message: '读取文件列表失败' } });
    }
  });

  // DELETE /api/admin/uploads/:filename — delete an uploaded file
  fastify.delete('/admin/uploads/:filename', {
    preHandler: [authGuard],
  }, async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Prevent path traversal
    if (filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') {
      return reply.status(400).send({ error: { code: 'INVALID_FILENAME', message: '无效的文件名' } });
    }

    const ext = extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ error: { code: 'INVALID_TYPE', message: '不支持的文件类型' } });
    }

    const filepath = join(UPLOADS_DIR, filename);

    try {
      await unlink(filepath);
      reply.code(204).send();
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: '文件不存在' } });
      }
      request.log.error(err, 'Failed to delete upload');
      return reply.status(500).send({ error: { code: 'DELETE_ERROR', message: '删除文件失败' } });
    }
  });
}
