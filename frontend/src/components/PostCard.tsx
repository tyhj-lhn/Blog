import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Eye, MessageCircle, Heart, ImageIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { PostSummary } from '../types';

interface PostCardProps {
  post: PostSummary;
}

const LIKED_KEY = 'memorystory_liked_posts';

function getLikedPosts(): Set<number> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PostCard({ post }: PostCardProps) {
  const [liked, setLiked] = useState(() => getLikedPosts().has(post.id));
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likePending, setLikePending] = useState(false);

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (liked || likePending) return;

      setLikePending(true);
      // Optimistic update
      setLiked(true);
      setLikeCount((c) => c + 1);

      // Persist to localStorage immediately
      const likedPosts = getLikedPosts();
      likedPosts.add(post.id);
      localStorage.setItem(LIKED_KEY, JSON.stringify([...likedPosts]));

      try {
        const result = await api.post<{ likeCount: number }>(`/posts/${post.slug}/like`);
        setLikeCount(result.likeCount);
      } catch {
        // Revert on failure
        setLiked(false);
        setLikeCount((c) => c - 1);
        const rollback = getLikedPosts();
        rollback.delete(post.id);
        localStorage.setItem(LIKED_KEY, JSON.stringify([...rollback]));
      } finally {
        setLikePending(false);
      }
    },
    [liked, likePending, post.id, post.slug],
  );

  return (
    <article className="group border border-zinc-200 rounded-lg overflow-hidden bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200">
      {/* Cover image */}
      <Link to={`/post/${post.slug}`} className="block relative aspect-video bg-zinc-100 overflow-hidden">
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-200 to-zinc-100">
            <ImageIcon size={40} className="text-zinc-300" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <Link to={`/post/${post.slug}`} className="block">
          <h2 className="font-heading text-xl text-zinc-900 group-hover:text-blue-600 transition-colors duration-150 mb-3 leading-snug">
            {post.title}
          </h2>
        </Link>

        {/* Meta row: date | views | comments | likes */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400 mb-3">
          <span className="flex items-center gap-1.5 min-w-11">
            <Calendar size={14} className="shrink-0" />
            {formatDate(post.createdAt)}
          </span>
          <span className="flex items-center gap-1.5 min-w-11">
            <Eye size={14} className="shrink-0" />
            {post.viewCount}
          </span>
          <span className="flex items-center gap-1.5 min-w-11">
            <MessageCircle size={14} className="shrink-0" />
            {post._count.comments}
          </span>
          <button
            type="button"
            onClick={handleLike}
            disabled={likePending}
            className={`flex items-center gap-1.5 min-w-11 transition-colors duration-150 cursor-pointer ${
              liked ? 'text-rose-500' : 'hover:text-rose-400'
            }`}
            aria-label={liked ? '已点赞' : '点赞'}
          >
            <Heart size={14} className={`shrink-0 ${liked ? 'fill-current' : ''}`} />
            {likeCount}
          </button>
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-zinc-500 text-sm leading-relaxed line-clamp-2">
            {post.excerpt}
          </p>
        )}
      </div>
    </article>
  );
}
