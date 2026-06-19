import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import type { PaginatedResponse, PostSummary } from '../types';
import PostCard from '../components/PostCard';
import Pagination from '../components/Pagination';

const PAGE_LIMIT = 6;

export default function Home() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<PaginatedResponse<PostSummary>>({
    queryKey: ['posts', page],
    queryFn: () => api.get('/posts', { page, limit: PAGE_LIMIT }),
  });

  return (
    <div>
      {/* Above-fold hero */}
      <section className="py-16 md:py-24 text-center">
        <h1 className="font-heading text-5xl md:text-7xl text-zinc-900 mb-4">
          MemoryStory
        </h1>
        <p className="text-zinc-500 text-lg md:text-xl mb-8">
          记录思考，分享生活
        </p>
        <div className="flex flex-col items-center gap-2 text-zinc-300">
          <span className="text-sm">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </div>
      </section>

      {/* Post grid */}
      <section>
        <h2 className="font-heading text-3xl text-zinc-900 mb-6">最新文章</h2>
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="border border-zinc-200 rounded-lg p-6 animate-pulse"
              >
                <div className="h-7 bg-zinc-200 rounded w-3/4 mb-3" />
                <div className="h-4 bg-zinc-100 rounded w-full mb-2" />
                <div className="h-4 bg-zinc-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}
        {isError && (
          <p className="text-zinc-500 text-center py-12">加载失败，请稍后重试</p>
        )}
        {data && data.data.length === 0 && (
          <p className="text-zinc-400 text-center py-12">还没有文章</p>
        )}
        {data && data.data.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.data.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
