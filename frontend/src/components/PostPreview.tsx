import { Calendar, Tag as TagIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface PostPreviewProps {
  title: string;
  content: string;
  coverImage?: string;
  tags?: string[];
}

function todayString(): string {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function PostPreview({ title, content, coverImage, tags }: PostPreviewProps) {
  return (
    <div className="mt-4 border border-zinc-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-zinc-50/80 border-b border-zinc-100">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          发布预览
        </h3>
      </div>

      {/* Mock hero — mirrors PostDetail hero structure at smaller scale */}
      <section
        className={`relative flex items-end min-h-[24vh] ${
          coverImage ? '' : 'bg-zinc-800'
        }`}
      >
        {coverImage ? (
          <>
            <img
              src={coverImage}
              alt="封面预览"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-zinc-950/55" />
          </>
        ) : (
          <div className="absolute inset-0 bg-zinc-950/30" />
        )}
        <div className="relative z-10 w-full px-4 pb-4">
          <h2 className="font-heading text-xl md:text-2xl text-white mb-2 drop-shadow">
            {title || <span className="text-white/40">(无标题)</span>}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {todayString()}
            </span>
            {tags && tags.length > 0 && (
              <span className="flex items-center gap-1">
                <TagIcon size={11} />
                {tags.join(' · ')}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 6px gradient transition — same as Home / PostDetail */}
      <div className="h-1.5 bg-linear-to-b from-zinc-950/40 to-zinc-200/60" />

      {/* Content area — mirrors PostDetail prose rendering */}
      <section className="bg-white px-4 py-6">
        <div className="prose prose-zinc prose-sm max-w-none text-zinc-800 leading-relaxed">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt ?? ''}
                    className="max-w-full h-auto"
                    loading="lazy"
                  />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-zinc-300 text-sm not-prose">
              开始输入内容，将在此处实时预览发布效果
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
