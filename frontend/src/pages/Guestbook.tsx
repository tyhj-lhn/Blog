import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import type { PaginatedResponse, GuestbookEntry } from '../types';
import Pagination from '../components/Pagination';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_LIMIT = 10;

export default function Guestbook() {
  const [page, setPage] = useState(1);
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<PaginatedResponse<GuestbookEntry>>({
    queryKey: ['guestbook', page],
    queryFn: () => api.get('/guestbook', { page, limit: PAGE_LIMIT }),
  });

  const submitEntry = useMutation({
    mutationFn: (formData: { nickname: string; message: string }) =>
      api.post('/guestbook', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guestbook'] });
      setNickname('');
      setMessage('');
      setSubmitError(null);
      setPage(1);
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const trimmedNickname = nickname.trim();
    const trimmedMessage = message.trim();

    if (!trimmedNickname) {
      setSubmitError('请输入昵称');
      return;
    }
    if (!trimmedMessage) {
      setSubmitError('请输入留言内容');
      return;
    }

    submitEntry.mutate({ nickname: trimmedNickname, message: trimmedMessage });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-4xl text-zinc-900 mb-2">留言板</h1>
      <p className="text-zinc-500 text-sm mb-8">欢迎留下你的足迹</p>

      {/* Submit form */}
      <form onSubmit={handleSubmit} className="mb-10 p-4 border border-zinc-200 rounded-lg bg-white space-y-3">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="你的昵称 *"
          maxLength={100}
          required
          className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="写下你想说的话..."
          maxLength={10000}
          required
          rows={3}
          className="w-full min-h-11 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
        />
        {submitError && <p className="text-red-500 text-sm">{submitError}</p>}
        <button
          type="submit"
          disabled={submitEntry.isPending}
          className="inline-flex items-center gap-2 min-h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
        >
          <MessageSquare size={16} />
          {submitEntry.isPending ? '提交中...' : '留言'}
        </button>
      </form>

      {/* Messages list */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-zinc-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-100 rounded w-1/4 mb-2" />
              <div className="h-4 bg-zinc-50 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-zinc-500 text-center py-12">加载失败，请稍后重试</p>
      )}

      {data && data.data.length === 0 && (
        <p className="text-zinc-400 text-center py-12">暂无留言，来留下第一条吧</p>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="space-y-3">
            {data.data.map((entry) => (
              <div
                key={entry.id}
                className="border border-zinc-200 rounded-lg p-4 bg-white"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm text-zinc-800">
                    {entry.nickname}
                  </span>
                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <Calendar size={12} />
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                  {entry.message}
                </p>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
