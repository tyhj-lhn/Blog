import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50 font-body text-zinc-950">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <Link to="/" className="font-heading text-2xl text-zinc-900">
          MemoryStory
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link to="/" className="hover:text-blue-600 transition-colors">首页</Link>
          <Link to="/tags" className="hover:text-blue-600 transition-colors">标签</Link>
          <Link to="/guestbook" className="hover:text-blue-600 transition-colors">留言板</Link>
          <Link to="/search" className="hover:text-blue-600 transition-colors">搜索</Link>
          <Link to="/about" className="hover:text-blue-600 transition-colors">关于我</Link>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
