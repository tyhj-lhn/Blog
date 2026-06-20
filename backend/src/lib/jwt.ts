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

// Known placeholder/weak patterns that must NOT be used in production
const WEAK_PATTERNS = [
  /^change-me/i,
  /^dev-/i,
  /^secret$/i,
  /^default$/i,
  /^test$/i,
  /^password$/i,
];

function isWeakSecret(value: string): boolean {
  return WEAK_PATTERNS.some((p) => p.test(value));
}

/**
 * Call at startup. Logs a warning if dev defaults are used.
 * Throws in production if secrets are not explicitly set or are weak.
 */
export function validateSecrets(logger: { warn: (msg: string) => void }): void {
  const missing: string[] = [];
  const weak: string[] = [];

  for (const [env, secret] of [
    ['JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET],
  ] as const) {
    if (!secret) {
      missing.push(env);
    } else if (isWeakSecret(secret)) {
      weak.push(env);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (missing.length > 0) {
      throw new Error(
        `FATAL: Missing required env vars in production: ${missing.join(', ')}. ` +
        'Dev defaults are not allowed in production.',
      );
    }
    if (weak.length > 0) {
      throw new Error(
        `FATAL: Weak/placeholder secrets detected in production: ${weak.join(', ')}. ` +
        'Generate cryptographically strong random secrets.',
      );
    }
  } else {
    if (missing.length > 0) {
      logger.warn(
        `WARNING: Using dev defaults for: ${missing.join(', ')}. ` +
        'Set these environment variables before deploying to production.',
      );
    }
    if (weak.length > 0) {
      logger.warn(
        `WARNING: Placeholder secrets detected for: ${weak.join(', ')}. ` +
        'Generate strong random secrets before deploying to production.',
      );
    }
  }
}

// ---- Generation ----

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { id: payload.id, role: payload.role, tokenVersion: payload.tokenVersion },
    accessSecret(),
    {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '5m') as SignOptions['expiresIn'],
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
