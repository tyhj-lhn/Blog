import { useEffect, useState, useRef } from 'react';

interface ScrollSpyOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useScrollSpy(
  headingIds: string[],
  options?: ScrollSpyOptions,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleMapRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    visibleMapRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleMapRef.current.set(entry.target.id, entry.isIntersecting);
        }
        const active = headingIds.find((id) => visibleMapRef.current.get(id));
        setActiveId(active ?? null);
      },
      {
        rootMargin: options?.rootMargin ?? '-80px 0px -70% 0px',
        threshold: options?.threshold ?? 0,
      },
    );

    observerRef.current = observer;

    const raf = requestAnimationFrame(() => {
      for (const id of headingIds) {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [headingIds, options?.rootMargin, options?.threshold]);

  return activeId;
}
