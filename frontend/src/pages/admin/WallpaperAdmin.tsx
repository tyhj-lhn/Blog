import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Upload, X, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Wallpaper, UploadedFile } from '../../types';

const IMAGE_MAX = 10 * 1024 * 1024; // 10 MB
const VIDEO_MAX = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'video/mp4'];

export default function WallpaperAdmin() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Gallery selection ---
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

  // --- Upload state ---
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // --- Save feedback ---
  const [saved, setSaved] = useState(false);

  // Current wallpaper
  const { data: wallpaper } = useQuery<Wallpaper | null>({
    queryKey: ['admin-wallpaper'],
    queryFn: () => api.get<Wallpaper | null>('/admin/wallpaper'),
  });

  // Uploaded files gallery
  const {
    data: files,
    isLoading: filesLoading,
    isError: filesError,
  } = useQuery<UploadedFile[]>({
    queryKey: ['admin-uploads'],
    queryFn: () => api.get<UploadedFile[]>('/admin/uploads'),
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      api.put('/admin/wallpaper', { type: selectedFile!.type, url: selectedFile!.url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallpaper'] });
      queryClient.invalidateQueries({ queryKey: ['wallpaper'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => api.del('/admin/wallpaper'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallpaper'] });
      queryClient.invalidateQueries({ queryKey: ['wallpaper'] });
      setSelectedFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: (filename: string) => api.del(`/admin/uploads/${filename}`),
    onMutate: async (filename) => {
      await queryClient.cancelQueries({ queryKey: ['admin-uploads'] });
      const prev = queryClient.getQueryData<UploadedFile[]>(['admin-uploads']);
      queryClient.setQueryData<UploadedFile[]>(
        ['admin-uploads'],
        (old) => old?.filter((f) => f.filename !== filename) ?? [],
      );
      return { prev };
    },
    onError: (_err, _filename, context) => {
      if (context?.prev) queryClient.setQueryData(['admin-uploads'], context.prev);
    },
    onSuccess: (_data, filename) => {
      // If deleted file was selected, clear selection
      if (selectedFile?.filename === filename) {
        setSelectedFile(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallpaper'] });
      queryClient.invalidateQueries({ queryKey: ['wallpaper'] });
    },
  });

  const canSave = selectedFile !== null;

  // --- Upload handler ---
  const processFile = useCallback(
    async (file: File) => {
      // Client-side MIME validation
      if (!ALLOWED_MIME.includes(file.type)) {
        setUploadError('仅支持 JPG、PNG 和 MP4 文件');
        return;
      }
      // Client-side size check
      const maxSize = file.type === 'video/mp4' ? VIDEO_MAX : IMAGE_MAX;
      if (file.size > maxSize) {
        const label = file.type === 'video/mp4' ? '50 MB' : '10 MB';
        setUploadError(`文件大小不能超过 ${label}`);
        return;
      }

      setUploadError(null);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await api.upload<{ url: string }>('/admin/upload', formData);
        // Refresh gallery and auto-select the newly uploaded file
        const updated = await queryClient.fetchQuery<UploadedFile[]>({
          queryKey: ['admin-uploads'],
          queryFn: () => api.get<UploadedFile[]>('/admin/uploads'),
        });
        const found = updated?.find((f) => f.url === result.url) ?? null;
        setSelectedFile(found);
      } catch (err) {
        setUploadError((err as Error).message || '上传失败');
      } finally {
        setUploading(false);
      }
    },
    [queryClient],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [processFile],
  );

  const handleSelectFile = (f: UploadedFile) => {
    setSelectedFile(f);
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
  };

  const isCurrentWallpaper = (f: UploadedFile) => f.url === wallpaper?.url;
  const isSelected = (f: UploadedFile) => selectedFile?.url === f.url;

  // What to preview: selected file > current wallpaper
  const previewTarget = selectedFile ?? (wallpaper ? { url: wallpaper.url, type: wallpaper.type } : null);

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-heading text-3xl text-zinc-900 mb-2">背景壁纸</h1>
      <p className="text-sm text-zinc-500 mb-6">
        上传 JPG、PNG 或 MP4 文件作为博客首页 Hero 区的背景。留空则使用默认视频。
      </p>

      {/* ====== Upload Zone ====== */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors duration-200 cursor-pointer min-h-40 flex flex-col items-center justify-center ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-500">上传中...</span>
          </div>
        ) : (
          <>
            <Upload size={28} className="text-zinc-400 mb-2" />
            <p className="text-sm text-zinc-600 mb-1">拖拽或点击上传壁纸文件</p>
            <p className="text-xs text-zinc-400">支持 JPG、PNG、MP4，图片最大 10 MB，视频最大 50 MB</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,video/mp4"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 mb-4 -mt-2 text-sm text-red-500">
          <X size={14} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* ====== File Gallery ====== */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-zinc-700 mb-3">文件库</h2>

        {filesLoading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-lg bg-zinc-200" />
                <div className="mt-1 h-3 bg-zinc-200 rounded w-3/4 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {filesError && (
          <p className="text-sm text-red-500 py-4">加载文件列表失败，请刷新页面重试。</p>
        )}

        {!filesLoading && !filesError && (!files || files.length === 0) && (
          <p className="text-sm text-zinc-400 py-8 text-center">还没有上传文件，请使用上方的上传区域添加文件。</p>
        )}

        {!filesLoading && !filesError && files && files.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {files.map((f) => (
              <button
                key={f.filename}
                type="button"
                className={`group relative rounded-lg overflow-hidden border-2 bg-zinc-100 cursor-pointer transition-shadow duration-150 ${
                  isCurrentWallpaper(f)
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                    : isSelected(f)
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-zinc-200 hover:border-zinc-400 hover:shadow-md'
                }`}
                onClick={() => handleSelectFile(f)}
              >
                <div className="aspect-square">
                  {f.type === 'image' ? (
                    <img
                      src={f.url}
                      alt={f.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={f.url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                    />
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-150 flex items-center justify-center">
                    {isSelected(f) && (
                      <span className="text-white text-xs bg-blue-500 px-2 py-0.5 rounded-full">
                        已选中
                      </span>
                    )}
                  </div>
                </div>
                {/* Delete file button */}
                <button
                  type="button"
                  className="absolute top-1 left-1 z-10 opacity-0 group-hover:opacity-100 min-w-7 min-h-7 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all duration-150 scale-75 group-hover:scale-100 cursor-pointer"
                  aria-label={`删除 ${f.filename}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedFile?.filename === f.filename) {
                      setSelectedFile(null);
                    }
                    deleteFileMutation.mutate(f.filename);
                  }}
                >
                  <Trash2 size={12} />
                </button>
                {/* Current badge */}
                {isCurrentWallpaper(f) && (
                  <span className="absolute top-1 right-1 text-[10px] leading-none bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                    当前
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ====== Preview ====== */}
      {previewTarget && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-zinc-600">预览</label>
            {selectedFile && (
              <button
                type="button"
                className="text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer flex items-center gap-1"
                onClick={handleClearSelection}
              >
                <X size={12} />
                取消选择
              </button>
            )}
          </div>
          <div className="border border-zinc-200 rounded-lg overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center">
            {previewTarget.type === 'image' ? (
              <img
                src={previewTarget.url}
                alt="壁纸预览"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <video
                src={previewTarget.url}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </div>
      )}

      {/* ====== Save ====== */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saveMutation.isPending || !canSave}
          className="inline-flex items-center gap-2 min-h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
          onClick={() => saveMutation.mutate()}
        >
          <Save size={16} />
          {saveMutation.isPending ? '保存中...' : '设为壁纸'}
        </button>

        {wallpaper && (
          <button
            type="button"
            disabled={resetMutation.isPending}
            className="inline-flex items-center gap-2 min-h-11 px-5 rounded-lg border border-zinc-300 text-zinc-700 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
            onClick={() => resetMutation.mutate()}
          >
            <RotateCcw size={16} />
            {resetMutation.isPending ? '重置中...' : '恢复默认壁纸'}
          </button>
        )}

        {saved && <span className="text-sm text-emerald-600">✔ 已保存</span>}

        {saveMutation.isError && (
          <span className="text-sm text-red-500">
            保存失败: {(saveMutation.error as Error).message}
          </span>
        )}
        {resetMutation.isError && (
          <span className="text-sm text-red-500">
            重置失败: {(resetMutation.error as Error).message}
          </span>
        )}
      </div>
    </div>
  );
}
