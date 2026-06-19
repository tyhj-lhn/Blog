import { useState } from 'react';
import { Send } from 'lucide-react';

interface CommentFormProps {
  onSubmit: (data: {
    username: string;
    email?: string;
    websiteUrl?: string;
    content: string;
    parentId?: number;
  }) => Promise<void>;
  parentId?: number;
  onCancel?: () => void;
}

export default function CommentForm({ onSubmit, parentId, onCancel }: CommentFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedContent = content.trim();

    if (!trimmedUsername) {
      setError('请输入用户名');
      return;
    }
    if (!trimmedContent) {
      setError('请输入评论内容');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        username: trimmedUsername,
        email: email.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        content: trimmedContent,
        parentId,
      });
      setUsername('');
      setEmail('');
      setWebsiteUrl('');
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {parentId && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">回复评论</span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors"
            >
              取消回复
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名 *"
          maxLength={50}
          required
          className="min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱 (可选)"
          maxLength={255}
          className="min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
        />
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="网站 (可选)"
          maxLength={500}
          className="min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的想法..."
        maxLength={10000}
        required
        rows={4}
        className="w-full min-h-11 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 min-h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
      >
        <Send size={16} />
        {submitting ? '提交中...' : parentId ? '回复' : '发表评论'}
      </button>
    </form>
  );
}
