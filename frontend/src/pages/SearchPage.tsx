import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { PostSummary } from '../types';
import SearchBar from '../components/SearchBar';
import { useDebounce } from '../hooks/useDebounce';
import PostCard from '../components/PostCard';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialQ);
  const debouncedQuery = useDebounce(inputValue, 300);

  useEffect(() => {
    if (debouncedQuery) {
      setSearchParams({ q: debouncedQuery });
    } else if (initialQ) {
      setSearchParams({});
    }
  }, [debouncedQuery, setSearchParams, initialQ]);

  const query = debouncedQuery || initialQ;

  const { data: results, isLoading, isError } = useQuery<PostSummary[]>({
    queryKey: ['search', query],
    queryFn: () => api.get('/search', { q: query }),
    enabled: query.length > 0,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-4xl text-zinc-900 mb-6">搜索</h1>

      <div className="mb-8">
        <SearchBar
          value={inputValue}
          onChange={setInputValue}
          placeholder="搜索文章标题或内容..."
          autoFocus
        />
      </div>

      {!query && (
        <div className="text-center py-12">
          <SearchIcon size={48} className="mx-auto text-zinc-300 mb-4" />
          <p className="text-zinc-400">输入关键词开始搜索</p>
        </div>
      )}

      {query && isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-zinc-200 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-zinc-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-zinc-100 rounded w-full mb-2" />
              <div className="h-4 bg-zinc-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-zinc-500 text-center py-12">搜索失败，请稍后重试</p>
      )}

      {results && results.length === 0 && (
        <p className="text-zinc-400 text-center py-12">
          未找到与 &ldquo;{query}&rdquo; 相关的文章
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500 mb-4">
            找到 {results.length} 篇与 &ldquo;{query}&rdquo; 相关的文章
          </p>
          {results.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
