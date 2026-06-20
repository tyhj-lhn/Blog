import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  FileText,
  MessageCircle,
  BookOpen,
  Image,
  ExternalLink,
  LogOut,
  Settings,
  User,
  Info,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/admin/posts/new', icon: Plus, label: '新建文章' },
  { to: '/admin/posts', icon: FileText, label: '文章列表' },
  { to: '/admin/comments', icon: MessageCircle, label: '评论管理' },
  { to: '/admin/guestbook', icon: BookOpen, label: '留言管理' },
  { to: '/admin/wallpaper', icon: Image, label: '背景壁纸' },
  { to: '/admin/about', icon: Info, label: '关于我编辑' },
  { to: '/admin/profile', icon: Settings, label: '管理员设置' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-zinc-900 text-zinc-100 flex flex-col z-40">
        {/* Brand */}
        <Link
          to="/"
          className="block px-6 py-5 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors duration-200"
        >
          <span className="font-heading text-xl tracking-wide">MemoryStory</span>
          <span className="ml-2 text-xs text-zinc-500">管理</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const isActive = (() => {
              if (location.pathname === to) return true;
              // /admin/posts — active for list + /admin/posts/:id/edit, but NOT /admin/posts/new
              if (to === '/admin/posts') {
                return location.pathname.startsWith('/admin/posts/') && location.pathname !== '/admin/posts/new';
              }
              return false;
            })();
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Divider + Back to site */}
        <div className="px-3 py-2 border-t border-zinc-800">
          <a
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors duration-150"
          >
            <ExternalLink size={18} />
            <span>返回站点</span>
          </a>
        </div>

        {/* User info + Logout */}
        <div className="px-3 py-4 border-t border-zinc-800">
          <Link
            to="/admin/profile"
            className="flex items-center gap-3 px-3 py-2 mb-1 rounded-lg hover:bg-zinc-800/60 transition-colors duration-150 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={14} className="text-zinc-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                {user?.username ?? 'Admin'}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {user?.email ?? ''}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800/70 transition-colors duration-150 cursor-pointer"
          >
            <LogOut size={18} />
            <span>登出</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1 min-h-screen bg-zinc-50">
        <Outlet />
      </main>
    </div>
  );
}
