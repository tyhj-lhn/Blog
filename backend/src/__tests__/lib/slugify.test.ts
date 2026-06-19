import { describe, it, expect } from 'vitest';
import { slugify } from '../../lib/slugify.js';

describe('slugify', () => {
  it('converts English title to lowercase slug', () => {
    expect(slugify('Hello World Blog')).toBe('hello-world-blog');
  });

  it('converts Chinese title to slug preserving characters', () => {
    expect(slugify('博客搭建记录')).toBe('博客搭建记录');
  });

  it('handles mixed Chinese and English', () => {
    expect(slugify('Hello 世界 Blog')).toBe('hello-世界-blog');
  });

  it('removes leading and trailing hyphens', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });

  it('replaces special characters with hyphens', () => {
    expect(slugify('hello!@#$%^&*()world')).toBe('hello-world');
  });

  it('replaces multiple consecutive non-word chars with single hyphen', () => {
    expect(slugify('hello!!!   world')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('truncates to 100 characters', () => {
    const long = 'a'.repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(100);
  });

  it('produces URL-safe output (no uppercase, no spaces)', () => {
    const result = slugify('My Blog Post Title 2024!');
    expect(result).not.toMatch(/[A-Z\s]/);
    expect(result).toBe('my-blog-post-title-2024');
  });

  it('handles numbers and hyphens correctly', () => {
    expect(slugify('Post 123 - Version 2')).toBe('post-123-version-2');
  });
});
