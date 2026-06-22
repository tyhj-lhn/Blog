import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, Volume2, VolumeX, Tag as TagIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { PaginatedResponse, PostSummary, Tag } from '../types';
import PostCard from '../components/PostCard';
import Pagination from '../components/Pagination';
import Footer from '../components/Footer';
import heroVideo from '../../images/Suvan_1080p.mp4';

const PAGE_LIMIT = 6;

function scrollToPosts(ref: React.RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: 'smooth' });
}

function tagColor(name: string): { bg: string; text: string; border: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 55%, 93%)`,
    text: `hsl(${hue}, 48%, 35%)`,
    border: `hsl(${hue}, 40%, 78%)`,
  };
}

const SKELETON_WIDTHS = [72, 88, 60, 96, 78, 84, 66, 92];

// Classical Chinese poetry pool
const POEMS = [
  '人生若只如初见，何事秋风悲画扇。',
  '落霞与孤鹜齐飞，秋水共长天一色。',
  '大漠孤烟直，长河落日圆。',
  '采菊东篱下，悠然见南山。',
  '海内存知己，天涯若比邻。',
  '山重水复疑无路，柳暗花明又一村。',
  '春风得意马蹄疾，一日看尽长安花。',
  '明月几时有？把酒问青天。',
  '欲穷千里目，更上一层楼。',
  '会当凌绝顶，一览众山小。',
  '但愿人长久，千里共婵娟。',
  '天生我材必有用，千金散尽还复来。',
  '长风破浪会有时，直挂云帆济沧海。',
  '停车坐爱枫林晚，霜叶红于二月花。',
  '醉后不知天在水，满船清梦压星河。',
];

const TYPING_SPEED = 100;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPED = 3000;
const PAUSE_AFTER_DELETED = 400;

export default function Home() {
  const [page, setPage] = useState(1);
  const postsRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);

  // ── Typewriter effect ──
  const [typedText, setTypedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const id = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);

  // Type → pause → delete → next loop
  useEffect(() => {
    let alive = true;
    let timeout: ReturnType<typeof setTimeout>;

    const pick = () => POEMS[Math.floor(Math.random() * POEMS.length)];

    let poem = pick();
    let i = 0;
    let deleting = false;

    const tick = () => {
      if (!alive) return;

      if (!deleting) {
        if (i < poem.length) {
          i++;
          setTypedText(poem.slice(0, i));
          timeout = setTimeout(tick, TYPING_SPEED);
        } else {
          timeout = setTimeout(() => {
            deleting = true;
            tick();
          }, PAUSE_AFTER_TYPED);
        }
      } else {
        if (i > 0) {
          i--;
          setTypedText(poem.slice(0, i));
          timeout = setTimeout(tick, DELETING_SPEED);
        } else {
          poem = pick();
          deleting = false;
          timeout = setTimeout(tick, PAUSE_AFTER_DELETED);
        }
      }
    };

    timeout = setTimeout(tick, 600);

    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, []);

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
      video.play().catch(() => {
        // Revert mute state if playback failed (e.g., autoplay policy)
        video.muted = true;
        setMuted(true);
      });
    }
  }, []);

  // Fetch tags for sidebar
  const { data: tags, isError: tagsError } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: () => api.get<{ data: Tag[] }>('/tags').then(r => r.data),
  });

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
        <div
          className={`absolute inset-0 bg-zinc-950/25 pointer-events-none transition-opacity duration-500 ${
            mediaLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Sound toggle — only when wallpaper is a video */}
        {(!wallpaper || wallpaper.type === 'video') && (
          <button
            type="button"
            onClick={toggleMute}
            className="absolute top-20 right-4 z-20 min-w-11 min-h-11 flex items-center justify-center rounded-full bg-white/10 backdrop-blur text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer pointer-events-auto"
            aria-label={muted ? '开启声音' : '静音'}
          >
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}

        {/* Centred text */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="font-heading text-5xl md:text-7xl text-white mb-4 drop-shadow-lg">
            MemoryStory
          </h1>
          <p className="text-zinc-300 text-lg md:text-xl drop-shadow min-h-[2em]">
            <span>{typedText}</span>
            <span
              className={`inline-block w-0.5 h-[1.1em] bg-zinc-100 align-text-bottom ml-0.5 transition-opacity duration-100 ${
                showCursor ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </p>
        </div>

        {/* Scroll hint */}
        <button
          type="button"
          onClick={() => scrollToPosts(postsRef)}
          className="relative z-10 flex flex-col items-center gap-2 text-white/50 hover:text-white/80 transition-colors cursor-pointer pb-8 pointer-events-auto"
          aria-label="Scroll to posts"
        >
          <span className="text-sm tracking-wider uppercase drop-shadow">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </button>
      </section>

      {/* 6px shadow gradient — softens the transition from hero to posts */}
      <div className="h-1.5 bg-linear-to-b from-zinc-950/25 to-zinc-200/60" />

      {/* Post grid — light surface, clear contrast with dark hero */}
      <section ref={postsRef} className="bg-white/90 backdrop-blur-xl px-4 py-12 md:py-16 border-t border-white/40 shadow-diffuse">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-3xl text-zinc-900 mb-6">最新文章</h2>

          <div className="flex justify-center gap-8 lg:gap-10">
            {/* Posts — centred */}
            <div className="max-w-4xl flex-1 min-w-0">
              {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="border border-zinc-200/70 rounded-2xl overflow-hidden animate-pulse"
                    >
                      <div className="aspect-video bg-zinc-200" />
                      <div className="p-6">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {data.data.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                  <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
                </>
              )}
            </div>

            {/* Right: tag sidebar (desktop only) */}
            <aside className="select-none cursor-default hidden lg:block w-48 shrink-0">
              <div className="sticky top-20">
                <h3 className="font-heading text-lg text-zinc-900 mb-4 flex items-center gap-2">
                  <TagIcon size={18} />
                  标签
                </h3>

                {tagsError && (
                  <p className="text-sm text-zinc-400">标签加载失败</p>
                )}

                {!tags && !tagsError && (
                  <div className="flex flex-wrap gap-2">
                    {SKELETON_WIDTHS.map((w, i) => (
                      <div
                        key={i}
                        className="h-8 rounded-full bg-zinc-100/70 animate-pulse"
                        style={{ width: `${w}px` }}
                      />
                    ))}
                  </div>
                )}

                {tags && tags.length === 0 && (
                  <p className="text-sm text-zinc-400">暂无标签</p>
                )}

                {tags && tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const c = tagColor(t.tag);
                      return (
                        <Link
                          key={t.tag}
                          to={`/search?q=${encodeURIComponent(t.tag)}`}
                          className="select-none inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-soft transition-all duration-200 cursor-pointer hover:shadow-card"
                          style={{
                            backgroundColor: c.bg,
                            borderColor: c.border,
                            color: c.text,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = c.bg.replace('93%', '88%');
                            e.currentTarget.style.borderColor = c.border.replace('40%', '50%');
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = c.bg;
                            e.currentTarget.style.borderColor = c.border;
                          }}
                        >
                          <span className="text-sm font-medium">{t.tag}</span>
                          <span className="text-xs" style={{ opacity: 0.55 }}>
                            {t.count}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
