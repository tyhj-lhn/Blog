import { useState, useEffect, useRef } from 'react';
import { Link, Outlet } from 'react-router-dom';

const NAV_HIDE_THRESHOLD = 80;

export default function Layout() {
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;

        if (currentY <= 0) {
          setNavVisible(true);
        } else if (currentY > lastScrollY.current && currentY > NAV_HIDE_THRESHOLD) {
          setNavVisible(false);
        } else if (currentY < lastScrollY.current) {
          setNavVisible(true);
        }

        lastScrollY.current = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 font-body text-zinc-950">
      <nav
        className={`sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur transition-transform duration-300 ${
          navVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
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
      <main>
        <Outlet />
      </main>
    </div>
  );
}
