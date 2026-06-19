import { describe, it, expect } from 'vitest';
import { buildCommentTree } from '../../lib/comments.js';
import type { FlatComment } from '../../lib/comments.js';

function makeFlat(
  overrides: Partial<FlatComment> = {},
): FlatComment {
  return {
    id: 1,
    content: 'Test comment',
    postId: 1,
    username: 'testuser',
    email: null,
    websiteUrl: null,
    parentId: null,
    createdAt: new Date('2025-01-01'),
    depth: 0,
    path: [1],
    ...overrides,
  };
}

describe('buildCommentTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildCommentTree([])).toEqual([]);
  });

  it('returns single root comment as root', () => {
    const flat: FlatComment[] = [makeFlat()];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toEqual([]);
  });

  it('returns multiple root comments as siblings', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1 }),
      makeFlat({ id: 2 }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe(1);
    expect(tree[1].id).toBe(2);
  });

  it('nests child comment under its parent', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1, parentId: null }),
      makeFlat({ id: 2, parentId: 1 }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(2);
  });

  it('handles two-level nesting (reply to reply)', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1, parentId: null }),
      makeFlat({ id: 2, parentId: 1 }),
      makeFlat({ id: 3, parentId: 2 }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(2);
    expect(tree[0].children[0].children[0].id).toBe(3);
  });

  it('handles multiple children under same parent', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1, parentId: null }),
      makeFlat({ id: 2, parentId: 1, content: 'reply 1' }),
      makeFlat({ id: 3, parentId: 1, content: 'reply 2' }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].content).toBe('reply 1');
    expect(tree[0].children[1].content).toBe('reply 2');
  });

  it('out-of-order input: child before parent becomes root (single-pass limitation)', () => {
    // The buildCommentTree is a single-pass O(n) algorithm.
    // When a child appears before its parent, the parent hasn't been processed yet,
    // so the child is added to roots. The SQL CTE guarantees correct ordering.
    const flat: FlatComment[] = [
      makeFlat({ id: 2, parentId: 1 }),
      makeFlat({ id: 1, parentId: null }),
    ];
    const tree = buildCommentTree(flat);
    // Both end up as roots because child was processed before parent existed
    expect(tree).toHaveLength(2);
    const ids = tree.map((n) => n.id).sort();
    expect(ids).toEqual([1, 2]);
  });

  it('in-order input correctly nests child', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1, parentId: null }),
      makeFlat({ id: 2, parentId: 1 }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(2);
  });

  it('handles orphan comments (parent not in list) as roots', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1, parentId: 999 }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
  });

  it('preserves all flat fields in tree nodes', () => {
    const flat: FlatComment[] = [
      makeFlat({
        id: 1,
        content: 'Hello',
        postId: 42,
        username: 'Alice',
        email: 'alice@example.com',
        websiteUrl: 'https://alice.dev',
        depth: 3,
        path: [1, 2, 3],
      }),
    ];
    const tree = buildCommentTree(flat);
    const node = tree[0];
    expect(node.content).toBe('Hello');
    expect(node.postId).toBe(42);
    expect(node.username).toBe('Alice');
    expect(node.email).toBe('alice@example.com');
    expect(node.websiteUrl).toBe('https://alice.dev');
    expect(node.depth).toBe(3);
    expect(node.path).toEqual([1, 2, 3]);
    expect(node.children).toEqual([]);
  });

  it('uses immutable push (spread, not mutation)', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1 }),
      makeFlat({ id: 2, parentId: 1 }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree[0].children).toHaveLength(1);
    // Verify input array was not mutated
    expect(flat[0]).not.toHaveProperty('children');
  });

  it('handles complex tree: multiple roots with nested replies', () => {
    const flat: FlatComment[] = [
      makeFlat({ id: 1, content: 'root A' }),
      makeFlat({ id: 2, content: 'root B' }),
      makeFlat({ id: 3, parentId: 1, content: 'reply to A' }),
      makeFlat({ id: 4, parentId: 3, content: 'reply to reply' }),
      makeFlat({ id: 5, parentId: 2, content: 'reply to B' }),
    ];
    const tree = buildCommentTree(flat);
    expect(tree).toHaveLength(2);

    // Root A
    expect(tree[0].id).toBe(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe(3);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe(4);

    // Root B
    expect(tree[1].id).toBe(2);
    expect(tree[1].children).toHaveLength(1);
    expect(tree[1].children[0].id).toBe(5);
  });
});
