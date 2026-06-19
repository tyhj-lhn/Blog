import { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { unauthorized, forbidden } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: number;
    userRole?: string;
  }
}

export async function authGuard(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw unauthorized();
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    throw unauthorized('Invalid or expired token');
  }

  request.userId = payload.id;
  request.userRole = payload.role;
}

export async function adminGuard(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (request.userRole !== 'ADMIN') {
    throw forbidden();
  }
}
