import { useState, useCallback, useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const LIKED_KEY = 'memorystory_liked_posts';

function getLikedPosts(): Set<number> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistLikedPosts(ids: Set<number>): void {
  localStorage.setItem(LIKED_KEY, JSON.stringify([...ids]));
}

export interface UseLikePostOptions {
  postId: number;
  slug: string;
  initialLikeCount: number;
  /** If provided, invalidates this query key after a successful toggle */
  invalidateQueries?: { client: QueryClient; key: unknown[] };
}

export interface UseLikePostResult {
  liked: boolean;
  likeCount: number;
  likePending: boolean;
  toggleLike: () => Promise<void>;
}

export function useLikePost({
  postId,
  slug,
  initialLikeCount,
  invalidateQueries,
}: UseLikePostOptions): UseLikePostResult {
  // Derive `liked` from localStorage on every render — always accurate for current postId
  const liked = getLikedPosts().has(postId);

  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [likePending, setLikePending] = useState(false);

  // Sync when the authoritative value changes (e.g., post data arrives late, cross-page invalidation).
  // Refs in render here is a standard derived-state pattern — resets local count when prop changes.
  const prevInitialRef = useRef(initialLikeCount);
  // eslint-disable-next-line react-hooks/refs
  if (prevInitialRef.current !== initialLikeCount) {
    // eslint-disable-next-line react-hooks/refs
    prevInitialRef.current = initialLikeCount;
    setLikeCount(initialLikeCount);
  }
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const toggleLike = useCallback(async () => {
    if (likePending) return;

    setLikePending(true);
    const nextLiked = !liked;
    const prevLiked = liked;
    const prevCount = likeCount;

    // Optimistic update
    setLikeCount((c) => c + (nextLiked ? 1 : -1));

    // Persist to localStorage immediately
    const likedPosts = getLikedPosts();
    if (nextLiked) {
      likedPosts.add(postId);
    } else {
      likedPosts.delete(postId);
    }
    persistLikedPosts(likedPosts);

    try {
      const result = await api.post<{ likeCount: number }>(
        `/posts/${slug}/toggle-like`,
        { liked: nextLiked },
      );
      if (mountedRef.current) {
        setLikeCount(result.likeCount);
      }
      // Invalidate queries so dependent data stays fresh
      if (invalidateQueries) {
        invalidateQueries.client.invalidateQueries({
          queryKey: invalidateQueries.key,
        });
      }
    } catch {
      // Rollback on failure
      if (mountedRef.current) {
        setLikeCount(prevCount);
      }
      const rollback = getLikedPosts();
      if (prevLiked) {
        rollback.add(postId);
      } else {
        rollback.delete(postId);
      }
      persistLikedPosts(rollback);
    } finally {
      if (mountedRef.current) {
        setLikePending(false);
      }
    }
  }, [liked, likeCount, likePending, postId, slug, invalidateQueries]);

  return { liked, likeCount, likePending, toggleLike };
}
