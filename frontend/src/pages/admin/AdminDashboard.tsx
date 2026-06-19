import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, BookOpen, PenSquare, MessageCircle, BookMarked, Edit3, Trash2, Image } from 'lucide-react';
import { api } from '../../lib/api';
import type { AdminStats } from '../../types';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function AdminDashboard() {
  const { data: stats, isLoading, isError } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats'),
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'comment'; id: number; label: string } | null>(null);

  const deletePostMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'post') {
      deletePostMutation.mutate(deleteTarget.id);
    } else {
      deleteCommentMutation.mutate(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-zinc-200 rounded-lg p-4 bg-white">
              <div className="h-4 bg-zinc-100 rounded w-1/2 mb-2" />
              <div className="h-8 bg-zinc-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="p-6">
        <p className="text-zinc-500 text-center py-12">加载失败，请刷新重试</p>
      </div>
    );
  }

  const STAT_CARDS = [
    { label: '总文章', value: stats.totalPosts, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '已发布', value: stats.publishedPosts, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '草稿', value: stats.draftPosts, icon: PenSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: '总评论', value: stats.totalComments, icon: MessageCircle, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: '留言', value: stats.totalGuestbook, icon: BookMarked, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  const MANAGEMENT_LINKS = [
    { to: '/admin/comments', icon: MessageCircle, label: '评论管理', desc: '查看、搜索、删除评论' },
    { to: '/admin/guestbook', icon: BookMarked, label: '留言管理', desc: '管理留言板内容' },
    { to: '/admin/wallpaper', icon: Image, label: '背景壁纸', desc: '设置首页背景图片/视频' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-zinc-900">仪表盘</h1>
        <Link
          to="/admin/posts/new"
          className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Edit3 size={16} />
          新建文章
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {STAT_CARDS.map((item) => (
          <div key={item.label} className="border border-zinc-200 rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                <item.icon size={16} className={item.color} />
              </div>
              <span className="text-xs text-zinc-500">{item.label}</span>
            </div>
            <span className="text-2xl font-semibold text-zinc-900">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Quick management links */}
      <section className="mb-8">
        <h2 className="font-heading text-lg text-zinc-900 mb-3">快捷管理</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MANAGEMENT_LINKS.map(({ to, icon: Icon, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 border border-zinc-200 rounded-lg p-4 bg-white hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-zinc-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">{label}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent posts */}
      {stats.recentPosts.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg text-zinc-900">最新文章</h2>
            <Link
              to="/admin/posts"
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              查看全部 →
            </Link>
          </div>
          <div className="space-y-2">
            {stats.recentPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between border border-zinc-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/admin/posts/${post.id}/edit`}
                    className="font-medium text-zinc-800 hover:text-blue-600 transition-colors truncate block"
                  >
                    {post.title}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                    <span>{post.viewCount} 阅读</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      post.status === 'PUBLISHED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {post.status === 'PUBLISHED' ? '已发布' : '草稿'}
                    </span>
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
                    onClick={() => setDeleteTarget({ type: 'post', id: post.id, label: post.title })}
                    className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    aria-label={`删除 ${post.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent comments */}
      {stats.recentComments.length > 0 && (
        <section>
          <h2 className="font-heading text-lg text-zinc-900 mb-3">最新评论</h2>
          <div className="space-y-2">
            {stats.recentComments.map((comment) => (
              <div
                key={comment.id}
                className="flex items-start justify-between border border-zinc-200 rounded-lg p-4 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="font-semibold text-zinc-800">{comment.username}</span>
                    <span className="text-zinc-400">在</span>
                    <span className="text-blue-600 truncate">{comment.post.title}</span>
                  </div>
                  <p className="text-sm text-zinc-600 line-clamp-2">{comment.content}</p>
                </div>
                <button
                  onClick={() => setDeleteTarget({
                    type: 'comment',
                    id: comment.id,
                    label: `${comment.username} 的评论`,
                  })}
                  className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-3 shrink-0"
                  aria-label={`删除 ${comment.username} 的评论`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="确认删除"
        message={`确定要删除「${deleteTarget?.label ?? ''}」吗？此操作不可撤销。`}
        confirmLabel="删除"
        variant="danger"
        loading={deletePostMutation.isPending || deleteCommentMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
