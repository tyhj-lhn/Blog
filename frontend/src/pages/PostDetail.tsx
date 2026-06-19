import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Eye, Tag as TagIcon } from 'lucide-react';
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

  const {
    data: comments = [],
    isLoading: commentsLoading,
  } = useQuery<Comment[]>({
    queryKey: ['comments', post?.id],
    queryFn: () => api.get(`/comments/${post!.id}`),
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
      <div className="animate-pulse space-y-4 py-8">
        <div className="h-10 bg-zinc-200 rounded w-1/2" />
        <div className="h-5 bg-zinc-100 rounded w-1/4" />
        <div className="h-4 bg-zinc-100 rounded w-full" />
        <div className="h-4 bg-zinc-100 rounded w-full" />
        <div className="h-4 bg-zinc-100 rounded w-3/4" />
      </div>
    );
  }

  if (postError || !post) {
    return <p className="text-zinc-500 text-center py-12">文章未找到</p>;
  }

  return (
    <article>
      {/* Post header */}
      <header className="mb-8">
        <h1 className="font-heading text-4xl md:text-5xl text-zinc-900 mb-4">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {formatDate(post.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={14} />
            {post.viewCount} 阅读
          </span>
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
  );
}
