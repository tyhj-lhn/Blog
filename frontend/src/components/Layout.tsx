import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, Tag, MessageSquareText, Search, User } from 'lucide-react';

const NAV_HIDE_THRESHOLD = 80;

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isPostDetail = location.pathname.startsWith('/post/');
  const hasHero = isHome || isPostDetail;
  const hasHeroRef = useRef(hasHero);
  const [navVisible, setNavVisible] = useState(true);
  const [scrolled, setScrolled] = useState(() => !hasHero || window.scrollY > 0);
  const lastScrollY = useRef(0);

  // Keep ref in sync with hasHero (not during render — satisfies react-hooks/refs)
  useEffect(() => {
    hasHeroRef.current = hasHero;
  });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const currentY = window.scrollY;

        setScrolled(hasHeroRef.current ? currentY > 0 : true);

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

  // Pages with hero: let scroll position decide. Others: always glass nav.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!hasHero) {
        setScrolled(true);
      } else if (window.scrollY <= 0) {
        setScrolled(false);
      }
    });
  }, [hasHero]);

  return (
    <div className="min-h-screen bg-zinc-50 font-body text-zinc-950">
      <nav
        className={`select-none cursor-default fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 py-4 transition-all duration-300 ${
          scrolled
            ? 'bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]'
            : 'bg-transparent backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.06)]'
        } ${
          navVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <Link
          to="/"
          className={`font-logo text-2xl transition-colors ${
            scrolled ? 'text-zinc-900' : 'text-white hover:text-white/80'
          }`}
        >
          MemoryStory
        </Link>
        <div className={`flex items-center gap-6 text-sm transition-colors ${
          scrolled ? 'text-zinc-950' : 'text-white/80'
        }`}>
          <Link to="/" className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors ${!scrolled && 'hover:text-white'}`}>
            <Home size={16} />
            <span>首页</span>
          </Link>
          <Link to="/tags" className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors ${!scrolled && 'hover:text-white'}`}>
            <Tag size={16} />
            <span>标签</span>
          </Link>
          <Link to="/guestbook" className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors ${!scrolled && 'hover:text-white'}`}>
            <MessageSquareText size={16} />
            <span>留言板</span>
          </Link>
          <Link to="/search" className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors ${!scrolled && 'hover:text-white'}`}>
            <Search size={16} />
            <span>搜索</span>
          </Link>
          <Link to="/about" className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors ${!scrolled && 'hover:text-white'}`}>
            <User size={16} />
            <span>关于我</span>
          </Link>
        </div>
      </nav>
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  );
}
