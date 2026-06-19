import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

// ---- Types ----

export interface TokenPayload {
  id: number;
  role: string;
  tokenVersion: number;
}

// ---- Secrets ----

function accessSecret(): string {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
}

function refreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
}

// ---- Startup validation ----

/**
 * Call at startup. Logs a warning if dev defaults are used.
 * Throws in production if secrets are not explicitly set.
 */
export function validateSecrets(logger: { warn: (msg: string) => void }): void {
  const missing: string[] = [];

  if (!process.env.JWT_ACCESS_SECRET) {
    missing.push('JWT_ACCESS_SECRET');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    missing.push('JWT_REFRESH_SECRET');
  }

  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `FATAL: Missing required env vars in production: ${missing.join(', ')}. ` +
        'Dev defaults are not allowed in production.',
      );
    }
    logger.warn(
      `WARNING: Using dev defaults for: ${missing.join(', ')}. ` +
      'Set these environment variables before deploying to production.',
    );
  }
}

// ---- Generation ----

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { id: payload.id, role: payload.role, tokenVersion: payload.tokenVersion },
    accessSecret(),
    {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'],
    },
  );
}

export function generateRefreshToken(userId: number, tokenVersion: number): string {
  return jwt.sign(
    { id: userId, tokenVersion },
    refreshSecret(),
    {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
    },
  );
}

export function generateTokenPair(user: TokenPayload): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user.id, user.tokenVersion),
  };
}

// ---- Verification ----

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, accessSecret()) as jwt.JwtPayload;
    if (
      typeof decoded.id === 'number' &&
      typeof decoded.role === 'string' &&
      typeof decoded.tokenVersion === 'number'
    ) {
      return { id: decoded.id, role: decoded.role, tokenVersion: decoded.tokenVersion };
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: number; tokenVersion: number } | null {
  try {
    const decoded = jwt.verify(token, refreshSecret()) as jwt.JwtPayload;
    if (typeof decoded.id === 'number' && typeof decoded.tokenVersion === 'number') {
      return { userId: decoded.id, tokenVersion: decoded.tokenVersion };
    }
    return null;
  } catch {
    return null;
  }
}
