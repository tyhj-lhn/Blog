import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Search } from 'lucide-react';
import { api } from '../../lib/api';
import type { PaginatedResponse } from '../../types';

import ConfirmDialog from '../../components/ConfirmDialog';

interface AdminComment {
  id: number;
  content: string;
  username: string;
  email: string | null;
  postId: number;
  post: { id: number; title: string };
  createdAt: string;
}

const PAGE_SIZE = 20;

export default function CommentManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<PaginatedResponse<AdminComment>>({
    queryKey: ['admin-comments', page, search],
    queryFn: () => api.get('/admin/comments', { page, limit: PAGE_SIZE, ...(search && { search }) }),
  });

  const [deleteTarget, setDeleteTarget] = useState<AdminComment | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="p-6">
      <h1 className="font-heading text-3xl text-zinc-900 mb-6">评论管理</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索用户名或内容..."
            className="w-full min-h-11 pl-9 pr-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
          />
        </div>
        <button
          type="submit"
          className="min-h-11 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          搜索
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="min-h-11 px-3 rounded-lg border border-zinc-200 text-zinc-500 text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            清除
          </button>
        )}
      </form>

      {isLoading && (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-100 rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-zinc-500">加载失败，请刷新重试</div>
      )}

      {data && data.data.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          {search ? '没有匹配的评论' : '暂无评论'}
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="space-y-2">
            {data.data.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start justify-between border border-zinc-200 rounded-lg p-4 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="font-semibold text-zinc-800">{comment.username}</span>
                    {comment.email && (
                      <span className="text-xs text-zinc-400">{comment.email}</span>
                    )}
                    <span className="text-zinc-400">在</span>
                    <span className="text-blue-600 truncate">{comment.post.title}</span>
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2 mb-1">{comment.content}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(comment.createdAt).toLocaleDateString('zh-CN', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget(comment)}
                  className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-3 shrink-0"
                  aria-label={`删除 ${comment.username} 的评论`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="min-h-9 px-3 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                上一页
              </button>
              <span className="text-sm text-zinc-500">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="min-h-9 px-3 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={`确定要删除「${deleteTarget?.username ?? ''}」的评论吗？此操作不可撤销。`}
        confirmLabel="删除"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
