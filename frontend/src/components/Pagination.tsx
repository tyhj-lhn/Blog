import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-8" aria-label="分页导航">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-zinc-200/70 text-zinc-600 hover:bg-zinc-100/80 hover:shadow-soft disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
        aria-label="上一页"
      >
        <ChevronLeft size={18} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`min-w-11 min-h-11 flex items-center justify-center rounded-xl text-sm transition-all duration-200 cursor-pointer ${
            p === page
              ? 'bg-blue-600 text-white shadow-soft'
              : 'border border-zinc-200/70 text-zinc-600 hover:bg-zinc-100/80 hover:shadow-soft'
          }`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-zinc-200/70 text-zinc-600 hover:bg-zinc-100/80 hover:shadow-soft disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
        aria-label="下一页"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
