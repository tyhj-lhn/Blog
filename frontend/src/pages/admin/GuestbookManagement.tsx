import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { GuestbookEntry, PaginatedResponse } from '../../types';
import ConfirmDialog from '../../components/ConfirmDialog';

const PAGE_SIZE = 20;

export default function GuestbookManagement() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<PaginatedResponse<GuestbookEntry>>({
    queryKey: ['admin-guestbook', page],
    queryFn: () => api.get('/guestbook', { page, limit: PAGE_SIZE }),
  });

  const [deleteTarget, setDeleteTarget] = useState<GuestbookEntry | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/guestbook/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-guestbook'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  return (
    <div className="p-6">
      <h1 className="font-heading text-3xl text-zinc-900 mb-6">留言管理</h1>

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
        <div className="text-center py-12 text-zinc-400">暂无留言</div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="space-y-2">
            {data.data.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start justify-between border border-zinc-200 rounded-lg p-4 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-zinc-800 text-sm">{entry.nickname}</span>
                    <span className="text-xs text-zinc-400">
                      {new Date(entry.createdAt).toLocaleDateString('zh-CN', {
                        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2">{entry.message}</p>
                </div>
                <button
                  onClick={() => setDeleteTarget(entry)}
                  className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-3 shrink-0"
                  aria-label={`删除 ${entry.nickname} 的留言`}
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
        message={`确定要删除「${deleteTarget?.nickname ?? ''}」的留言吗？此操作不可撤销。`}
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
