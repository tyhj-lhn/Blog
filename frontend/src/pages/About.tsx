import { useQuery } from '@tanstack/react-query';
import { Mail, Globe, MapPin, Hand } from 'lucide-react';
import { api } from '../lib/api';
import type { AboutContent } from '../types';

export default function About() {
  const { data, isLoading, isError } = useQuery<AboutContent | null>({
    queryKey: ['about'],
    queryFn: () => api.get('/about'),
  });

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-4xl text-zinc-900 mb-8">关于我</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          无法加载关于页面内容，请稍后重试。
        </div>
      </div>
    );
  }

  // Fallback values when no CMS data exists
  const greetingTitle = data?.greetingTitle || '你好';
  const greetingContent = data?.greetingContent || '欢迎来到 MemoryStory，这是我的个人博客。';
  const aboutTitle = data?.aboutTitle || '关于这个博客';
  const aboutContent = data?.aboutContent || '这个博客使用 React + TypeScript + Fastify + PostgreSQL 构建，采用瑞士现代主义设计风格。';
  const email = data?.email;
  const github = data?.github;
  const location = data?.location;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div className="h-10 bg-zinc-200 rounded w-40" />
          <div className="space-y-4">
            <div className="h-7 bg-zinc-200 rounded w-24" />
            <div className="h-16 bg-zinc-200 rounded" />
          </div>
          <div className="space-y-4">
            <div className="h-7 bg-zinc-200 rounded w-36" />
            <div className="h-32 bg-zinc-200 rounded" />
          </div>
          <div className="h-40 bg-zinc-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-4xl text-zinc-900 mb-8">关于我</h1>

      <div className="max-w-prose">
        <section className="mb-8">
          <h2 className="font-heading text-2xl text-zinc-900 mb-4 flex items-center gap-2">
            {greetingTitle} <Hand size={24} />
          </h2>
          <p className="text-zinc-700 leading-relaxed">
            {greetingContent}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-2xl text-zinc-900 mb-4">{aboutTitle}</h2>
          <p className="text-zinc-700 leading-relaxed">
            {aboutContent}
          </p>
        </section>

        {(email || github || location) && (
          <section>
            <h2 className="font-heading text-2xl text-zinc-900 mb-4">联系方式</h2>
            <div className="border border-zinc-200/70 rounded-2xl p-5 bg-white shadow-soft space-y-3">
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 text-zinc-600 hover:text-blue-500 transition-colors cursor-pointer min-h-11"
                >
                  <Mail size={18} />
                  <span>{email}</span>
                </a>
              )}
              {github && (
                <a
                  href={github.startsWith('http') ? github : `https://github.com/${github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-600 hover:text-blue-500 transition-colors cursor-pointer min-h-11"
                >
                  <Globe size={18} />
                  <span>GitHub</span>
                </a>
              )}
              {location && (
                <span className="flex items-center gap-2 text-zinc-500">
                  <MapPin size={18} />
                  <span>{location}</span>
                </span>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
