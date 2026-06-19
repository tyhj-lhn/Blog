import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  validateSecrets,
} from '../../lib/jwt.js';

describe('JWT', () => {
  const user = { id: 1, role: 'ADMIN', tokenVersion: 0 };

  describe('generateAccessToken', () => {
    it('generates a non-empty string', () => {
      const token = generateAccessToken(user);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('generates a token with 3 dot-separated parts', () => {
      const token = generateAccessToken(user);
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a non-empty string', () => {
      const token = generateRefreshToken(user.id, user.tokenVersion);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('generates a token with 3 dot-separated parts', () => {
      const token = generateRefreshToken(user.id, user.tokenVersion);
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('generateTokenPair', () => {
    it('returns both tokens', () => {
      const pair = generateTokenPair(user);
      expect(pair.accessToken).toBeTruthy();
      expect(pair.refreshToken).toBeTruthy();
      expect(pair.accessToken).not.toBe(pair.refreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies and decodes a valid token', () => {
      const token = generateAccessToken(user);
      const decoded = verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.id).toBe(1);
      expect(decoded!.role).toBe('ADMIN');
      expect(decoded!.tokenVersion).toBe(0);
    });

    it('returns null for an invalid token', () => {
      expect(verifyAccessToken('invalid-token')).toBeNull();
      expect(verifyAccessToken('')).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies and decodes a valid token', () => {
      const token = generateRefreshToken(user.id, user.tokenVersion);
      const decoded = verifyRefreshToken(token);
      expect(decoded).toEqual({ userId: 1, tokenVersion: 0 });
    });

    it('returns null for an invalid token', () => {
      expect(verifyRefreshToken('bad-token')).toBeNull();
      expect(verifyRefreshToken('')).toBeNull();
    });
  });

  describe('token round-trip', () => {
    it('access token → verify → same user data', () => {
      const token = generateAccessToken({ id: 42, role: 'ADMIN', tokenVersion: 3 });
      const decoded = verifyAccessToken(token);
      expect(decoded).toEqual({ id: 42, role: 'ADMIN', tokenVersion: 3 });
    });

    it('refresh token → verify → same userId and tokenVersion', () => {
      const token = generateRefreshToken(99, 5);
      expect(verifyRefreshToken(token)).toEqual({ userId: 99, tokenVersion: 5 });
    });
  });

  describe('validateSecrets', () => {
    it('warns when JWT_ACCESS_SECRET is not set', () => {
      const warnings: string[] = [];
      const logger = { warn: (msg: string) => warnings.push(msg) };
      const orig = process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_ACCESS_SECRET;
      // ensure dev fallback doesn't throw
      validateSecrets(logger);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      if (orig) process.env.JWT_ACCESS_SECRET = orig;
    });
  });
});
