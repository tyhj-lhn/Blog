import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Tag as TagIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { Tag } from '../types';

export default function TagsPage() {
  const { data: tags, isLoading, isError } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get('/tags'),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-4xl text-zinc-900 mb-8">标签</h1>

      {isLoading && (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 w-24 bg-zinc-100 rounded-full animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-zinc-500 text-center py-12">加载失败，请稍后重试</p>
      )}

      {tags && tags.length === 0 && (
        <p className="text-zinc-400 text-center py-12">暂无标签</p>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <Link
              key={tag.tag}
              to={`/search?q=${encodeURIComponent(tag.tag)}`}
              className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-zinc-200 bg-white text-sm text-zinc-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 cursor-pointer"
            >
              <TagIcon size={14} />
              <span>{tag.tag}</span>
              <span className="text-xs text-zinc-400">({tag.count})</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
