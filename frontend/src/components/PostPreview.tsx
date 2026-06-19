import { Calendar, Tag as TagIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          发布预览
        </h3>

        {/* Cover image */}
        {coverImage && (
          <img
            src={coverImage}
            alt="封面"
            className="w-full max-h-48 object-cover rounded-lg mb-4"
          />
        )}

        {/* Title */}
        <h2 className="font-heading text-2xl md:text-3xl text-zinc-900 mb-2">
          {title || <span className="text-zinc-300">(无标题)</span>}
        </h2>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mb-3">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {todayString()}
          </span>
          {tags && tags.length > 0 && (
            <span className="flex items-center gap-1">
              <TagIcon size={12} />
              {tags.join(' · ')}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100" />
      </div>

      {/* Content */}
      <div className="px-4 pb-4 pt-3">
        <div className="prose prose-sm prose-zinc max-w-none">
          {content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-zinc-300 text-sm">预览区——在左侧输入 Markdown 内容</p>
          )}
        </div>
      </div>
    </div>
  );
}
