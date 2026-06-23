import { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

const THRESHOLD = 300;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="回到顶部"
      className={`fixed bottom-8 right-8 z-40 min-h-11 min-w-11 p-3 rounded-full border border-white/40 bg-white/80 backdrop-blur-md shadow-glass text-zinc-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-300 cursor-pointer ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowUp size={20} />
    </button>
  );
}
