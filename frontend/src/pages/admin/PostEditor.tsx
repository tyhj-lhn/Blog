import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft, Trash2, AlertTriangle, FileUp, FolderOpen, FileText, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import type { Post, PostSummary, PaginatedResponse } from '../../types';
import type { MarkdownAction } from '../../components/MarkdownToolbar';
import MarkdownToolbar from '../../components/MarkdownToolbar';
import CoverImageUpload from '../../components/CoverImageUpload';
import PostPreview from '../../components/PostPreview';
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
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
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

  // Fetch drafts for the drafts panel (only in new-post mode)
  const { data: draftsData } = useQuery<PaginatedResponse<PostSummary>>({
    queryKey: ['admin-posts', 1, '', 'DRAFT'],
    queryFn: () =>
      api.get('/admin/posts', { page: 1, limit: 50, status: 'DRAFT' }),
    enabled: !isEdit,
  });

  const drafts = draftsData?.data ?? [];

  const buildPayload = (forceStatus?: 'DRAFT' | 'PUBLISHED') => ({
    title: title.trim(),
    content: content.trim(),
    excerpt: excerpt.trim() || null,
    coverImage: coverImage.trim() || null,
    tags,
    status: forceStatus ?? status,
  });

  const createMutation = useMutation({
    mutationFn: (forceStatus?: 'DRAFT' | 'PUBLISHED') =>
      api.post<Post>('/admin/posts', buildPayload(forceStatus)),
    onSuccess: (post) => {
      onSaveSuccess();
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      if (post.status === 'DRAFT') {
        // Stay on page — navigate to edit mode for this draft
        navigate(`/admin/posts/${post.id}/edit`, { replace: true });
      } else {
        navigate('/admin/dashboard');
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (forceStatus?: 'DRAFT' | 'PUBLISHED') =>
      api.put<Post>(`/admin/posts/${id}`, buildPayload(forceStatus)),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
      if (post.status === 'DRAFT') {
        // Stay on the current edit page
        setError(null);
      } else {
        navigate('/admin/dashboard');
      }
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
    onError: (err: Error) => {
      setError(err.message);
      setShowDeleteDialog(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('请输入文章标题'); return; }
    if (!content.trim()) { setError('请输入文章内容'); return; }

    if (isEdit) {
      updateMutation.mutate(status);
    } else {
      createMutation.mutate(status);
    }
  };

  // Save as draft regardless of the status dropdown
  const handleSaveDraft = () => {
    setError(null);

    if (!title.trim() && !content.trim()) {
      setError('请至少填写标题或内容');
      return;
    }

    if (isEdit) {
      updateMutation.mutate('DRAFT');
    } else {
      createMutation.mutate('DRAFT');
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleMarkdownAction = useCallback(
    (action: MarkdownAction) => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.substring(start, end);
      const hasSelection = start !== end;

      let newText: string;
      let cursorPos: number;

      if (hasSelection) {
        newText =
          content.substring(0, start) +
          action.before +
          selectedText +
          action.after +
          content.substring(end);
        cursorPos = start + action.before.length + selectedText.length + action.after.length;
      } else {
        const insertText = action.before + action.placeholder + action.after;
        newText = content.substring(0, start) + insertText + content.substring(end);
        cursorPos = start + action.before.length + action.placeholder.length + action.after.length;
      }

      setContent(newText);

      // Restore focus and cursor after React re-render
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [content],
  );

  const handleDocUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['md', 'txt', 'markdown'].includes(ext)) {
      setError('仅支持 .md 和 .txt 文件');
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        setContent(text);
      }
    };
    reader.onerror = () => {
      setError('文件读取失败');
    };
    reader.readAsText(file);

    if (docFileInputRef.current) docFileInputRef.current.value = '';
  }, []);

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
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                placeholder="简短描述..."
                maxLength={500}
                className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
              />
            </div>

            <CoverImageUpload value={coverImage} onChange={setCoverImage} />

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

            {/* Draft save button */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting || deleteMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg border border-zinc-200 bg-white text-zinc-600 text-sm font-medium hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
            >
              <Save size={16} />
              {isSubmitting ? '保存中...' : '保存草稿'}
            </button>

            {/* Drafts panel — only in new-post mode */}
            {!isEdit && (
              <div className="border border-zinc-200 rounded-lg bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                  <FolderOpen size={14} className="text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-600">
                    草稿箱
                    {drafts.length > 0 && (
                      <span className="ml-1 text-xs text-zinc-400">({drafts.length})</span>
                    )}
                  </span>
                </div>
                {drafts.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-4 px-4">
                    暂无草稿
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {drafts.map((draft) => (
                      <Link
                        key={draft.id}
                        to={`/admin/posts/${draft.id}/edit`}
                        className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50 last:border-none hover:bg-zinc-50 transition-colors cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center shrink-0">
                          <FileText size={14} className="text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-700 truncate group-hover:text-blue-600 transition-colors">
                            {draft.title || '(无标题)'}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {new Date(draft.createdAt).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — editor + preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <label htmlFor="content" className="block text-sm text-zinc-600">
                  内容 <span className="text-zinc-400">(Markdown)</span>
                </label>
                {/* Document upload */}
                <input
                  ref={docFileInputRef}
                  type="file"
                  accept=".md,.txt,.markdown"
                  className="hidden"
                  onChange={handleDocUpload}
                />
                <button
                  type="button"
                  onClick={() => docFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-blue-600 transition-colors cursor-pointer"
                  title="导入 .md 或 .txt 文件"
                >
                  <FileUp size={13} />
                  导入文档
                </button>
              </div>
              <span className="text-xs text-zinc-400">
                {content.length} 字
              </span>
            </div>

            <MarkdownToolbar onAction={handleMarkdownAction} />

            <textarea
              id="content"
              ref={contentTextareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写点什么..."
              required
              rows={18}
              className="w-full min-h-11 px-3 py-2 rounded-t-none rounded-b-lg border border-zinc-200 border-t-0 bg-white text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
            />

            <PostPreview
              title={title}
              content={content}
              coverImage={coverImage || undefined}
              tags={tags}
              excerpt={excerpt || undefined}
            />
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
