import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Eye, Tag as TagIcon, Heart, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { api } from '../lib/api';
import type { Post, Comment } from '../types';
import { useLikePost } from '../hooks/useLike';
import CommentTree from '../components/CommentTree';
import CommentForm from '../components/CommentForm';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
    queryFn: async () => {
      const p = await api.get<Post>(`/posts/${slug}`);
      // Invalidate post list so counts (viewCount, etc.) are fresh when navigating back
      queryClient.invalidateQueries({ queryKey: ['posts'] }).catch(() => {});
      return p;
    },
    enabled: !!slug,
  });

  const { liked, likeCount, likePending, toggleLike } = useLikePost({
    postId: post?.id ?? 0,
    slug: slug ?? '',
    initialLikeCount: post?.likeCount ?? 0,
    invalidateQueries: { client: queryClient, key: ['post', slug] },
  });

  const {
    data: comments = [],
    isLoading: commentsLoading,
    isError: commentsError,
  } = useQuery<Comment[]>({
    queryKey: ['comments', post?.id],
    queryFn: () =>
      api.get<{ data: Comment[] }>(`/comments/${post!.id}`).then((r) => r.data),
    enabled: !!post?.id,
  });

  const [submitError, setSubmitError] = useState<string | null>(null);

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
    onMutate: async () => {
      setSubmitError(null); // Clear previous error on new submission
      // Cancel any outgoing post refetch so it doesn't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['post', slug] });
      const previous = queryClient.getQueryData<Post>(['post', slug]);
      if (previous) {
        queryClient.setQueryData<Post>(['post', slug], {
          ...previous,
          _count: { comments: previous._count.comments + 1 },
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback optimistic comment count
      if (context?.previous) {
        queryClient.setQueryData(['post', slug], context.previous);
      }
      setSubmitError('评论提交失败，请稍后重试');
    },
    onSettled: () => {
      // Refetch both post (for authoritative _count.comments) and comments
      queryClient.invalidateQueries({ queryKey: ['comments', post?.id] });
      queryClient.invalidateQueries({ queryKey: ['post', slug] });
    },
  });

  if (postLoading) {
    return (
      <div>
        {/* Loading hero */}
        <section className="relative flex items-end min-h-[40vh] -mt-14 bg-zinc-800 animate-pulse">
          <div className="absolute inset-0 bg-zinc-950/20" />
          <div className="relative z-10 w-full max-w-4xl mx-auto px-4 pb-8">
            <div className="h-10 bg-zinc-700 rounded w-1/2 mb-4" />
            <div className="h-5 bg-zinc-700 rounded w-1/4" />
          </div>
        </section>
        {/* Content skeleton */}
        <div className="h-1.5 bg-linear-to-b from-zinc-950/40 to-zinc-200/60" />
        <section className="bg-white/80 backdrop-blur-xl px-4 py-12 md:py-16">
          <div className="max-w-4xl mx-auto animate-pulse space-y-4">
            <div className="h-4 bg-zinc-200 rounded w-full" />
            <div className="h-4 bg-zinc-200 rounded w-full" />
            <div className="h-4 bg-zinc-200 rounded w-3/4" />
          </div>
        </section>
      </div>
    );
  }

  if (postError || !post) {
    return (
      <div>
        <section className="relative flex items-end min-h-[30vh] -mt-14 bg-zinc-800">
          <div className="relative z-10 w-full max-w-4xl mx-auto px-4 pb-8">
            <h1 className="font-heading text-3xl text-white">文章未找到</h1>
          </div>
        </section>
        <div className="h-1.5 bg-linear-to-b from-zinc-950/40 to-zinc-200/60" />
        <section className="bg-white/80 backdrop-blur-xl px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <p className="text-zinc-500 text-center py-12">该文章可能已被删除或地址不正确</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      {/* Hero — cover image as top-half background, post metadata overlaid */}
      <section
        className={`relative flex items-end min-h-[50vh] -mt-14 ${
          post.coverImage ? '' : 'bg-zinc-800'
        }`}
      >
        {post.coverImage ? (
          <>
            <img
              src={post.coverImage}
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-zinc-950/55" />
          </>
        ) : (
          <div className="absolute inset-0 bg-zinc-950/30" />
        )}
        {/* Title + meta overlaid at bottom */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 pb-8">
          <h1 className="font-heading text-4xl md:text-5xl text-white mb-4 drop-shadow-lg">
            {post.title}
          </h1>
          <div className="select-none cursor-default flex flex-wrap items-center gap-4 text-sm text-white/70">
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
              onClick={toggleLike}
              disabled={likePending}
              className={`flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                liked ? 'text-rose-400' : 'text-white/70 hover:text-rose-300'
              }`}
              aria-label={liked ? '取消点赞' : '点赞'}
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
        </div>
      </section>

      {/* 6px shadow gradient — softens the transition from hero to content */}
      <div className="h-1.5 bg-linear-to-b from-zinc-950/40 to-zinc-200/60" />

      {/* Article content — white surface below */}
      <section className="bg-white/80 backdrop-blur-xl px-4 py-8 md:py-12 border-t border-white/40 shadow-diffuse">
        <div className="max-w-4xl mx-auto">
          <article>
            <div className="prose prose-zinc max-w-none mb-12 leading-relaxed text-zinc-800">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  img: ({ src, alt }) => (
                    <img
                      src={src}
                      alt={alt ?? ''}
                      className="max-w-full h-auto"
                      loading="lazy"
                    />
                  ),
                }}
              >
                {post.content}
              </ReactMarkdown>
            </div>
          </article>

          {/* Divider */}
          <hr className="border-zinc-200 mb-8" />

          {/* Comments section */}
          <section>
            <h2 className="font-heading text-2xl text-zinc-900 mb-6">
              评论 {comments.length > 0 && `(${comments.length})`}
            </h2>

            <div className="mb-8 p-4 border border-white/40 rounded-2xl bg-white/80 backdrop-blur-xl shadow-diffuse">
              <CommentForm
                onSubmit={async (data) => {
                  await submitComment.mutateAsync(data);
                }}
              />
              {submitError && (
                <p className="text-red-500 text-sm mt-2">{submitError}</p>
              )}
            </div>

            {commentsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="h-4 bg-zinc-100 rounded w-1/4" />
                    <div className="h-4 bg-zinc-50 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : commentsError ? (
              <p className="text-zinc-500 text-center py-6">评论加载失败</p>
            ) : (
              <CommentTree
                comments={comments}
                onSubmitReply={async (data) => {
                  await submitComment.mutateAsync(data);
                }}
              />
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
