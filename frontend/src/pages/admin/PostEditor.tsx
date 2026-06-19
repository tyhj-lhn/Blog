import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Eye, ArrowLeft } from 'lucide-react';
import { api } from '../../lib/api';
import type { Post } from '../../types';

export default function PostEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [error, setError] = useState<string | null>(null);

  // Load existing post for edit mode
  const { data: existingPost } = useQuery<Post>({
    queryKey: ['post-edit', id],
    queryFn: () => api.get(`/admin/posts/${id}`),
    enabled: isEdit,
  });

  // Sync query result into form state — a standard React Query pattern.
  // The effect only fires when existingPost (server data) changes, not on
  // every render, so it does not cause cascading re-renders.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (existingPost) {
      setTitle(existingPost.title);
      setContent(existingPost.content);
      setExcerpt(existingPost.excerpt || '');
      setTagsInput(existingPost.tags.join(', '));
      setStatus(existingPost.status);
    }
  }, [existingPost]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/posts', {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/admin/dashboard');
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/admin/posts/${id}`, {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/admin/dashboard');
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('请输入文章标题');
      return;
    }
    if (!content.trim()) {
      setError('请输入文章内容');
      return;
    }

    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading text-3xl text-zinc-900">
          {isEdit ? '编辑文章' : '新建文章'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm text-zinc-600 mb-1">
            标题
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
            maxLength={200}
            required
            className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
          />
        </div>

        <div>
          <label htmlFor="excerpt" className="block text-sm text-zinc-600 mb-1">
            摘要 <span className="text-zinc-400">(可选)</span>
          </label>
          <input
            id="excerpt"
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="简短描述..."
            maxLength={500}
            className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm text-zinc-600 mb-1">
            内容 <span className="text-zinc-400">(Markdown)</span>
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写点什么..."
            required
            rows={16}
            className="w-full min-h-11 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm text-zinc-600 mb-1">
            标签 <span className="text-zinc-400">(逗号分隔)</span>
          </label>
          <input
            id="tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="React, TypeScript, 教程"
            className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
          />
        </div>

        <div>
          <label htmlFor="status" className="block text-sm text-zinc-600 mb-1">
            状态
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150 cursor-pointer"
          >
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">发布</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 min-h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
          >
            <Save size={16} />
            {isSubmitting ? '保存中...' : isEdit ? '更新' : '创建'}
          </button>
          <button
            type="button"
            onClick={() => setStatus((s) => (s === 'DRAFT' ? 'PUBLISHED' : 'DRAFT'))}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg border border-zinc-200 text-zinc-600 text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <Eye size={16} />
            切换为{status === 'DRAFT' ? '发布' : '草稿'}
          </button>
        </div>
      </form>
    </div>
  );
}
