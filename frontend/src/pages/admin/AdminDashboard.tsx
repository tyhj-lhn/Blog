import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, MessageCircle, BookOpen, PenSquare, LogOut, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { AdminStats } from '../../types';

export default function AdminDashboard() {
  const { data: stats, isLoading, isError } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats'),
  });
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-zinc-200 rounded-lg p-4">
              <div className="h-4 bg-zinc-100 rounded w-1/2 mb-2" />
              <div className="h-8 bg-zinc-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return <p className="text-zinc-500 text-center py-12">加载失败</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl text-zinc-900">管理后台</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/posts/new"
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            新建文章
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg border border-zinc-200 text-zinc-600 text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            登出
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { label: '总文章', value: stats.totalPosts, icon: FileText },
          { label: '已发布', value: stats.publishedPosts, icon: BookOpen },
          { label: '草稿', value: stats.draftPosts, icon: PenSquare },
          { label: '总评论', value: stats.totalComments, icon: MessageCircle },
          { label: '留言', value: stats.totalGuestbook, icon: MessageCircle },
        ].map((item) => (
          <div
            key={item.label}
            className="border border-zinc-200 rounded-lg p-4 bg-white"
          >
            <div className="flex items-center gap-2 text-zinc-400 mb-1">
              <item.icon size={16} />
              <span className="text-xs">{item.label}</span>
            </div>
            <span className="text-2xl font-semibold text-zinc-900">{item.value}</span>
          </div>
        ))}
      </div>

      {/* Recent posts */}
      {stats.recentPosts.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading text-xl text-zinc-900 mb-4">最新文章</h2>
          <div className="space-y-3">
            {stats.recentPosts.map((post) => (
              <Link
                key={post.id}
                to={`/admin/posts/${post.id}/edit`}
                className="block border border-zinc-200 rounded-lg p-4 bg-white hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-800">{post.title}</span>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span>{post.viewCount} 阅读</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        post.status === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {post.status === 'PUBLISHED' ? '已发布' : '草稿'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent comments */}
      {stats.recentComments.length > 0 && (
        <section>
          <h2 className="font-heading text-xl text-zinc-900 mb-4">最新评论</h2>
          <div className="space-y-2">
            {stats.recentComments.map((comment) => (
              <div
                key={comment.id}
                className="border border-zinc-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="font-semibold text-zinc-800">{comment.username}</span>
                  <span className="text-zinc-400">在</span>
                  <span className="text-blue-600">{comment.post.title}</span>
                </div>
                <p className="text-sm text-zinc-600 line-clamp-2">{comment.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
