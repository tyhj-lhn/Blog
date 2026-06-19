import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { api } from '../../lib/api';
import type { Wallpaper } from '../../types';

export default function WallpaperAdmin() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'image' | 'video'>('image');
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useQuery<Wallpaper | null>({
    queryKey: ['admin-wallpaper'],
    queryFn: async () => {
      const data = await api.get<Wallpaper | null>('/admin/wallpaper');
      if (data) {
        setType(data.type as 'image' | 'video');
        setUrl(data.url);
      }
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: () => api.put('/admin/wallpaper', { type, url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallpaper'] });
      queryClient.invalidateQueries({ queryKey: ['wallpaper'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    mutation.mutate();
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-heading text-3xl text-zinc-900 mb-2">背景壁纸</h1>
      <p className="text-sm text-zinc-500 mb-6">设置博客首页 Hero 区的背景图片或视频。留空则使用默认视频。</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div>
          <label className="block text-sm text-zinc-600 mb-2">类型</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="image"
                checked={type === 'image'}
                onChange={() => setType('image')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-zinc-700">图片</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value="video"
                checked={type === 'video'}
                onChange={() => setType('video')}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-zinc-700">视频</span>
            </label>
          </div>
        </div>

        {/* URL input */}
        <div>
          <label htmlFor="wallpaper-url" className="block text-sm text-zinc-600 mb-1">
            {type === 'image' ? '图片 URL' : '视频 URL'}
          </label>
          <input
            id="wallpaper-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={type === 'image' ? 'https://example.com/bg.jpg' : 'https://example.com/bg.mp4'}
            maxLength={500}
            required
            className="w-full min-h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-150"
          />
        </div>

        {/* Preview */}
        {url && (
          <div>
            <label className="block text-sm text-zinc-600 mb-2">预览</label>
            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-zinc-900 aspect-video flex items-center justify-center">
              {type === 'image' ? (
                <img
                  src={url}
                  alt="壁纸预览"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <video
                  src={url}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={mutation.isPending || !url.trim()}
          className="inline-flex items-center gap-2 min-h-11 px-5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
        >
          <Save size={16} />
          {mutation.isPending ? '保存中...' : '保存壁纸'}
        </button>

        {saved && (
          <span className="ml-3 text-sm text-emerald-600">✔ 已保存</span>
        )}

        {mutation.isError && (
          <span className="ml-3 text-sm text-red-500">保存失败: {(mutation.error as Error).message}</span>
        )}
      </form>
    </div>
  );
}
