import { useState, useEffect, useRef, useCallback } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { getCroppedBlob, type CropArea } from '../lib/cropImage';

interface CropDialogProps {
  open: boolean;
  file: File | null;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function CropDialog({
  open,
  file,
  onConfirm,
  onCancel,
}: CropDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cancelRef = useRef<HTMLButtonElement>(null);

  // Load file as data URL when dialog opens
  useEffect(() => {
    if (!open || !file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.onerror = () => {
      setLoadError('图片读取失败，请重试');
    };
    reader.readAsDataURL(file);

    return () => {
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
      }
    };
  }, [open, file]);

  // Focus cancel button on open
  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  // Escape key + body scroll lock
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel]);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!imageUrl || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      // Modal stays open so user can retry
    } finally {
      setProcessing(false);
    }
  }, [imageUrl, croppedAreaPixels, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 motion-safe:animate-[fadeIn_150ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label="裁剪封面图片"
    >
      <div className="bg-white rounded-xl border border-zinc-200 shadow-lg max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col motion-safe:animate-[scaleIn_150ms_ease-out]">
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <h3 className="text-lg font-medium text-zinc-900">裁剪封面图片</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            实线框内为桌面端封面显示范围 — 拖拽移动图片，滚轮缩放
          </p>
        </div>

        {/* Crop area */}
        <div className="relative flex-1 min-h-64 mx-6 rounded-lg overflow-hidden bg-zinc-900">
          {loadError ? (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm">
              {loadError}
            </div>
          ) : imageUrl ? (
            <div className="absolute inset-0">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={3 / 1}
                cropShape="rect"
                showGrid={false}
                objectFit="cover"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                classes={{
                  containerClassName: 'absolute inset-0',
                  cropAreaClassName:
                    '!border-[3px] !border-blue-500 !shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]',
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Zoom control */}
        <div className="px-6 pt-3 pb-1">
          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="text-zinc-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 min-h-11 accent-zinc-700 cursor-pointer"
              aria-label="缩放"
            />
            <ZoomIn size={16} className="text-zinc-400 shrink-0" />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pt-2 pb-5 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="min-h-11 px-4 rounded-lg border border-zinc-200 text-zinc-600 text-sm hover:bg-zinc-100 disabled:opacity-50 transition-colors duration-150 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels || !!loadError}
            className="min-h-11 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
          >
            {processing ? '处理中...' : '确认裁剪'}
          </button>
        </div>
      </div>
    </div>
  );
}
