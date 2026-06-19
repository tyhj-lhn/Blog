import jwt from 'jsonwebtoken';

interface TokenPayload {
  id: number;
  role: string;
}

function accessSecret(): string {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
}

function refreshSecret(): string {
  return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
}

export function generateAccessToken(user: TokenPayload): string {
  return jwt.sign({ id: user.id, role: user.role }, accessSecret(), {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign({ id: userId }, refreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

export function generateTokenPair(user: TokenPayload): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user.id),
  };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, accessSecret()) as jwt.JwtPayload;
    if (typeof decoded.id === 'number' && typeof decoded.role === 'string') {
      return { id: decoded.id, role: decoded.role };
    }
    return null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, refreshSecret()) as jwt.JwtPayload;
    return typeof decoded.id === 'number' ? decoded.id : null;
  } catch {
    return null;
  }
}
