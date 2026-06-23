import { useState, useRef, useCallback } from 'react';
import { Upload, X, ImagePlus } from 'lucide-react';
import { api } from '../lib/api';
import CropDialog from './CropDialog';

interface CoverImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export default function CoverImageUpload({ value, onChange }: CoverImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropKey, setCropKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) return '仅支持 JPG 和 PNG 格式';
    if (file.size > 5 * 1024 * 1024) return '文件大小不能超过 5MB';
    return null;
  }

  const handleFileForCrop = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPendingFile(file);
    setCropKey((k) => k + 1);
    setShowCropDialog(true);
  }, []);

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      setShowCropDialog(false);
      setPendingFile(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', blob, 'cover.jpg');
        const result = await api.upload<{ url: string }>('/admin/upload', formData);
        onChange(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : '上传失败');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [onChange],
  );

  const handleCropCancel = useCallback(() => {
    setShowCropDialog(false);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileForCrop(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileForCrop(file);
    },
    [handleFileForCrop],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <>
      {value ? (
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            封面图片 <span className="text-zinc-400">(可选)</span>
          </label>
          <div className="relative group rounded-lg overflow-hidden border border-zinc-200">
            <img
              src={value}
              alt="封面预览"
              className="max-h-48 w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-zinc-950/0 group-hover:bg-zinc-950/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg bg-white/90 text-zinc-700 text-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <Upload size={14} />
                {uploading ? '上传中...' : '更换图片'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-lg bg-white/90 text-red-600 text-sm hover:bg-white transition-colors cursor-pointer"
              >
                <X size={14} />
                移除
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileSelect}
          />
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        </div>
      ) : (
        <div>
          <label className="block text-sm text-zinc-600 mb-1">
            封面图片 <span className="text-zinc-400">(可选，上传 JPG/PNG，最大 5MB)</span>
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 min-h-32 rounded-lg border-2 border-dashed transition-colors cursor-pointer
              ${dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100'
              }
              ${uploading ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm text-zinc-500">上传中...</span>
              </>
            ) : (
              <>
                <ImagePlus size={28} className="text-zinc-400" />
                <div className="text-center">
                  <p className="text-sm text-zinc-600">
                    {dragOver ? '释放以上传' : '拖拽或点击上传封面图片'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">支持 JPG、PNG 格式，最大 5MB</p>
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileSelect}
          />
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        </div>
      )}

      <CropDialog
        key={cropKey}
        open={showCropDialog}
        file={pendingFile}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    </>
  );
}
