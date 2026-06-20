import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { generateTokenPair, verifyRefreshToken } from '../lib/jwt.js';
import { unauthorized, conflict, validationError } from '../lib/errors.js';
import { loginSchema, refreshSchema, updateProfileSchema, changePasswordSchema } from '../schemas/auth.schema.js';
import { rateLimitPresets } from '../middleware/rate-limit.js';
import { authGuard } from '../middleware/auth.js';
import { checkLockout, recordFailedAttempt, resetFailedAttempts } from '../lib/login-guard.js';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/login', {
    config: { rateLimit: rateLimitPresets.auth },
    schema: { body: loginSchema },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    // Normalize email: lowercase + trim
    const normalizedEmail = email.toLowerCase().trim();

    // Check progressive lockout BEFORE DB query
    checkLockout(normalizedEmail);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      recordFailedAttempt(normalizedEmail);
      throw unauthorized('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      recordFailedAttempt(normalizedEmail);
      throw unauthorized('Invalid credentials');
    }

    // Successful login — reset lockout counter
    resetFailedAttempts(normalizedEmail);

    const tokens = generateTokenPair({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return reply.send({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar },
    });
  });

  fastify.post('/refresh', {
    config: { rateLimit: rateLimitPresets.auth },
    schema: { body: refreshSchema },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) throw unauthorized('Invalid or expired refresh token');

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw unauthorized('User no longer exists');

    // Verify tokenVersion matches DB (enables token revocation)
    if (decoded.tokenVersion !== user.tokenVersion) {
      throw unauthorized('Token has been revoked — please log in again');
    }

    const tokens = generateTokenPair({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    return reply.send({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  });

  // GET /api/auth/me — rehydrate user state on page refresh
  fastify.get('/me', {
    preHandler: [authGuard],
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.userId! },
      select: { id: true, username: true, email: true, role: true, avatar: true },
    });
    if (!user) throw unauthorized('User no longer exists');
    return user;
  });

  // PUT /api/auth/me — update profile (username / avatar)
  fastify.put('/me', {
    preHandler: [authGuard],
    schema: { body: updateProfileSchema },
  }, async (request, reply) => {
    const { username, avatar } = request.body as { username?: string; avatar?: string | null };
    const userId = request.userId!;

    // At least one field must be provided
    if (username === undefined && avatar === undefined) {
      throw validationError('At least one of username or avatar is required');
    }

    // Check username uniqueness if changing
    if (username !== undefined) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== userId) {
        throw conflict('Username already taken');
      }
    }

    const data: Record<string, unknown> = {};
    if (username !== undefined) data.username = username;
    if (avatar !== undefined) data.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, email: true, role: true, avatar: true },
    });

    return reply.send(user);
  });

  // PUT /api/auth/me/password — change password
  fastify.put('/me/password', {
    config: { rateLimit: rateLimitPresets.auth },
    preHandler: [authGuard],
    schema: { body: changePasswordSchema },
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    const userId = request.userId!;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized('User no longer exists');

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw unauthorized('Current password is incorrect');

    // Hash new password and bump tokenVersion to revoke all existing tokens
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    return reply.send({ message: 'Password changed successfully' });
  });
}
