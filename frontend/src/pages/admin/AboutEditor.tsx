import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { AboutContent } from '../../types';

export default function AboutEditor() {
  const queryClient = useQueryClient();

  // Form state
  const [greetingTitle, setGreetingTitle] = useState('');
  const [greetingContent, setGreetingContent] = useState('');
  const [aboutTitle, setAboutTitle] = useState('');
  const [aboutContent, setAboutContent] = useState('');
  const [email, setEmail] = useState('');
  const [github, setGithub] = useState('');
  const [location, setLocation] = useState('');
  const [saved, setSaved] = useState(false);

  // Fetch current about content
  const { data, isLoading } = useQuery<AboutContent | null>({
    queryKey: ['about'],
    queryFn: () => api.get('/about'),
  });

  // Populate form when data arrives — React Query sync is valid pattern
  useEffect(() => {
    if (data) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setGreetingTitle(data.greetingTitle ?? '');
      setGreetingContent(data.greetingContent ?? '');
      setAboutTitle(data.aboutTitle ?? '');
      setAboutContent(data.aboutContent ?? '');
      setEmail(data.email ?? '');
      setGithub(data.github ?? '');
      setLocation(data.location ?? '');
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: {
      greetingTitle: string;
      greetingContent: string;
      aboutTitle: string;
      aboutContent: string;
      email: string | null;
      github: string | null;
      location: string | null;
    }) => api.put('/admin/about', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['about'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    mutation.mutate({
      greetingTitle,
      greetingContent,
      aboutTitle,
      aboutContent,
      email: email || null,
      github: github || null,
      location: location || null,
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-200 rounded w-48" />
          <div className="h-28 bg-zinc-200 rounded" />
          <div className="h-8 bg-zinc-200 rounded w-48" />
          <div className="h-52 bg-zinc-200 rounded" />
          <div className="h-40 bg-zinc-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-heading text-2xl text-zinc-900 mb-6">关于页面编辑</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Greeting section */}
        <section className="border border-zinc-200/70 rounded-2xl p-6 bg-white shadow-soft">
          <h2 className="font-heading text-lg text-zinc-800 mb-4">欢迎语</h2>

          <label className="block mb-3">
            <span className="text-sm font-medium text-zinc-700">标题</span>
            <input
              type="text"
              value={greetingTitle}
              onChange={(e) => setGreetingTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="例如：你好"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">内容</span>
            <textarea
              value={greetingContent}
              onChange={(e) => setGreetingContent(e.target.value)}
              maxLength={2000}
              required
              rows={3}
              placeholder="欢迎来到我的博客..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-y min-h-20"
            />
            <span className="text-xs text-zinc-400 mt-1 inline-block">
              {greetingContent.length}/2000
            </span>
          </label>
        </section>

        {/* About section */}
        <section className="border border-zinc-200/70 rounded-2xl p-6 bg-white shadow-soft">
          <h2 className="font-heading text-lg text-zinc-800 mb-4">关于博客</h2>

          <label className="block mb-3">
            <span className="text-sm font-medium text-zinc-700">标题</span>
            <input
              type="text"
              value={aboutTitle}
              onChange={(e) => setAboutTitle(e.target.value)}
              maxLength={100}
              required
              placeholder="例如：关于这个博客"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">内容</span>
            <textarea
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              maxLength={5000}
              required
              rows={6}
              placeholder="描述你的博客..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors resize-y min-h-30"
            />
            <span className="text-xs text-zinc-400 mt-1 inline-block">
              {aboutContent.length}/5000
            </span>
          </label>
        </section>

        {/* Contact info */}
        <section className="border border-zinc-200/70 rounded-2xl p-6 bg-white shadow-soft">
          <h2 className="font-heading text-lg text-zinc-800 mb-4">联系方式</h2>

          <label className="block mb-3">
            <span className="text-sm font-medium text-zinc-700">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="hello@example.com"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
            />
          </label>

          <label className="block mb-3">
            <span className="text-sm font-medium text-zinc-700">GitHub</span>
            <input
              type="text"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              maxLength={255}
              placeholder="https://github.com/username"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">位置</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={100}
              placeholder="Earth, Solar System"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
            />
          </label>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-11"
          >
            {mutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{mutation.isPending ? '保存中...' : '保存'}</span>
          </button>

          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 size={16} />
              已保存
            </span>
          )}

          {mutation.isError && (
            <span className="text-sm text-red-600">
              {mutation.error instanceof Error ? mutation.error.message : '保存失败'}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
