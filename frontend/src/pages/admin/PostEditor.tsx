import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft, Trash2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../../lib/api';
import type { Post } from '../../types';
import TagInput from '../../components/TagInput';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAutoSave } from '../../hooks/useAutoSave';

export default function PostEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isDirty = title !== '' || content !== '' || excerpt !== '' || coverImage !== '' || tags.length > 0;

  const draftKey = id || 'new';

  const draftData = useMemo(() => ({
    title, content, excerpt, coverImage, tags, status,
  }), [title, content, excerpt, coverImage, tags, status]);

  const { savedDraft, showRestoreBanner, restoreDraft, discardDraft, onSaveSuccess } = useAutoSave(
    draftKey,
    draftData,
    isDirty && !isEdit,
  );

  const handleRestoreDraft = () => {
    const draft = restoreDraft();
    if (draft) {
      setTitle(draft.title);
      setContent(draft.content);
      setExcerpt(draft.excerpt);
      setCoverImage(draft.coverImage);
      setTags(draft.tags);
      setStatus(draft.status);
    }
  };

  // Load existing post for edit mode
  const { data: existingPost, isLoading: isLoadingPost } = useQuery<Post>({
    queryKey: ['post-edit', id],
    queryFn: () => api.get(`/admin/posts/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (existingPost) {
      setTitle(existingPost.title);
      setContent(existingPost.content);
      setExcerpt(existingPost.excerpt || '');
      setCoverImage(existingPost.coverImage || '');
      setTags(existingPost.tags);
      setStatus(existingPost.status);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [existingPost]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/posts', {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt.trim() || undefined,
        coverImage: coverImage.trim() || undefined,
        tags,
        status,
      }),
    onSuccess: () => {
      onSaveSuccess();
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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
        coverImage: coverImage.trim() || undefined,
        tags,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      navigate('/admin/dashboard');
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/admin/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      navigate('/admin/dashboard');
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('请输入文章标题'); return; }
    if (!content.trim()) { setError('请输入文章内容'); return; }

    if (isEdit) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-heading text-3xl text-zinc-900 flex-1">
          {isEdit ? '编辑文章' : '新建文章'}
        </h1>
        {isEdit && (
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
            删除文章
          </button>
        )}
      </div>

      {/* Draft restore banner */}
      {showRestoreBanner && savedDraft && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} />
            <span>检测到未保存的草稿</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreDraft}
              className="min-h-9 px-3 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 transition-colors cursor-pointer"
            >
              恢复草稿
            </button>
            <button
              onClick={discardDraft}
              className="min-h-9 px-3 rounded-lg border border-amber-300 text-amber-700 text-sm hover:bg-amber-100 transition-colors cursor-pointer"
            >
              丢弃
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {isEdit && isLoadingPost && (
        <div className="animate-pulse space-y-4">
          <div className="h-11 bg-zinc-100 rounded-lg" />
          <div className="h-11 bg-zinc-100 rounded-lg" />
          <div className="h-[calc(100vh-16rem)] bg-zinc-100 rounded-lg" />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={isEdit && isLoadingPost ? 'hidden' : ''}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column — metadata + content edit */}
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm text-zinc-600 mb-1">标题</label>
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
              <label htmlFor="coverImage" className="block text-sm text-zinc-600 mb-1">
                封面图片 URL <span className="text-zinc-400">(可选)</span>
              </label>
              <input
                id="coverImage"
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
                maxLength={500}
                className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
              />
              {coverImage && (
                <img
                  src={coverImage}
                  alt="封面预览"
                  className="mt-2 max-h-32 rounded-lg object-cover border border-zinc-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>

            <div>
              <label className="block text-sm text-zinc-600 mb-1">标签</label>
              <TagInput tags={tags} onChange={setTags} />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label htmlFor="status" className="block text-sm text-zinc-600 mb-1">状态</label>
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

              <div className="flex-1 flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting || deleteMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
                >
                  <Save size={16} />
                  {isSubmitting ? '保存中...' : isEdit ? '更新' : '创建'}
                </button>
              </div>
            </div>
          </div>

          {/* Right column — Markdown preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="content" className="block text-sm text-zinc-600">
                内容 <span className="text-zinc-400">(Markdown)</span>
              </label>
              <span className="text-xs text-zinc-400">
                {content.length} 字
              </span>
            </div>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写点什么..."
              required
              rows={18}
              className="w-full min-h-11 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
            />

            <div className="mt-4">
              <h3 className="text-sm text-zinc-600 mb-2 font-medium">预览</h3>
              <div className="border border-zinc-200 rounded-lg p-4 bg-white min-h-75 prose prose-sm prose-zinc max-w-none overflow-y-auto">
                {content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-zinc-400 text-sm">预览区——在左侧输入 Markdown 内容</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="删除文章"
        message={`确定要删除「${title || '(无标题)'}」吗？此操作不可撤销，所有关联评论也将被删除。`}
        confirmLabel="删除"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
