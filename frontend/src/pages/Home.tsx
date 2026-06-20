import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Volume2, VolumeX } from 'lucide-react';
import { api } from '../lib/api';
import type { PaginatedResponse, PostSummary } from '../types';
import PostCard from '../components/PostCard';
import Pagination from '../components/Pagination';
import heroVideo from '../../images/Suvan_2k_02b29.mp4';

const PAGE_LIMIT = 6;

function scrollToPosts(ref: React.RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: 'smooth' });
}

export default function Home() {
  const [page, setPage] = useState(1);
  const postsRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);

  // Fetch wallpaper from API
  const { data: wallpaper } = useQuery<{ type: string; url: string } | null>({
    queryKey: ['wallpaper'],
    queryFn: () => api.get('/wallpaper'),
  });

  // Track wallpaper URL to detect changes (e.g. admin updates wallpaper)
  const wallpaperUrl = wallpaper?.url ?? heroVideo;
  const prevWallpaperUrl = useRef(wallpaperUrl);

  useEffect(() => {
    if (prevWallpaperUrl.current !== wallpaperUrl) {
      setMediaLoaded(false);
      prevWallpaperUrl.current = wallpaperUrl;
    }
  }, [wallpaperUrl]);

  const handleMediaLoaded = useCallback(() => setMediaLoaded(true), []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    if (!video.muted && video.paused) {
      video.play().catch(() => {});
    }
  }, []);

  const { data, isLoading, isError } = useQuery<PaginatedResponse<PostSummary>>({
    queryKey: ['posts', page],
    queryFn: () => api.get('/posts', { page, limit: PAGE_LIMIT }),
  });

  return (
    <div>
      {/* Hero — full-bleed video background, fills viewport */}
      <section className="relative flex flex-col min-h-screen text-center overflow-hidden -mt-14 bg-zinc-950">
        {/* Background video — use API wallpaper or default */}
        {wallpaper ? (
          wallpaper.type === 'video' ? (
            <video
              ref={videoRef}
              src={wallpaper.url}
              autoPlay
              loop
              muted
              playsInline
              onLoadedData={handleMediaLoaded}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <img
              src={wallpaper.url}
              alt=""
              onLoad={handleMediaLoaded}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )
        ) : (
          <video
            ref={videoRef}
            src={heroVideo}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={handleMediaLoaded}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* Dark overlay — fades in after media loads, preventing grey flash */}
        <div className={`absolute inset-0 bg-zinc-950/55 pointer-events-none transition-opacity duration-500 ${mediaLoaded ? 'opacity-100' : 'opacity-0'}`} />

        {/* Sound toggle */}
        <button
          type="button"
          onClick={toggleMute}
          className="absolute top-20 right-4 z-20 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-white/10 backdrop-blur text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer pointer-events-auto"
          aria-label={muted ? '开启声音' : '静音'}
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        {/* Centred text */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="font-heading text-5xl md:text-7xl text-white mb-4 drop-shadow-lg">
            MemoryStory
          </h1>
          <p className="text-zinc-300 text-lg md:text-xl drop-shadow">
            记录思考，分享生活
          </p>
        </div>

        {/* Scroll hint */}
        <button
          type="button"
          onClick={() => scrollToPosts(postsRef)}
          className="relative z-10 flex flex-col items-center gap-2 text-white/50 hover:text-white/80 transition-colors cursor-pointer pb-1.2 pointer-events-auto"
          aria-label="Scroll to posts"
        >
          <span className="text-sm tracking-wider uppercase drop-shadow">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </button>
      </section>

      {/* 6px shadow gradient — softens the transition from hero to posts */}
      <div className="h-[6px] bg-gradient-to-b from-zinc-950/40 to-zinc-200/60" />

      {/* Post grid — light surface, clear contrast with dark hero */}
      <section ref={postsRef} className="bg-white px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-3xl text-zinc-900 mb-6">最新文章</h2>
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-zinc-200 rounded-lg overflow-hidden animate-pulse"
                >
                  <div className="aspect-video bg-zinc-200" />
                  <div className="p-5">
                    <div className="h-7 bg-zinc-200 rounded w-3/4 mb-3" />
                    <div className="flex gap-4 mb-3">
                      <div className="h-4 bg-zinc-100 rounded w-20" />
                      <div className="h-4 bg-zinc-100 rounded w-12" />
                      <div className="h-4 bg-zinc-100 rounded w-12" />
                      <div className="h-4 bg-zinc-100 rounded w-12" />
                    </div>
                    <div className="h-4 bg-zinc-100 rounded w-full mb-2" />
                    <div className="h-4 bg-zinc-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {isError && (
            <p className="text-zinc-500 text-center py-12">加载失败，请稍后重试</p>
          )}
          {data && data.data.length === 0 && (
            <p className="text-zinc-400 text-center py-12">还没有文章</p>
          )}
          {data && data.data.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.data.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
              <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
