import { Mail, Globe, MapPin, Hand } from 'lucide-react';

export default function About() {
  return (
    <div>
      <h1 className="font-heading text-4xl text-zinc-900 mb-8">关于我</h1>

      <div className="max-w-prose">
        <section className="mb-8">
          <h2 className="font-heading text-2xl text-zinc-900 mb-3 flex items-center gap-2">
              你好 <Hand size={24} />
            </h2>
          <p className="text-zinc-700 leading-relaxed">
            欢迎来到 MemoryStory，这是我的个人博客。在这里，我记录技术思考，
            分享生活感悟，整理学习笔记。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-heading text-2xl text-zinc-900 mb-3">关于这个博客</h2>
          <p className="text-zinc-700 leading-relaxed">
            这个博客使用 React + TypeScript + Fastify + PostgreSQL 构建，
            采用瑞士现代主义设计风格（Swiss Modernism），
            追求简洁、清晰、克制的视觉表达。
            评论系统支持盖楼模式，欢迎在任何文章下留下你的想法。
          </p>
        </section>

        <section>
          <h2 className="font-heading text-2xl text-zinc-900 mb-3">联系方式</h2>
          <div className="space-y-3">
            <a
              href="mailto:hello@example.com"
              className="flex items-center gap-2 text-zinc-600 hover:text-blue-600 transition-colors cursor-pointer min-h-11"
            >
              <Mail size={18} />
              <span>hello@example.com</span>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zinc-600 hover:text-blue-600 transition-colors cursor-pointer min-h-11"
            >
              <Globe size={18} />
              <span>GitHub</span>
            </a>
            <span className="flex items-center gap-2 text-zinc-500">
              <MapPin size={18} />
              <span>Earth, Solar System</span>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
