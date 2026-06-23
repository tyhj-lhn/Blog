import { useState, useEffect, useCallback, useRef } from 'react';
import { ListTree, X } from 'lucide-react';
import type { TocHeading } from '../lib/parseHeadings';

const SCROLL_THRESHOLD = 300;

interface TableOfContentsProps {
  headings: TocHeading[];
  activeId: string | null;
}

/** Find the active heading node (or the nearest parent) for the label. */
function findActiveLabel(
  headings: TocHeading[],
  activeId: string | null,
): string | null {
  if (!activeId) return null;
  for (const h of headings) {
    if (h.id === activeId) return h.text;
    for (const c of h.children) {
      if (c.id === activeId) return c.text;
    }
  }
  return null;
}

function TocItem({
  item,
  activeId,
  onClick,
}: {
  item: TocHeading;
  activeId: string | null;
  onClick: (id: string) => void;
}) {
  const isActive = item.id === activeId;
  const isH2 = item.level === 2;

  return (
    <li>
      <button
        type="button"
        onClick={() => onClick(item.id)}
        title={item.text}
        className={`w-full text-left cursor-pointer transition-colors duration-150 truncate block ${
          isH2
            ? 'pl-3 pr-4 py-1.5 text-sm font-medium rounded-r-md'
            : 'pl-7 pr-4 py-1 text-xs text-zinc-600 rounded-r-md'
        } ${
          isActive
            ? 'text-blue-600 border-l-2 border-blue-500 bg-blue-50/50'
            : 'text-zinc-700 hover:text-blue-600 hover:bg-zinc-100/50 border-l-2 border-transparent'
        }`}
      >
        {item.text}
      </button>
      {item.children.length > 0 && (
        <ul className="space-y-0.5 mt-0.5">
          {item.children.map((child) => (
            <TocItem
              key={child.id}
              item={child}
              activeId={activeId}
              onClick={onClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TableOfContents({
  headings,
  activeId,
}: TableOfContentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ---- Scroll-based visibility (like BackToTop) ----
  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setVisible(window.scrollY > SCROLL_THRESHOLD);
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setIsExpanded(false);
    }
  }, []);

  // Auto-expand when TOC becomes visible, auto-collapse when scrolling back to hero
  useEffect(() => {
    if (visible) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [visible]);

  // Scroll active item into view when panel expands
  useEffect(() => {
    if (!isExpanded || !activeId) return;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(activeId);
      if (el && panelRef.current?.contains(el)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [isExpanded, activeId]);

  // Escape closes
  useEffect(() => {
    if (!isExpanded) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsExpanded(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  // Click outside closes
  useEffect(() => {
    if (!isExpanded) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('click', onClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClickOutside);
    };
  }, [isExpanded]);

  if (headings.length === 0) return null;

  const currentLabel = findActiveLabel(headings, activeId);

  return (
    <div
      ref={panelRef}
      className={`hidden 2xl:block fixed z-30 transition-all duration-300 ${
        isExpanded
          ? 'right-[max(1rem,calc((100vw-64rem)/2-14rem-1rem))] top-28 w-56'
          : 'right-[max(1rem,calc((100vw-64rem)/2-14rem-1rem))] top-28'
      } ${
        /* When collapsed, hide until scrolled past hero */
        !isExpanded
          ? visible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
          : ''
      }`}
    >
      {!isExpanded ? (
        /* Collapsed: chapter label + icon button */
        <div className="flex items-center gap-2">
          {currentLabel && visible && (
            <span className="text-xs text-zinc-500 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-zinc-200/60 shadow-soft max-w-35 truncate select-none">
              {currentLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="展开目录"
            className="min-h-11 min-w-11 p-2.5 rounded-full border border-white/40 bg-white/80 backdrop-blur-md shadow-glass text-zinc-500 hover:text-blue-600 hover:border-blue-300 transition-all duration-300 cursor-pointer shrink-0"
          >
            <ListTree size={18} />
          </button>
        </div>
      ) : (
        /* Expanded: full TOC panel */
        <div className="rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl shadow-glass overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span className="font-heading text-sm text-zinc-800 select-none">
              目录
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-label="收起目录"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          {currentLabel && (
            <div className="px-4 py-2 border-b border-zinc-100/50 bg-blue-50/20 select-none">
              <span className="text-xs text-zinc-500 truncate block">
                当前章节：<span className="text-blue-600 font-medium">{currentLabel}</span>
              </span>
            </div>
          )}
          <nav
            className="overflow-y-auto max-h-[calc(100vh-14rem)] py-2"
            aria-label="目录导航"
          >
            <ul className="space-y-0.5">
              {headings.map((item) => (
                <TocItem
                  key={item.id}
                  item={item}
                  activeId={activeId}
                  onClick={handleClick}
                />
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
