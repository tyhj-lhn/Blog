import { useState, useCallback, useEffect, useRef } from 'react';
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
  Menu,
  X,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile).
  // Refs in render is intentional: reads last pathname to detect navigation, resets sidebar.
  const prevPath = useRef(location.pathname);
  // eslint-disable-next-line react-hooks/refs
  if (prevPath.current !== location.pathname) {
    // eslint-disable-next-line react-hooks/refs
    prevPath.current = location.pathname;
    if (sidebarOpen) setSidebarOpen(false);
  }

  // Close sidebar on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`select-none cursor-default fixed left-0 top-0 bottom-0 w-64 bg-zinc-900 text-zinc-100 flex flex-col z-50 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 lg:hidden">
          <span className="font-heading text-xl tracking-wide">MemoryStory</span>
          <button
            onClick={closeSidebar}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="关闭菜单"
          >
            <X size={20} />
          </button>
        </div>

        {/* Brand (desktop only) */}
        <Link
          to="/"
          className="hidden lg:block px-6 py-5 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors duration-200"
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

      {/* Mobile top bar with hamburger */}
      <div className="select-none cursor-default fixed top-0 left-0 right-0 h-14 bg-white border-b border-zinc-200 flex items-center px-4 z-30 lg:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
          aria-label="打开菜单"
        >
          <Menu size={20} />
        </button>
        <span className="ml-3 font-heading text-lg text-zinc-900">MemoryStory</span>
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-screen bg-zinc-50 lg:ml-64 pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
