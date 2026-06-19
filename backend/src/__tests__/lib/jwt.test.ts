import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../lib/jwt.js';

describe('JWT', () => {
  const user = { id: 1, role: 'ADMIN' };

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
      const token = generateRefreshToken(user.id);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('generates a token with 3 dot-separated parts', () => {
      const token = generateRefreshToken(user.id);
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
    });

    it('returns null for an invalid token', () => {
      expect(verifyAccessToken('invalid-token')).toBeNull();
      expect(verifyAccessToken('')).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies and decodes a valid token', () => {
      const token = generateRefreshToken(user.id);
      const decoded = verifyRefreshToken(token);
      expect(decoded).toBe(1);
    });

    it('returns null for an invalid token', () => {
      expect(verifyRefreshToken('bad-token')).toBeNull();
      expect(verifyRefreshToken('')).toBeNull();
    });
  });

  describe('token round-trip', () => {
    it('access token → verify → same user data', () => {
      const token = generateAccessToken({ id: 42, role: 'ADMIN' });
      const decoded = verifyAccessToken(token);
      expect(decoded).toEqual({ id: 42, role: 'ADMIN' });
    });

    it('refresh token → verify → same user id', () => {
      const token = generateRefreshToken(99);
      expect(verifyRefreshToken(token)).toBe(99);
    });
  });
});
