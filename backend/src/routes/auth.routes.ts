import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateTokenPair, verifyRefreshToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { loginSchema, refreshSchema } from '../schemas/auth.schema.js';
import { rateLimitPresets } from '../middleware/rate-limit.js';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/login', {
    config: { rateLimit: rateLimitPresets.auth },
    schema: { body: loginSchema },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid credentials');

    const tokens = generateTokenPair({ id: user.id, role: user.role });

    return reply.send({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  });

  fastify.post('/refresh', {
    config: { rateLimit: rateLimitPresets.auth },
    schema: { body: refreshSchema },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    const userId = verifyRefreshToken(refreshToken);
    if (!userId) throw unauthorized('Invalid or expired refresh token');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized('User no longer exists');

    const tokens = generateTokenPair({ id: user.id, role: user.role });

    return reply.send({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  });
}
