import { Link } from 'react-router-dom';
import { Calendar, Eye, MessageCircle } from 'lucide-react';
import type { PostSummary } from '../types';

interface PostCardProps {
  post: PostSummary;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <article className="group border border-zinc-200 rounded-lg p-6 bg-white hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-pointer">
      <Link to={`/post/${post.slug}`} className="block">
        <h2 className="font-heading text-2xl text-zinc-900 group-hover:text-blue-600 transition-colors duration-150 mb-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-zinc-500 text-sm leading-relaxed mb-4 line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {formatDate(post.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={14} />
            {post.viewCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={14} />
            {post._count.comments}
          </span>
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
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
      </Link>
    </article>
  );
}
