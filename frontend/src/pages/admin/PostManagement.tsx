import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Edit3, Trash2, Search, Eye, MessageCircle, Heart, ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';
import type { PostSummary, PaginatedResponse, PostStatus } from '../../types';
import ConfirmDialog from '../../components/ConfirmDialog';

const PAGE_SIZE = 20;

export default function PostManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | PostStatus>('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<PaginatedResponse<PostSummary>>({
    queryKey: ['admin-posts', page, search, statusFilter],
    queryFn: () =>
      api.get('/admin/posts', {
        page,
        limit: PAGE_SIZE,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      }),
  });

  const [deleteTarget, setDeleteTarget] = useState<PostSummary | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
      setDeleteTarget(null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-zinc-900">文章列表</h1>
        <Link
          to="/admin/posts/new"
          className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus size={16} />
          新建文章
        </Link>
      </div>

      {/* Search bar + Status filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-50">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索标题或内容..."
              className="w-full min-h-11 pl-9 pr-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
            />
          </div>
          <button
            type="submit"
            className="min-h-11 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            搜索
          </button>
          {(search || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setStatusFilter('');
                setPage(1);
              }}
              className="min-h-11 px-3 rounded-lg border border-zinc-200 text-zinc-500 text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              清除筛选
            </button>
          )}
        </form>

        {/* Status filter */}
        <div className="flex items-center gap-1 ml-auto">
          {(['', 'PUBLISHED', 'DRAFT'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`min-h-9 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                statusFilter === s
                  ? 'bg-zinc-800 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {s === '' ? '全部' : s === 'PUBLISHED' ? '已发布' : '草稿'}
            </button>
          ))}
        </div>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-100 rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-12 text-zinc-500">加载失败，请刷新重试</div>
      )}

      {/* Empty */}
      {data && data.data.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          {search || statusFilter ? '没有匹配的文章' : '暂无文章'}
        </div>
      )}

      {/* Post list */}
      {data && data.data.length > 0 && (
        <>
          <div className="space-y-2">
            {data.data.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between border border-zinc-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Cover thumbnail */}
                  <div className="w-12 h-8 shrink-0 bg-zinc-100 rounded overflow-hidden">
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={14} className="text-zinc-300" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="font-medium text-zinc-800 hover:text-blue-600 transition-colors truncate"
                      >
                        {post.title}
                      </Link>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${
                          post.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {post.status === 'PUBLISHED' ? '已发布' : '草稿'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {post.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} />
                        {post._count.comments}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {post.likeCount}
                      </span>
                      <span>
                        {new Date(post.createdAt).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button
                    onClick={() => navigate(`/admin/posts/${post.id}/edit`)}
                    className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                    aria-label={`编辑 ${post.title}`}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(post)}
                    className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    aria-label={`删除 ${post.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
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
        message={`确定要删除文章「${deleteTarget?.title ?? ''}」吗？此操作不可撤销，关联评论也会被删除。`}
        confirmLabel="删除"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
