import { describe, it, expect } from 'vitest';
import {
  AppError,
  notFound,
  unauthorized,
  forbidden,
  validationError,
  conflict,
} from '../../lib/errors.js';

describe('AppError', () => {
  it('creates an AppError with correct properties', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Resource not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
    expect(err.name).toBe('AppError');
  });
});

describe('notFound', () => {
  it('creates 404 error with resource name', () => {
    const err = notFound('Post');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Post not found');
  });
});

describe('unauthorized', () => {
  it('creates 401 error with default message', () => {
    const err = unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
  });

  it('creates 401 error with custom message', () => {
    const err = unauthorized('Invalid token');
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid token');
  });
});

describe('forbidden', () => {
  it('creates 403 error', () => {
    const err = forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('Insufficient permissions');
  });
});

describe('validationError', () => {
  it('creates 400 error with message', () => {
    const err = validationError('Email is required');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Email is required');
  });
});

describe('conflict', () => {
  it('creates 409 error with message', () => {
    const err = conflict('Slug already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Slug already exists');
  });
});
