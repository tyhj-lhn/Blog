import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Eye, Tag as TagIcon, Heart, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { Post, Comment } from '../types';
import CommentTree from '../components/CommentTree';
import CommentForm from '../components/CommentForm';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const {
    data: post,
    isLoading: postLoading,
    isError: postError,
  } = useQuery<Post>({
    queryKey: ['post', slug],
    queryFn: () => api.get(`/posts/${slug}`),
    enabled: !!slug,
  });

  // Like state (compute from post + localStorage during render; track optimistic offset via ref)
  const [likePending, setLikePending] = useState(false);
  const liked = post ? getLikedPosts().has(post.id) : false;
  const likeCount = post ? post.likeCount : 0;

  const handleLike = useCallback(async () => {
    if (!post || liked || likePending) return;

    setLikePending(true);
    const likedPosts = getLikedPosts();
    likedPosts.add(post.id);
    localStorage.setItem(LIKED_KEY, JSON.stringify([...likedPosts]));

    try {
      await api.post(`/posts/${post.slug}/like`);
      // Re-fetch to get the authoritative likeCount from server
      queryClient.invalidateQueries({ queryKey: ['post', slug] });
    } catch {
      // Rollback on failure
      likedPosts.delete(post.id);
      localStorage.setItem(LIKED_KEY, JSON.stringify([...likedPosts]));
    } finally {
      setLikePending(false);
    }
  }, [post, liked, likePending, slug, queryClient]);

  const {
    data: comments = [],
    isLoading: commentsLoading,
  } = useQuery<Comment[]>({
    queryKey: ['comments', post?.id],
    queryFn: () =>
      api.get<{ data: Comment[] }>(`/comments/${post!.id}`).then((r) => r.data),
    enabled: !!post?.id,
  });

  const submitComment = useMutation({
    mutationFn: (data: {
      username: string;
      email?: string;
      websiteUrl?: string;
      content: string;
      parentId?: number;
    }) =>
      api.post('/comments', {
        ...data,
        postId: post!.id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', post?.id] });
    },
  });

  if (postLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-zinc-200 rounded w-1/2" />
        <div className="h-5 bg-zinc-100 rounded w-1/4" />
        <div className="h-4 bg-zinc-100 rounded w-full" />
        <div className="h-4 bg-zinc-100 rounded w-full" />
        <div className="h-4 bg-zinc-100 rounded w-3/4" />
      </div>
      </div>
    );
  }

  if (postError || !post) {
    return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-zinc-500 text-center py-12">文章未找到</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
    <article>
      {/* Post header */}
      <header className="mb-8">
        <h1 className="font-heading text-4xl md:text-5xl text-zinc-900 mb-4">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {formatDate(post.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={14} />
            {post.viewCount} 阅读
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle size={14} />
            {post._count.comments} 评论
          </span>
          <button
            type="button"
            onClick={handleLike}
            disabled={likePending}
            className={`flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
              liked ? 'text-rose-500' : 'text-zinc-400 hover:text-rose-400'
            }`}
            aria-label={liked ? '已点赞' : '点赞'}
          >
            <Heart size={14} className={`shrink-0 ${liked ? 'fill-current' : ''}`} />
            {likeCount} 点赞
          </button>
          {post.tags.length > 0 && (
            <span className="flex items-center gap-1">
              <TagIcon size={14} />
              {post.tags.join(' · ')}
            </span>
          )}
        </div>
      </header>

      {/* Post content */}
      <div className="prose prose-zinc max-w-none mb-12 leading-relaxed text-zinc-800 whitespace-pre-wrap">
        {post.content}
      </div>

      {/* Divider */}
      <hr className="border-zinc-200 mb-8" />

      {/* Comments section */}
      <section>
        <h2 className="font-heading text-2xl text-zinc-900 mb-6">
          评论 {comments.length > 0 && `(${comments.length})`}
        </h2>

        {/* New comment form */}
        <div className="mb-8 p-4 border border-zinc-200 rounded-lg bg-white">
          <CommentForm
            onSubmit={async (data) => {
              await submitComment.mutateAsync(data);
            }}
          />
        </div>

        {/* Comment tree */}
        {commentsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-4 bg-zinc-100 rounded w-1/4" />
                <div className="h-4 bg-zinc-50 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <CommentTree
            comments={comments}
            onSubmitReply={async (data) => {
              await submitComment.mutateAsync(data);
            }}
          />
        )}
      </section>
    </article>
    </div>
  );
}
