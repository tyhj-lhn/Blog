import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, extname } from 'node:path';
import { authGuard } from '../middleware/auth.js';

const UPLOADS_DIR = join(import.meta.dirname, '../../uploads');
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default async function uploadRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/admin/upload — upload image file
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
      return reply.status(400).send({ error: { code: 'INVALID_TYPE', message: '仅支持 JPG 和 PNG 图片' } });
    }

    const ext = extname(data.filename).toLowerCase() || '.jpg';
    const safeExt = ext === '.jpeg' ? '.jpg' : ext;
    const filename = `${randomUUID()}${safeExt}`;
    const filepath = join(UPLOADS_DIR, filename);

    await pipeline(data.file, createWriteStream(filepath));

    const url = `/uploads/${filename}`;
    return reply.status(201).send({ url });
  });
}
