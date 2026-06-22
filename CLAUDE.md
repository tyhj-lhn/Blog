# MemoryStory Blog

## Project Overview
Personal blog website with threaded comments (盖楼), Swiss Modernism design, hidden admin access.
- **Frontend**: React 19.2 + TypeScript 6.0 + Vite 8.0 + Tailwind CSS 4.3
- **Backend**: Fastify 5.3 + TypeScript 5.7 + Prisma 6.6 + PostgreSQL 17
- **Auth**: JWT dual-token (access 15min + refresh 7d), bcryptjs cost 12
- **Security**: No public login link; admin only via `/admin` URL path

## Commands
```bash
# Infrastructure
# PostgreSQL 17 via setup-server.sh (or run separately)

# Backend (cd backend/)
npx prisma migrate dev                                      # Apply migrations
npm run dev                                                 # Fastify on :3001 (tsx watch)
npm run build && npm start                                  # Production
npm run db:seed                                             # Seed sample data
npm run db:studio                                           # Prisma Studio GUI
npm run test                                                # vitest

# Frontend (cd frontend/)
npm run dev                                                 # Vite on :5173
npm run build                                               # tsc + vite build → dist/
npm run lint                                                # ESLint

# Deployment — 阿里云服务器 (as root)
bash setup-server.sh                                        # Step 1: 一次性环境安装（Node.js, PG, Nginx, PM2, ufw）
bash deploy-app.sh                                          # Step 2: 网站部署（克隆→构建→启动，可重复运行更新）
bash deploy-app.sh --dry-run                                # 干运行（仅检查前置条件）
bash deploy-app.sh --yes --git-repo ... --db-password ...   # 非交互式 (CI/CD)
# 详见 ALIYUN.md 阿里云部署指南
```

## Architecture
```
my_Blog/
├── .env.example                    # Template for .env
├── boot.cjs                        # CJS boot wrapper — PM2 fork + ESM 兼容桥梁
├── ecosystem.config.cjs            # PM2 config (local dev reference)
├── setup-server.sh                 # 服务器环境部署脚本 (6步，一次性)
├── deploy-app.sh                   # 网站部署脚本 (8步，可重复运行更新)
├── ALIYUN.md                       # 阿里云部署指南
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma           # 5 models: User, Post, Comment, Guestbook, Wallpaper
│   │   ├── seed.ts                 # Admin user + 2 posts + 3 comments + 2 guestbook entries
│   │   └── migrations/
│   └── src/
│       ├── index.ts                # buildApp() factory + server startup
│       ├── lib/
│       │   ├── errors.ts           # AppError class + factory functions
│       │   ├── prisma.ts           # PrismaClient singleton
│       │   ├── slugify.ts          # Title → URL-safe slug
│       │   ├── jwt.ts              # Token generation/verification + validateSecrets
│       │   ├── sanitize.ts         # XSS filter — strips all HTML from user input
│       │   ├── login-guard.ts      # Progressive account lockout (5→15min, 10→1h)
│       │   └── comments.ts         # buildCommentTree() — O(n) two-pass
│       ├── schemas/                # Fastify JSON Schema validation
│       │   ├── common.schema.ts    # Pagination + search query
│       │   ├── auth.schema.ts      # Login + refresh
│       │   ├── post.schema.ts      # Create/update post
│       │   ├── comment.schema.ts   # Create comment
│       │   ├── guestbook.schema.ts # Create guestbook entry
│       │   ├── wallpaper.schema.ts # Wallpaper type + url validation
│       │   └── about.schema.ts     # About page content validation
│       ├── middleware/
│       │   ├── auth.ts             # authGuard (JWT verify) + adminGuard
│       │   └── rate-limit.ts       # Presets: global 100/min, auth 5/min, guestbook 3/min
│       └── routes/
│           ├── auth.routes.ts      # POST login/refresh, GET/PUT me, PUT me/password
│           ├── posts.routes.ts     # GET list/slug/search, POST/PUT/DELETE admin
│           ├── comments.routes.ts  # GET threaded by postId, POST create, GET admin list, DELETE admin
│           ├── tags.routes.ts      # GET all tags with counts ← unnest(tags)
│           ├── guestbook.routes.ts # GET list, POST create, DELETE admin
│           ├── wallpaper.routes.ts # GET public wallpaper, GET/PUT/DELETE admin wallpaper
│           ├── about.routes.ts     # GET public about, PUT admin upsert about
│           ├── upload.routes.ts    # POST /api/admin/upload — JWT-guarded image upload
│           └── admin.routes.ts     # GET stats (counts + recent posts/comments)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts              # React + Tailwind plugins, /api → :3001 proxy
│   ├── tsconfig.app.json           # Strict TS with verbatimModuleSyntax
│   ├── index.html                  # Google Fonts preloaded in CSS
│   ├── images/
│   │   └── Suvan_2k_02b29.mp4      # Hero background video
│   └── src/
│       ├── main.tsx                # StrictMode + createRoot
│       ├── App.tsx                  # Router + QueryClient + AuthProvider
│       ├── index.css               # Google Fonts (Caveat+Quicksand) + Tailwind v4 @theme
│       ├── lib/
│       │   ├── api.ts              # Fetch wrapper: JWT inject, 401 refresh queue, api.get/post/put/del/upload
│       │   └── auth.ts             # localStorage token CRUD
│       ├── types/
│       │   └── index.ts            # All shared TS interfaces (Post, Comment, Wallpaper, etc.)
│       ├── hooks/
│       │   ├── useAuth.tsx         # AuthProvider (login/logout + user rehydration)
│       │   ├── useAuth.ts          # AuthContext + useAuth() hook
│       │   ├── useLike.ts          # Like toggle hook (localStorage + optimistic + rollback)
│       │   ├── useAutoSave.ts      # localStorage draft auto-save + beforeunload guard
│       │   └── useDebounce.ts      # Debounce hook
│       ├── components/
│       │   ├── Layout.tsx          # Navbar (无登录链接) + Outlet (public blog layout)
│       │   ├── AdminLayout.tsx     # 深色侧边栏 + 内容区管理后台布局
│       │   ├── ConfirmDialog.tsx   # 可复用删除确认模态框
│       │   ├── TagInput.tsx        # 芯片化标签输入组件
│       │   ├── CoverImageUpload.tsx # 拖拽图片上传组件 (替换URL输入)
│       │   ├── MarkdownToolbar.tsx # 12按钮Markdown格式工具栏
│       │   ├── PostPreview.tsx     # 发布预览 (模拟PostDetail外观)
│       │   ├── Footer.tsx          # 首页页脚 — 版权 + 免责声明 + ICP备案
│       │   └── ...                 # PostCard, CommentTree, CommentForm, etc.
│       └── pages/
│           ├── Home.tsx            # Hero (video + API wallpaper) + post grid
│           ├── PostDetail.tsx      # Article content + threaded comments
│           ├── TagsPage.tsx        # Tag cloud
│           ├── Guestbook.tsx       # Guestbook messages + submit form
│           ├── About.tsx           # Static about page
│           ├── SearchPage.tsx      # Debounced full-text search
│           └── admin/
│               ├── AdminLogin.tsx        # Centred login (independent layout)
│               ├── AdminDashboard.tsx    # Stats + quick actions + management links
│               ├── PostEditor.tsx        # Markdown split-pane editor + auto-save
│               ├── PostManagement.tsx    # Browse/search all posts, inline delete
│               ├── CommentManagement.tsx # Comment list, search, pagination, delete
│               ├── GuestbookManagement.tsx # Guestbook list, pagination, delete
│               ├── WallpaperAdmin.tsx    # Wallpaper type/URL + live preview
│               ├── AboutEditor.tsx       # CMS editor for About page content
│               └── AdminProfile.tsx      # Avatar, username, password management
```

## Key Design Decisions

### Hidden Admin Access
- Navbar has NO login button — only 首页 / 标签 / 留言板 / 搜索 / 关于我 (all with Lucide React SVG icons)
- Admin accessed only by typing `/admin` URL directly
- Route guard: `/admin/*` → redirect to `/admin/login` if unauthenticated
- `/admin/login` is the only login form — no public link to it exists

### Threaded Comments (盖楼)
- PostgreSQL recursive CTE via `$queryRawUnsafe` with `parent_id` self-reference
- Comment model self-relation: `parent` ↔ `children` (relation name: `CommentReplies`)
- Backend: `buildCommentTree()` — two-pass O(n): first pass builds Map<id, node>, second pass distributes into roots or parent.children
- Frontend: recursive React component with colored left borders per nesting level (planned, not yet implemented)
- Query pattern: `WITH RECURSIVE comment_tree AS (...) ORDER BY depth, created_at`
- All commenters are guests: username required, email optional, websiteUrl optional

### No Public User System
- Only admin users exist (Role = ADMIN)
- No public registration, no public login, no userId on Comment
- Comments are pure guest: username (必填), email (可选), websiteUrl (可选)

### View Count Tracking
- `GET /api/posts/:slug` fires `prisma.post.update({ where: { slug }, data: { viewCount: { increment: 1 } } })` WITHOUT awaiting — fire-and-forget for performance

### Backend Patterns

#### buildApp() Factory
- Separates app construction from server startup for testability (`app.inject()`)
- Only starts listening when `process.argv[1]` ends with `index.ts`/`index.js`
- `onClose` hook disconnects Prisma

#### Error Handling
- `AppError` class: statusCode + code + message
- Fastify `setErrorHandler`: AppError → structured JSON, validation errors → 400 with details, unknown → 500 generic
- Factory functions: `notFound()`, `unauthorized()`, `forbidden()`, `validationError()`, `conflict()`

#### Input Validation
- All routes use Fastify JSON Schema (not Zod) via `schema: { body, params, querystring }` options
- Common schemas: pagination (page/limit, integers, min 1/max 100), search (q, minLength 1, maxLength 200)

#### Content Sanitization (XSS Prevention)
- `sanitizeContent()` in `lib/sanitize.ts` — centralized XSS filter using `xss` library
- Empty whitelist model: strips ALL HTML tags, attributes, event handlers, and comments
- Applied to all public user input before DB insert: `comment.content`, `comment.username`, `guestbook.nickname`, `guestbook.message`
- Also trims whitespace, handles Unicode homoglyph attacks

#### Progressive Login Lockout
- `lib/login-guard.ts` — in-memory Map tracking failed attempts per email
- Tier 1: 5 failures → 15 minute lockout / Tier 2: 10 failures → 1 hour lockout
- 30-minute idle window resets counter (prevents punishing legitimate users)
- `checkLockout()` called BEFORE DB query to prevent timing side-channel enumeration
- `recordFailedAttempt()` called on both "user not found" and "wrong password" (uniform behavior)

#### Token Revocation
- `tokenVersion` field on User model, embedded in both access and refresh JWT payloads
- Refresh endpoint verifies `decoded.tokenVersion === user.tokenVersion`
- Incrementing `tokenVersion` in DB instantly invalidates all existing tokens for that user
- `validateSecrets()` at startup: throws in production if JWT secrets not set, warns in dev

### Frontend Patterns

#### 401 Refresh Queue
- `api.ts` serializes concurrent 401 responses through a single `refreshPromise`
- Multiple simultaneous 401s → only one refresh call, all wait for the same promise
- On refresh failure: clears tokens (user must re-login)
- On success: retries original request with new access token

#### Token Storage
- localStorage keys: `memorystory_access_token`, `memorystory_refresh_token`
- Access token injected as `Bearer` header on every request
- Refresh token sent in POST body to `/api/auth/refresh`

#### Route Structure
| Path | Component | Auth |
|------|-----------|------|
| `/` | Home | Public |
| `/post/:slug` | PostDetail (via PostDetailRoute, key={slug}) | Public |
| `/tags` | TagsPage | Public |
| `/guestbook` | Guestbook | Public |
| `/about` | About | Public |
| `/search` | SearchPage | Public |
| `/admin/login` | AdminLogin | Public (login form) |
| `/admin` | → redirect /admin/dashboard | Auth required |
| `/admin/dashboard` | AdminDashboard | Auth required |
| `/admin/posts` | PostManagement | Auth required |
| `/admin/posts/new` | PostEditor | Auth required |
| `/admin/posts/:id/edit` | PostEditor | Auth required |
| `/admin/comments` | CommentManagement | Auth required |
| `/admin/guestbook` | GuestbookManagement | Auth required |
| `/admin/wallpaper` | WallpaperAdmin | Auth required |
| `/admin/about` | AboutEditor | Auth required |
| `/admin/profile` | AdminProfile | Auth required |
| `*` | → redirect / | — |

## Design System — Swiss Modernism 2.0

### Colors (zinc palette)
| Role | Hex | Tailwind |
|------|-----|----------|
| Primary | #18181B | `zinc-900` |
| Secondary | #3F3F46 | `zinc-700` |
| Accent | #2563EB | `blue-600` |
| Background | #FAFAFA | `zinc-50` |
| Text | #09090B | `zinc-950` |
| Muted | #71717A | `zinc-500` |
| Border | #E4E4E7 | `zinc-200` |

### Typography
- **Headings**: Noto Serif SC (Google Fonts, 400–900) — editorial serif, excellent Chinese support
- **Body**: Quicksand (Google Fonts, 300–700) — clean, warm, readable

### UX Rules (CRITICAL)
- Touch targets ≥ 44px
- No emoji as icons — Lucide React SVG exclusively
- `cursor-pointer` on all interactive elements
- Transitions 150–300ms, `prefers-reduced-motion` respected
- Visible focus rings for keyboard navigation
- Line-height 1.5–1.75 for body, max 65–75 chars per line

## Data Model (Prisma)

### User
| Field | Type | Notes |
|-------|------|-------|
| id | Int (auto) | PK |
| username | String @unique (50) | |
| email | String @unique (255) | |
| passwordHash | String | bcryptjs cost 12 |
| role | Role | ADMIN only |
| tokenVersion | Int (default 0) | For refresh token revocation |
| avatar | String? (500) | Admin avatar URL |

### Post
| Field | Type | Notes |
|-------|------|-------|
| id | Int (auto) | PK |
| title | String (200) | |
| slug | String @unique (200) | Auto-generated, unique |
| content | Text | Markdown |
| excerpt | String? (500) | |
| coverImage | String? | URL |
| status | PostStatus | DRAFT / PUBLISHED |
| tags | String[] | PostgreSQL native array |
| viewCount | Int (default 0) | Fire-and-forget increment |
| likeCount | Int (default 0) | Optimistic UI + localStorage dedup |
| authorId | Int | FK → User |
| createdAt | DateTime | auto |
| updatedAt | DateTime | @updatedAt |

### Comment
| Field | Type | Notes |
|-------|------|-------|
| id | Int (auto) | PK |
| content | Text | |
| postId | Int | FK → Post (Cascade) |
| username | String (50) | **Required** for guest commenting |
| email | String? (255) | Optional |
| websiteUrl | String? (500) | Optional |
| parentId | Int? | Self-ref FK → Comment (Cascade) |
| createdAt | DateTime | auto |
| updatedAt | DateTime | @updatedAt |

### Guestbook
| Field | Type | Notes |
|-------|------|-------|
| id | Int (auto) | PK |
| nickname | String (100) | |
| message | Text | |
| createdAt | DateTime | auto |

### Wallpaper
| Field | Type | Notes |
|-------|------|-------|
| id | Int (auto) | PK |
| type | String (10) | `"image"` or `"video"` |
| url | String (500) | Image/Video URL |
| updatedAt | DateTime | @updatedAt |

### About
| Field | Type | Notes |
|-------|------|-------|
| id | Int (auto) | PK |
| greetingTitle | String (100) | Welcome heading |
| greetingContent | Text (2000) | Welcome body |
| aboutTitle | String (100) | About heading |
| aboutContent | Text (5000) | About body |
| email | String? (255) | Contact email |
| github | String? (255) | GitHub URL |
| location | String? (100) | Location text |
| updatedAt | DateTime | @updatedAt |

**Pattern:** Single-row table (upsert id=1) — always read/write the first row.

## API Routes

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/posts` | Published posts list. Query: `?page=&limit=&tag=` (tag uses `has:` filter) |
| GET | `/api/posts/:slug` | Single post + fire-and-forget viewCount increment |
| GET | `/api/comments/:postId` | Threaded comment tree (recursive CTE) |
| GET | `/api/tags` | All tags with post counts |
| GET | `/api/guestbook` | Guestbook messages (paginated, newest first) |
| GET | `/api/search?q=` | Full-text search posts by title/content (max 20 results) |
| GET | `/api/wallpaper` | Current wallpaper (type + url, for homepage hero) |
| GET | `/api/about` | About page content (single record) |
| POST | `/api/comments` | Create comment. Body: `{content, postId, username, email?, websiteUrl?, parentId?}` |
| POST | `/api/guestbook` | Create guestbook entry. Body: `{nickname, message}` |
| POST | `/api/posts/:slug/toggle-like` | Toggle post like/unlike. Body: `{liked: boolean}` → `{likeCount}`. Atomic via `$transaction` |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → `{accessToken, refreshToken, user}` |
| POST | `/api/auth/refresh` | Refresh → new token pair |
| GET | `/api/auth/me` | Current user info (token rehydration after page refresh) |
| PUT | `/api/auth/me` | Update profile (username, avatar) |
| PUT | `/api/auth/me/password` | Change password (verifies current, bumps tokenVersion) |

### Protected (JWT required — authGuard middleware)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/upload` | Upload image (JPG/PNG ≤5MB). Returns `{url}` |
| GET | `/api/admin/posts` | Paginated post list (all statuses). Query: `?page=&limit=&search=&status=` |
| POST | `/api/admin/posts` | Create post |
| PUT | `/api/admin/posts/:id` | Update post (regenerates slug if title changes) |
| DELETE | `/api/admin/posts/:id` | Delete post (204) |
| DELETE | `/api/admin/comments/:id` | Delete comment + cascade children (204) |
| DELETE | `/api/admin/guestbook/:id` | Delete guestbook entry (204) |
| GET | `/api/admin/stats` | Dashboard: counts + recent posts + recent comments |
| GET | `/api/admin/comments` | All comments (paginated, searchable by username/content) |
| GET | `/api/admin/wallpaper` | Current wallpaper record |
| PUT | `/api/admin/wallpaper` | Upsert wallpaper (type + url) |
| GET | `/api/admin/about` | (covered by public route) |
| PUT | `/api/admin/about` | Upsert about page content. Body: `{greetingTitle, greetingContent, aboutTitle, aboutContent, email?, github?, location?}` |

## Implementation Status

### ✅ Phase 1: Scaffolding (Complete)
- PostgreSQL 17 running (via setup-server.sh)
- Backend: Fastify + Prisma + TypeScript + all npm scripts
- Frontend: Vite + React + Tailwind v4 + all dependencies + ESLint
- `.env.example` and project configs

### ✅ Phase 2: Backend Core (Complete)
- Prisma schema + migration + seed data
- JWT dual-token auth with bcryptjs
- All 6 route modules (13 endpoints total)
- JSON Schema validation on all inputs
- Rate limiting (global / auth / guestbook / comment presets)
- Threaded comment tree builder
- Fire-and-forget viewCount increment

### ✅ Phase 2.5: Security Hardening (Complete — 2026-06-19)
- **XSS Protection:** `sanitize.ts` — all comment/guestbook user input stripped of HTML before DB insert via `xss` library
- **DoS Prevention:** `bodyLimit: 512KB` in Fastify; `maxLength` constraints on `comment.content` (10K) and `password` (128)
- **Admin Auth Fix:** `adminGuard` added to `DELETE /api/admin/comments/:id` (was missing — any auth'd user could delete)
- **Brute-Force Protection:** `login-guard.ts` — progressive lockout after 5 (15min) / 10 (1h) failed attempts
- **Token Revocation:** `tokenVersion` field in User model, included in JWT payload, verified on refresh
- **Production Safety:** `validateSecrets()` throws at startup in production if JWT secrets are not set
- **Email Normalization:** login email `toLowerCase().trim()` before DB lookup

### ✅ Phase 3: Frontend Core (Complete — 2026-06-19)
- [x] Scaffold: Vite + React + Tailwind + Router + TanStack Query + types
- [x] API integration layer: api.ts (fetch + 401 queue), auth.ts (token storage)
- [x] Auth context: useAuth.tsx (login/logout/user state)
- [x] Layout + Navbar (no login link, all public nav items)
- [x] All route/page stubs registered in App.tsx
- [x] Home page — hero + post grid 2-col + skeleton loading + pagination
- [x] PostDetail page — content + comment tree (recursive, colored borders) + comment form
- [x] TagsPage — tag cloud, links to /search?q=
- [x] Guestbook — message list (paginated) + submit form
- [x] About page — CMS-driven, fetched from API with fallback defaults
- [x] SearchPage — debounced search + PostCard results
- [x] AdminLogin — login form → useAuth().login() → redirect
- [x] AdminDashboard — 5 stats cards + recent posts/comments + logout
- [x] PostEditor — create/edit, Markdown textarea, draft/publish toggle
- [x] 7 shared components: PostCard, CommentTree, CommentForm, SearchBar, Pagination, ProtectedRoute, ScrollToTop
- [x] Backend: `GET /api/admin/posts/:id` added for PostEditor edit mode

### ✅ Phase 3.2: Hero Redesign & Nav Scroll UX (2026-06-19)

**Hero — full-viewport video background with ambient audio:**
| Feature | Implementation |
|---------|---------------|
| Video background | `<video>` fills hero via `absolute inset-0 object-cover`, imported from `frontend/images/Suvan_2k_02b29.mp4` as ES module |
| Seamless loop | `autoPlay loop muted playsInline` — native HTML5 video attributes |
| Background audio | Click speaker button to unmute → `video.muted = false` + `video.play()` fallback for paused state |
| Readability | `bg-zinc-950/55` dark overlay between video and text |
| Event layering | `pointer-events-none` on video + overlay, `pointer-events-auto` on interactive buttons — prevents click interception |
| Sound toggle | Top-right `z-20` button: `VolumeX` (muted) ↔ `Volume2` (unmuted), `bg-white/10 backdrop-blur` glass pill |
| Text centering | `flex-1 flex items-center justify-center` — title + subtitle always vertically centred |
| Scroll hint | `pb-8 pointer-events-auto` near bottom, click → `scrollIntoView({ behavior: 'smooth' })` to post grid |
| Cross-browser | Standard CSS flex + object-cover — Chrome, Edge, Firefox, Safari all supported |

**Navbar — sticky with scroll-aware show/hide:**
| Feature | Implementation |
|---------|---------------|
| Sticky positioning | `sticky top-0 z-50` with `bg-zinc-50/95 backdrop-blur` glass effect |
| Hide on scroll down | When `scrollY > 80px` and direction is down → `-translate-y-full` |
| Show on scroll up | Any upward scroll → `translate-y-0` |
| Always show at top | `scrollY <= 0` → force visible |
| Smooth animation | `transition-transform duration-300` |
| Performance | `requestAnimationFrame` throttle + `passive: true` scroll listener |

**Layout container refactoring:**
| File | Change | Reason |
|------|--------|--------|
| [Layout.tsx](frontend/src/components/Layout.tsx) | `main` → no padding/width constraints | Let `Home.tsx` hero bleed full-bleed |
| [Home.tsx](frontend/src/pages/Home.tsx) | Posts section → `bg-white` + internal `max-w-4xl mx-auto` | Full-width white band contrasting with dark hero |
| [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) | Outermost `<div>` → `max-w-4xl mx-auto px-4 py-8` | Self-contained width constraint |
| [TagsPage.tsx](frontend/src/pages/TagsPage.tsx) | Same container added | — |
| [Guestbook.tsx](frontend/src/pages/Guestbook.tsx) | Same container added | — |
| [About.tsx](frontend/src/pages/About.tsx) | Same container added | — |
| [SearchPage.tsx](frontend/src/pages/SearchPage.tsx) | Same container added | — |
| [AdminLogin.tsx](frontend/src/pages/admin/AdminLogin.tsx) | Same container added (px-4 added) | — |
| [AdminDashboard.tsx](frontend/src/pages/admin/AdminDashboard.tsx) | Same container added | — |
| [PostEditor.tsx](frontend/src/pages/admin/PostEditor.tsx) | Same container added | — |

### ✅ Phase 3.1: Frontend Code Quality Cleanup (2026-06-19)

**Tailwind canonical classes:**
| File | Changes |
|------|---------|
| [CommentForm.tsx](frontend/src/components/CommentForm.tsx) | 5× `min-h-[44px]` → `min-h-11` |
| [SearchBar.tsx](frontend/src/components/SearchBar.tsx) | `min-h-[44px]`→`min-h-11`, `min-w-[28px] min-h-[28px]`→`min-w-7 min-h-7` |
| [About.tsx](frontend/src/pages/About.tsx) | `min-h-[44px]` → `min-h-11` |
| [Guestbook.tsx](frontend/src/pages/Guestbook.tsx) | 3× `min-h-[44px]` → `min-h-11` |
| [TagsPage.tsx](frontend/src/pages/TagsPage.tsx) | `min-h-[44px]` → `min-h-11` |

**ESLint error fixes:**
| File | Error | Fix |
|------|-------|-----|
| [SearchBar.tsx](frontend/src/components/SearchBar.tsx) | `react-refresh/only-export-components` | useDebounce → [hooks/useDebounce.ts](frontend/src/hooks/useDebounce.ts) |
| [useAuth.tsx](frontend/src/hooks/useAuth.tsx) | `react-refresh/only-export-components` | 拆分: [useAuth.ts](frontend/src/hooks/useAuth.ts) (context+hook) + [useAuth.tsx](frontend/src/hooks/useAuth.tsx) (component only) |
| [PostEditor.tsx](frontend/src/pages/admin/PostEditor.tsx) | `react-hooks/set-state-in-effect` | React Query 同步是合理模式，添加 eslint-disable 包裹 |

**验证:** tsc ✓ · ESLint 0 ✓ · vite build ✓ (309.9KB JS, 20.7KB CSS)

### ✅ Phase 4: Admin Overhaul (Complete — 2026-06-19)

**Backend API Expansion:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallpaper` | GET | Public — current wallpaper (type + url) for homepage hero |
| `/api/admin/wallpaper` | GET/PUT | Admin — read/upsert wallpaper |
| `/api/admin/guestbook/:id` | DELETE | Admin — delete guestbook entry |
| `/api/admin/comments` | GET | Admin — paginated comment list with search |
| `/api/auth/me` | GET | Current user info (rehydrate after page refresh) |
| `prisma/schema.prisma` | — | New `Wallpaper` model (id, type, url, updatedAt) |

**Frontend Layout & Auth:**
| Feature | Implementation |
|---------|---------------|
| Independent admin layout | `AdminLayout.tsx` — dark sidebar (w-64, bg-zinc-900) + content area, no public nav |
| Login page isolation | AdminLogin now fullscreen centred (`min-h-screen flex items-center justify-center`), independent of Layout |
| Route split | `App.tsx` — three layout wrappers: `<Layout>` (public), `<AdminLayout>` (admin), no wrapper (login) |
| Redirect-back after login | ProtectedRoute preserves `?returnUrl=`; AdminLogin reads it for post-login navigation |
| User state rehydration | `useAuth.tsx` calls `GET /api/auth/me` on mount when token exists; `loading` state prevents login flash |
| Logout moved to sidebar | Sidebar bottom section: user avatar + email + red logout button |

**Dashboard Enhancement:**
| Feature | Implementation |
|---------|---------------|
| Quick delete posts/comments | Inline trash buttons on each row; `ConfirmDialog` modal before action |
| Management shortcut cards | 3 cards linking to comment management, guestbook management, wallpaper management |
| Colored stat icons | Each stat card has a colored icon bg (blue/emerald/amber/violet/rose) |
| "View all posts" link | Links to `/admin/posts` route |

**Post Editor Upgrade:**
| Feature | Implementation |
|---------|---------------|
| Markdown split-pane preview | Left: metadata + textarea, Right: `ReactMarkdown` + `remark-gfm` with `prose prose-zinc` |
| Cover image URL input | URL field + live `<img>` preview with error fallback |
| Delete post button | Edit mode only — red button in header, `ConfirmDialog` protection |
| Draft auto-save | `useAutoSave.ts` — debounced 2s `localStorage` save + `beforeunload` guard |
| Draft restore banner | Amber banner on new post if saved draft exists: [恢复草稿] [丢弃] |
| Tag chip input | `TagInput.tsx` — blue chip badges, Enter/comma to add, × to remove, Backspace deletes last |
| Removed dual status control | Only `<select>` dropdown remains (toggle button removed) |
| Character count | Real-time `{content.length} 字` counter above textarea |

**New Admin Pages:**
| Page | Route | Features |
|------|-------|----------|
| `CommentManagement.tsx` | `/admin/comments` | Search by username/content, paginated list, inline delete |
| `GuestbookManagement.tsx` | `/admin/guestbook` | Paginated list, inline delete |
| `WallpaperAdmin.tsx` | `/admin/wallpaper` | Radio type (image/video), URL input, live preview, save |

**New Shared Components:**
| Component | Purpose |
|-----------|---------|
| `ConfirmDialog.tsx` | Modal with danger/default variant, Escape-to-close, loading state |
| `TagInput.tsx` | Chip-based tag editor (enter/comma add, × remove, backspace delete) |
| `useAutoSave.ts` | localStorage draft persistence + restore banner + beforeunload |

**Homepage Wallpaper Integration:**
- `Home.tsx` fetches `GET /api/wallpaper` via TanStack Query
- Renders `<video>` or `<img>` from API URL, falls back to hardcoded `heroVideo` if null

**验证:** tsc ✓ · ESLint 0 ✓ · vite build ✓ (493.4KB JS, 32.0KB CSS, bundle increased due to react-markdown)

### ✅ Phase 4.1: 博文卡片样式升级 & 点赞系统 (2026-06-19)

**数据库变更:**
| 变更 | 详情 |
|------|------|
| Post 新增 `likeCount` | `Int @default(0)` — 迁移 `20260619091757_add_like_count` |

**后端新增:**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/posts/:slug/like` | POST | 原子递增 `likeCount`，返回 `{likeCount}` |
| `summarySelect` | — | 所有文章列表查询现包含 `likeCount` |

**PostCard 全新卡片样式:**

| 区域 | 实现 |
|------|------|
| 🖼️ 封面图 | 16:9 (`aspect-video`)，hover 缩放 `scale-105`，无图时 `ImageIcon` + 渐变占位 |
| 📝 标题 | Caveat 手写体，hover 变蓝 |
| 📅 日期 | `Calendar` 图标 + 中文格式 |
| 👁️ 浏览量 | `Eye` 图标 + 数字 |
| 💬 评论数 | `MessageCircle` 图标 + 数字 |
| ❤️ 点赞 | `Heart` 图标 + 数字，可点击 — 乐观更新 + localStorage 去重 + 失败回滚 |
| 🏷️ 标签 | 圆角芯片（tags 在上移，摘要在下移） |
| 📄 摘要 | `line-clamp-2` 两行截断 |
| 🔘 交互 | 整卡 `overflow-hidden rounded-lg`，hover 阴影 + 蓝色边框 |

**PostDetail 页头增强:**
| 新增 | 实现 |
|------|------|
| 评论数 | `MessageCircle` + `post._count.comments 评论` |
| 点赞按钮 | 同款 `Heart`，点击后 `invalidateQueries` 重新获取服务端权威计数 |

**Home 骨架屏更新:**
- 骨架卡片匹配新布局：封面占位 + 标题行 + 4 列元数据行 + 摘要行

**点赞去重机制:**
- 前端 `localStorage` key `memorystory_liked_posts` 存储已点赞 post ID 集合
- PostCard 组件级 `useState` 初始化时读取 localStorage
- PostDetail 从 post 数据 + localStorage 计算 `liked` 状态（渲染中计算，无 effect）
- 点赞请求失败时回滚 localStorage

**文件变更:**
| 文件 | 变更 |
|------|------|
| [schema.prisma](backend/prisma/schema.prisma) | Post 模型新增 `likeCount` |
| [posts.routes.ts](backend/src/routes/posts.routes.ts) | `summarySelect` +`likeCount`，新增 `POST /:slug/like` |
| [types/index.ts](frontend/src/types/index.ts) | `PostSummary` +`likeCount` |
| [PostCard.tsx](frontend/src/components/PostCard.tsx) | 全面重写 — 封面图 + 4 图标元数据行 + 点赞交互 |
| [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) | 页头 + 评论数 + 点赞按钮 |
| [Home.tsx](frontend/src/pages/Home.tsx) | 骨架屏匹配新卡片布局 |

**验证:** tsc ✓ · ESLint 0 ✓ · vite build ✓ (496KB JS, 35KB CSS)

### ✅ Phase 4.2: 博文详情页白屏修复 (2026-06-19)

**Bug:** 点击博文卡片后，博文内容闪一下然后整个页面变成纯白。

**根本原因:** 评论 API 形状不匹配 — `GET /api/comments/:postId` 返回 `{ data: Comment[], total: number }`，但前端 `useQuery<Comment[]>` 将响应直接视为数组。`CommentTree` 渲染时调用 `comments.map()` 失败（对象无 `.map` 方法），抛出 TypeError → React 组件树崩溃 → 白屏。

**崩溃链:**
1. Post 查询成功 → 博文内容先渲染（"一闪"）
2. 评论查询完成 → `comments` 实际是 `{ data: [...], total: 7 }`
3. `CommentTree` 中 `comments.map()` → **TypeError: comments.map is not a function**
4. 未捕获渲染异常 → React 卸载整个组件树 → 纯白

**修复:**
| 文件 | 改动 | 说明 |
|------|------|------|
| [PostDetail.tsx:74-75](frontend/src/pages/PostDetail.tsx#L74-L75) | `queryFn` 解包 `.data` | `.then((r) => r.data)` — 根因修复 |
| [ErrorBoundary.tsx](frontend/src/components/ErrorBoundary.tsx) | 新建 | Class component `getDerivedStateFromError`，捕获渲染异常显示降级 UI |
| [App.tsx:5](frontend/src/App.tsx#L5) | 导入 ErrorBoundary，包裹 `<AppRoutes />` | 防御性：未来任何组件级渲染 crash 不会白屏 |
| [index.html:9](frontend/index.html#L9) | `<body class="bg-zinc-50">` | 防御性：SPA 冷加载时不闪白 |

**为什么之前排查困难:**
- 博文内容能短暂显示，说明 Post API + PostDetail 渲染正常 → 排除了 ReactMarkdown（当时的怀疑对象，实际上 PostDetail 根本没在用）
- Post API 返回裸对象（非 `{ data }` 包装），前端类型正确 → 让人觉得"API 形状没问题"
- 唯独 `GET /api/comments/:postId` 用了 `{ data, total }` 包装（与其他 list 端点一致），但单条评论查询没有 "单个 vs 列表" 的区分感 → 遗漏

**验证:** tsc ✓ · ESLint 0 ✓ · vite build ✓ (498KB JS, 35KB CSS)

### ✅ Phase 4.3: 导航栏拟态玻璃 & 图标导航 (2026-06-19)

**目标:** 导航栏在 hero 顶部透明融入，滚动后切换为拟态玻璃；导航项添加 Lucide 图标。

**根因分析:**
- `sticky top-0` 在 scrollY=0 时处于正常文档流，位于 hero 上方而非重叠
- `bg-transparent` 透出父元素 `bg-zinc-50` 而非 hero 视频
- 文字色始终深色，暗色 hero 上无法辨认

**修复:**

| 文件 | 变更 | 说明 |
|------|------|------|
| [Layout.tsx](frontend/src/components/Layout.tsx) | `sticky` → `fixed top-0 left-0 w-full` | 脱离文档流，浮动在 hero 上方 |
| | 动态文字颜色 | 未滚动 `text-white`，滚动后 `text-zinc-950` |
| | 双态玻璃样式 | 透明态：`bg-transparent backdrop-blur-sm` + 2-4px 渐变暗边缘；滚动态：`bg-white/70 backdrop-blur-xl` + 拟态阴影 + 内发光 |
| | `<main>` 加 `pt-14` | 补偿 fixed 导航栏高度 |
| | 导航项加 Lucide 图标 | `Home`/`Tag`/`MessageSquareText`/`Search`/`User`，`flex items-center gap-1.5` |
| [Home.tsx](frontend/src/pages/Home.tsx) | hero section 加 `-mt-14` | 抵消 main padding，视频从视口顶端开始 |
| [AdminLayout.tsx](frontend/src/components/AdminLayout.tsx) | `flex-shrink-0` → `shrink-0` | Tailwind v4 规范类名 |

**导航栏双态:**
| 状态 | 背景 | 阴影 | 文字 |
|------|------|------|------|
| 顶部 (scrollY=0) | `bg-transparent` + `backdrop-blur-sm` | `shadow-[0_1px_2px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.06)]` | `text-white` |
| 滚动后 | `bg-white/70` + `backdrop-blur-xl` | `shadow-[0_4px_16px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]` | `text-zinc-950` |

**验证:** tsc ✓ · ESLint 0 ✓

### ✅ Phase 4.4: 文章编辑器重构 — 本地上传、Markdown工具栏、文档导入、预览 (2026-06-19)

**目标:** 移除封面图片URL输入，仅保留本地上传；添加拖拽上传；Markdown格式工具栏；文档导入；预览需模拟发布后外观。

**后端新增:**
| 变更 | 详情 |
|------|------|
| `upload.routes.ts` | `POST /api/admin/upload` — JWT保护的图片上传，UUID文件名 |
| `@fastify/multipart` | 文件上传支持，限制5MB |
| `@fastify/static` | 挂载 `/uploads/` 提供上传文件访问 |
| `index.ts` | 注册multipart/static插件 + upload路由 |
| `posts.routes.ts` | 新增 `GET /api/admin/posts` — 分页列表（搜索+状态过滤） |
| `vite.config.ts` | 代理 `/uploads` → 后端3001端口 |

**前端新组件:**
| 组件 | 用途 |
|------|------|
| `CoverImageUpload.tsx` | 自包含拖拽/点击上传区域 — 空态（虚线区域+ImagePlus图标）、悬停态（蓝色高亮）、上传中（spinner）、已加载（预览+悬停覆盖层"更换"/"移除"按钮） |
| `MarkdownToolbar.tsx` | 12按钮格式工具栏 — 粗体/斜体/标题/删除线/链接/图片/行内代码/代码块/引用/无序列表/有序列表/分割线。Props: `{ onAction: (action: MarkdownAction) => void }` |
| `PostPreview.tsx` | 模拟PostDetail发布外观 — Caveat标题（"无标题"占位）→ 元数据行（日期+标签）→ 封面图 → 分割线 → `react-markdown` 渲染内容 |

**PostEditor 重构:**
| 变更 | 详情 |
|------|------|
| 移除封面URL输入 | 删除 `coverImage` URL文本框 + 内联 `<img>` 预览 |
| 替换为 CoverImageUpload | `<CoverImageUpload value={coverImage} onChange={setCoverImage} />` |
| 文档导入 | 隐藏 `<input type="file" accept=".md,.txt,.markdown">` + FileUp按钮 → FileReader.readAsText() → setContent() |
| 格式工具栏集成 | `<MarkdownToolbar onAction={handleMarkdownAction} />` 位于textarea上方 |
| handleMarkdownAction | `useCallback` 依赖 content — 读取textarea选择范围，包裹/插入Markdown语法，通过 setTimeout(0) 恢复焦点+光标 |
| 预览替换 | 内联prose预览 → `<PostPreview title={title} content={content} coverImage={coverImage} tags={tags} />` |
| 字数统计 | 实时 `{content.length} 字` 计数器 |
| textarea ref | `contentTextareaRef` 用于工具栏光标操作 |

**PostDetail 修复:**
| 变更 | 详情 |
|------|------|
| Markdown渲染 | `{post.content}` → `<ReactMarkdown remarkPlugins={[remarkGfm]}>` |
| 移除类名 | `whitespace-pre-wrap` 已移除（prose自行处理空格） |

**其他前端变更:**
| 文件 | 变更 |
|------|------|
| `api.ts` | 新增 `api.upload<T>(url, FormData)` — 401刷新队列复用，无Content-Type（浏览器自动设置multipart boundary） |
| `PostManagement.tsx` | 新增管理页 — 所有文章分页列表，搜索+状态过滤，内联删除 |
| `AdminLayout.tsx` | 修复 `/admin/posts` 导航active状态逻辑（排除 `/admin/posts/new`） |
| `App.tsx` | 新增 `/admin/posts` 路由 |
| `ConfirmDialog.tsx` | `flex-shrink-0` → `shrink-0` (Tailwind v4规范) |

**文件统计:** 19文件，+1147行，-50行

**验证:** tsc ✓ · ESLint 0 ✓ · vite build ✓ (515KB JS, 39KB CSS)

### ✅ Phase 4.5: 首页 Hero 过渡柔化 & 遮蔽闪烁修复 (2026-06-20)

**目标:** 首页壁纸最下方与博文区域衔接过于生硬，用渐变阴影柔化过渡；刷新/返回首页时灰色蒙版先于壁纸出现。

**修复:**

| 文件 | 变更 | 说明 |
|------|------|------|
| [Home.tsx:113](frontend/src/pages/Home.tsx#L113) | 插入 6px 渐变条 | `h-1.5 bg-linear-to-b from-zinc-950/40 to-zinc-200/60` |
| [Home.tsx:116](frontend/src/pages/Home.tsx#L116) | 移除 `border-t border-zinc-100` | 硬边框与渐变柔和过渡冲突 |
| [Home.tsx:60](frontend/src/pages/Home.tsx#L60) | section 加 `bg-zinc-950` | 壁纸加载前为深色底色（与遮罩同色系），不再灰蒙 |
| [Home.tsx:21,40](frontend/src/pages/Home.tsx#L21) | `mediaLoaded` 状态 + `handleMediaLoaded` | 追踪媒体首帧是否就绪 |
| [Home.tsx:71,78,90](frontend/src/pages/Home.tsx#L71) | `onLoadedData` / `onLoad` | 三类媒体元素（API视频/图片/默认视频）均挂载就绪回调 |
| [Home.tsx:33-38](frontend/src/pages/Home.tsx#L33) | URL 变更检测 | `wallpaperUrl` 变更时重置 `mediaLoaded`（admin 换壁纸后遮罩重新淡入） |
| [Home.tsx:96](frontend/src/pages/Home.tsx#L96) | 遮罩淡入动画 | `transition-opacity duration-500`，`mediaLoaded ? opacity-100 : opacity-0` |

**原理:** section 底色 `bg-zinc-950` 与遮罩 `zinc-950/55` 同色系，壁纸加载前整个 hero 为深色，视觉上有意为之。壁纸首帧就绪后遮罩 500ms 淡入，消除灰色闪烁。

**验证:** tsc ✓

### ✅ Phase 4.6: 博文详情页 Hero 重构 (2026-06-20)

**目标:** 博文用封面图作为上半部分背景（hero），标题+元数据覆叠其上，下方白底展开正文。

**PostDetail 页面结构变更:**

| 区域 | 原设计 | 新设计 |
|------|--------|--------|
| 上半部分 | 无背景，全白底 → 标题+元数据+正文+评论区 | 封面图 hero（`min-h-[50vh]`）→ 标题+元数据白色覆叠文本 |
| 过渡 | 无 | 6px 渐变条 `from-zinc-950/40 to-zinc-200/60` |
| 下半部分 | 无分层 | 白色背景 → 正文 + 评论区 |
| 无封面时 | — | `bg-zinc-800` 深色 fallback |

**三种状态处理:**

| 状态 | Hero | 正文区 |
|------|------|--------|
| 加载中 | `bg-zinc-800 animate-pulse` + 骨架标题行 | 白底骨架段落 |
| 文章未找到 | `bg-zinc-800 min-h-[30vh]` + "文章未找到" | 白底提示文本 |
| 正常 | 封面图（或 `bg-zinc-800` fallback）+ 55%遮罩 + 标题/元数据 | 白底 prose + 评论区 |

**文件变更:**
| 文件 | 变更 |
|------|------|
| [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) | 全面重构 — loading/error/正常三态均有 hero + 渐变 + 白底双层结构 |

**验证:** tsc ✓

### ✅ Phase 4.7: DELETE 修复 + 壁纸管理重写 + 草稿箱 + Schema 修复 (2026-06-20)

**Bug #1 — DELETE 操作全部报错:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 所有 DELETE 返回 `"Body cannot be empty when content-type is set to 'application/json'"` | [api.ts](frontend/src/lib/api.ts) 无条件设置 `Content-Type: application/json`，Fastify 拒绝空 body | 仅在有 body 时加 Content-Type header |

```typescript
// Before
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...options.headers,
};
// After
const headers: Record<string, string> = {
  ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  ...(options.headers as Record<string, string>),
};
```

**Bug #2 — 创建草稿时报 `coverImage must match format "uri"`:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 选择「草稿」点击「创建」报错 | `coverImage` schema 用了 `format: 'uri'`，但封面图已改为本地上传（相对路径 `/uploads/xxx.jpg`），且 `null` 也被 format 校验 | 移除 `format: 'uri'`，改为 `type: ['string', 'null'], maxLength: 500` |

```typescript
// Before (both schemas)
coverImage: { type: ['string', 'null'], format: 'uri' }
// After
coverImage: { type: ['string', 'null'], maxLength: 500 }
```

**Bug #3 — 摘要输入框按回车触发表单提交:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 摘要框按 Enter 触发创建，报 `coverImage must match format 'uri'` | `<input type="text">` 在 `<form>` 内按回车触发 submit | 摘要 input 加 `onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}` |

**功能 #1 — WallpaperAdmin 全面重写:**

移除 URL 输入方式，改为纯文件管理：

| 功能 | 实现 |
|------|------|
| 上传区 | 拖拽/点击上传，接受 jpg/png/mp4，客户端 MIME + 大小校验 |
| 文件库 | CSS Grid 缩略图网格，图片 `<img>` / 视频 `<video>`，当前壁纸绿色环 + "当前" 徽章 |
| 选中 | 点击选中显示蓝色环，两步操作（选中 → 设为目标）防止误改 |
| 预览 | `aspect-video` 容器，自动区分 image/video 渲染 |
| 后端 `GET /admin/uploads` | 读取 uploads 目录，返回 `UploadedFile[]`（按 modifiedAt 降序，jpg/png/mp4 过滤） |

**功能 #2 — PostEditor 草稿箱 + 保存草稿按钮:**

| 功能 | 实现 |
|------|------|
| 「保存草稿」按钮 | 在「创建/更新」按钮下方，强制以 `DRAFT` 状态保存；草稿可为空标题（至少填内容）或空内容（至少填标题） |
| 草稿箱面板 | 新建文章模式左侧栏底部，列出所有 DRAFT 文章（标题、日期），点击跳转编辑 |
| 草稿保存后停留 | `createMutation`/`updateMutation` 的 `onSuccess` 中根据 `post.status` 决定跳转 — DRAFT 留在当前页（新建→进入编辑模式），PUBLISHED 跳转仪表盘 |
| 摘要在预览中显示 | `PostPreview` 改为显示 `excerpt` 而非完整 Markdown content |

**前端 mutation 重构:**
- `createMutation` / `updateMutation` 的 `mutationFn` 接受可选 `forceStatus` 参数
- `buildPayload(forceStatus?)` 提取公共 payload 构建逻辑
- `handleSubmit` 传当前 status，`handleSaveDraft` 强制传 `'DRAFT'`

**新增类型:**
| 类型 | 字段 |
|------|------|
| `UploadedFile` | `filename, url, type: 'image' \| 'video', size, modifiedAt` |

**文件变更:**
| 文件 | 变更 |
|------|------|
| [api.ts](frontend/src/lib/api.ts) | Content-Type 条件化（DELETE 修复） |
| [post.schema.ts](backend/src/schemas/post.schema.ts) | `coverImage` 移除 `format: 'uri'`，改为 `type: ['string', 'null'], maxLength: 500` |
| [upload.routes.ts](backend/src/routes/upload.routes.ts) | 扩展 mp4 支持 + 文件扩展名校验 + 新增 `GET /admin/uploads` |
| [index.ts](backend/src/index.ts) | multipart 上限 5MB→50MB |
| [types/index.ts](frontend/src/types/index.ts) | 新增 `UploadedFile` 接口 |
| [WallpaperAdmin.tsx](frontend/src/pages/admin/WallpaperAdmin.tsx) | 全面重写 — 上传区 + 文件库 + 预览 + 保存 |
| [PostPreview.tsx](frontend/src/components/PostPreview.tsx) | 摘要区改为显示 `excerpt` 而非 content |
| [PostEditor.tsx](frontend/src/pages/admin/PostEditor.tsx) | 草稿箱面板 + 保存草稿按钮 + 草稿保存后停留 + mutation 重构 |

**验证:** backend tsc ✓ · frontend tsc ✓ · ESLint 0 ✓ · vite build ✓ (524KB JS, 44KB CSS)

### ✅ Phase 4.8: 壁纸管理完善 + 预览一致性 + 细节修复 (2026-06-20)

**目标:** 壁纸可重置为默认、文件库可删除文件；编辑器预览与发布页排版完全一致；喇叭仅视频时显示；Tailwind v4 规范类名。

**Bug #1 — 壁纸保存失败 `body/url must match format "uri"`:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 选择上传文件后保存报错 | [wallpaper.schema.ts](backend/src/schemas/wallpaper.schema.ts) `url` 字段有 `format: 'uri'`，但上传返回相对路径 `/uploads/xxx.jpg` | 移除 `format: 'uri'`，改为 `minLength: 1, maxLength: 500` |

**Bug #2 — 编辑器预览与发布排版不一致:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 编辑器预览只显示摘要，不渲染 Markdown 正文 | [PostPreview.tsx](frontend/src/components/PostPreview.tsx) 旧版仅显示 `excerpt`，完全不用 ReactMarkdown | 全面重写 PostPreview：hero缩略 + 渐变条 + `<ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>` 渲染正文 |

**Bug #3 — 导入文档后换行全部消失:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 编辑器 textarea 中换行显示正常，发布后全部挤在一起 | 标准 Markdown 单 `\n` 不产生断行 | 安装 `remark-breaks`，PostDetail + PostPreview 两侧均启用 |

**功能 #1 — 恢复默认壁纸:**
| 层 | 变更 |
|----|------|
| 后端 | 新增 `DELETE /api/admin/wallpaper` — `deleteMany()` 清空壁纸记录，返回 204 |
| 前端 | 保存按钮旁新增"恢复默认壁纸"按钮（`RotateCcw` 图标），仅在 wallpaper 存在时显示 |

**功能 #2 — 文件库删除:**
| 层 | 变更 |
|----|------|
| 后端 | 新增 `DELETE /api/admin/uploads/:filename` — 路径遍历防护 + 物理删除 `unlink()` |
| 前端 | 文件卡片左上角悬停浮现红色垃圾桶按钮（`Trash2` + `e.stopPropagation()`），乐观更新 + 失败回滚 |

**细节修复:**
| 文件 | 变更 |
|------|------|
| [Home.tsx](frontend/src/pages/Home.tsx) | 喇叭按钮条件渲染：`{(!wallpaper \|\| wallpaper.type === 'video') && (...)}` — 图片壁纸时不显示 |
| [Home.tsx](frontend/src/pages/Home.tsx) / [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) / [PostPreview.tsx](frontend/src/components/PostPreview.tsx) | Tailwind v4 规范：`h-[6px]` → `h-1.5`，`bg-gradient-to-b` → `bg-linear-to-b` |
| [CLAUDE.md](CLAUDE.md) | 同步更新类名 |

**文件变更:**
| 文件 | 变更 |
|------|------|
| [wallpaper.schema.ts](backend/src/schemas/wallpaper.schema.ts) | `url` 移除 `format: 'uri'` |
| [wallpaper.routes.ts](backend/src/routes/wallpaper.routes.ts) | 新增 `DELETE /api/admin/wallpaper` |
| [upload.routes.ts](backend/src/routes/upload.routes.ts) | 导入 `unlink`，新增 `DELETE /api/admin/uploads/:filename` |
| [PostPreview.tsx](frontend/src/components/PostPreview.tsx) | 全面重写 — hero + 渐变 + ReactMarkdown 正文（与 PostDetail 一致） |
| [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) | 加 `remarkBreaks`，渐变类名规范 |
| [Home.tsx](frontend/src/pages/Home.tsx) | 喇叭仅视频显示，渐变类名规范 |
| [WallpaperAdmin.tsx](frontend/src/pages/admin/WallpaperAdmin.tsx) | 恢复默认按钮 + 删除文件按钮 + 类名规范 |
| [PostEditor.tsx](frontend/src/pages/admin/PostEditor.tsx) | 移除 `excerpt` prop（PostPreview 不再需要） |

**验证:** tsc ✓ · ESLint 0 ✓

### ✅ Phase 4.9: 管理员设置 — 头像 / 账户名 / 密码 (2026-06-20)

**目标:** 后台增加管理员设置页面，支持更改头像、账户名、密码。

**数据库变更:**
| 变更 | 详情 |
|------|------|
| User 新增 `avatar` | `String? @db.VarChar(500)` — 迁移 `20260620061629_add_user_avatar` |

**后端新增:**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/me` | PUT | 更新账户名/头像，检查用户名唯一性。返回完整 User |
| `/api/auth/me/password` | PUT | 更改密码（验证当前密码 + atomic tokenVersion increment），速率限制 5/min |

**后端修复 (code review):**
| 修复 | 说明 |
|------|------|
| tokenVersion 原子递增 | `tokenVersion: user.tokenVersion + 1` → `tokenVersion: { increment: 1 }` — 防止 TOCTOU 竞态 |
| 改密端点速率限制 | 添加 `rateLimitPresets.auth` (5/min) 防暴力破解 |
| `currentPassword` schema | 添加 `maxLength: 128` — 与 `newPassword` 一致 |

**前端新增:**
| 页面/组件 | 路由 | 功能 |
|-----------|------|------|
| [AdminProfile.tsx](frontend/src/pages/admin/AdminProfile.tsx) | `/admin/profile` | 三区块：头像（hover 上传/移除）、账户名（编辑+保存）、密码（当前密码+新密码） |

**前端修改:**
| 文件 | 变更 |
|------|------|
| [types/index.ts](frontend/src/types/index.ts) | `User` 接口新增 `avatar: string \| null` |
| [useAuth.ts](frontend/src/hooks/useAuth.ts) | `AuthContextValue` 新增 `updateUser: (user: User) => void` |
| [useAuth.tsx](frontend/src/hooks/useAuth.tsx) | `AuthProvider` 实现 `updateUser` callback |
| [AdminLayout.tsx](frontend/src/components/AdminLayout.tsx) | 侧边栏导航新增「管理员设置」+ 头像区显示真实头像（点击跳转设置页） |
| [App.tsx](frontend/src/App.tsx) | 新增 `/admin/profile` 路由 |

**头像上传流程:**
1. 用户点击头像 → 选择 JPG/PNG 文件（≤2MB 客户端校验）
2. `POST /api/admin/upload` (FormData) → 返回 `{ url }`
3. `PUT /api/auth/me { avatar: url }` → 更新 User → `updateUser()` 刷新上下文
4. 侧边栏头像即时更新

**安全要点:**
- 改密后 `tokenVersion` 原子递增，所有设备立即登出
- 当前密码验证通过后才允许更新
- 用户名更新检查唯一性（排除自身）
- 所有新端点均受 `authGuard` 保护
- 改密端点速率限制 5/min

**验证:** backend tsc ✓ · frontend tsc ✓ · ESLint 0 ✓ · vite build ✓ (535KB JS, 46KB CSS)

### ✅ Phase 4.10: 点赞交互打磨 + 标题字体替换 (2026-06-20)

**目标:** 点赞改为可取消 toggle，操作后即时显示，评论计数乐观更新，跨页面计数同步，标题字体 Caveat → Noto Serif SC。

**后端 — Toggle-Like 端点:**
| 变更 | 详情 |
|------|------|
| `POST /posts/:slug/like` → `POST /posts/:slug/toggle-like` | Body `{ liked: boolean }`，`liked: true` 递增 `likeCount`，`liked: false` 递减（floor 0） |
| `$transaction` | Prisma 事务包裹 read→write，避免 TOCTOU 竞态 |
| `toggleLikeBodySchema` | 新 Fastify JSON Schema：`required: ['liked'], properties: { liked: { type: 'boolean' } }` |

**前端 — 共享 Like Hook:**
| 变更 | 详情 |
|------|------|
| [useLike.ts](frontend/src/hooks/useLike.ts) | **新建** — 封装 localStorage、乐观 ±1 toggle、API 调用、失败回滚、可选 query invalidation |
| `liked` 派生 | 从 `getLikedPosts().has(postId)` 渲染时直接计算，不存 state，保证跨导航准确 |
| 竞态防护 | `useRef` 追踪挂载状态，unmount 后不回写 state |

**前端 — PostCard 点赞 Toggle:**
| 变更 | 详情 |
|------|------|
| 移除内联 like 逻辑 | 删除 `LIKED_KEY`、`getLikedPosts()`、`handleLike`（共 55 行） |
| 使用 `useLikePost` | `const { liked, likeCount, likePending, toggleLike } = useLikePost(...)` |
| Toggle 支持 | 已点赞→红心；点击→取消（心变灰，数 -1）。按钮防连点 |
| `aria-label` | 动态 `'点赞'` / `'取消点赞'` |

**前端 — PostDetail 点赞 + 评论 + 跨页同步:**
| 变更 | 详情 |
|------|------|
| 使用 `useLikePost` | 含 `invalidateQueries: { client: queryClient, key: ['post', slug] }` — toggle 成功后刷新文章数据 |
| 评论乐观计数 | `submitComment` 新增 `onMutate`（乐观 +1 `_count.comments`）→ `onError`（回滚）→ `onSettled`（刷新 post + comments） |
| 跨页刷新 | `GET /posts/:slug` 的 `queryFn` 成功后 `invalidateQueries(['posts'])` — 返回首页时计数已更新 |
| 导航隔离 | [App.tsx](frontend/src/App.tsx) 新增 `PostDetailRoute` 包装器 — 用 `key={slug}` 迫使不同文章间组件重挂载 |

**字体替换:**
| 变更 | 详情 |
|------|------|
| `--font-heading` | `'Caveat', cursive` → `'Noto Serif SC', serif` |
| Google Fonts | 替换 `Caveat` 为 `Noto+Serif+SC:wght@400;500;600;700;900` |
| 影响范围 | 全站 26 处 `font-heading` 自动继承新字体，无需逐个修改 |

**新增类型:**
| 类型 | 字段 |
|------|------|
| `UseLikePostOptions` | `{ postId, slug, initialLikeCount, invalidateQueries? }` |
| `UseLikePostResult` | `{ liked, likeCount, likePending, toggleLike }` |

**文件变更:**
| 文件 | 变更 |
|------|------|
| [posts.routes.ts](backend/src/routes/posts.routes.ts) | `POST /:slug/like` → `POST /:slug/toggle-like` + `$transaction` |
| [post.schema.ts](backend/src/schemas/post.schema.ts) | 新增 `toggleLikeBodySchema` |
| [useLike.ts](frontend/src/hooks/useLike.ts) | **NEW** — 共享点赞 toggle hook |
| [PostCard.tsx](frontend/src/components/PostCard.tsx) | 使用 `useLikePost`，支持取消点赞 |
| [PostDetail.tsx](frontend/src/pages/PostDetail.tsx) | `useLikePost` + 评论乐观计数 + 跨页刷新 |
| [App.tsx](frontend/src/App.tsx) | `PostDetailRoute` 包装器（`key={slug}`） |
| [index.css](frontend/src/index.css) | Caveat → Noto Serif SC |

**验证:** backend tsc ✓ · frontend tsc ✓ · ESLint 0 ✓ · vite build ✓ (536KB JS, 46KB CSS)

### ✅ Phase 4.11: 关于我页面 CMS 编辑 (2026-06-20)

**目标:** 后台添加关于我页面内容编辑功能，替换前端硬编码文本为动态 API 数据。

**数据库:**
| 模型 | 详情 |
|------|------|
| `About` | 已存在（Phase 4.11 之前创建），单行 upsert 模式（id=1），8 个字段 |

**Backend:**
| 文件 | 变更 |
|------|------|
| [about.schema.ts](backend/src/schemas/about.schema.ts) | **新建** — Fastify JSON Schema：4 个必填字段（greetingTitle/Content, aboutTitle/Content 1-5000 字符）+ 3 个可选联系方式（email/github/location） |
| [about.routes.ts](backend/src/routes/about.routes.ts) | **新建** — `GET /api/about`（公开，返回首条记录或 null）+ `PUT /api/admin/about`（authGuard + schema 校验，upsert id=1） |
| [index.ts](backend/src/index.ts) | 注册 `aboutRoutes`（import + `fastify.register` with `/api` prefix） |
| [seed.ts](backend/prisma/seed.ts) | 添加 `prisma.about.upsert` 默认数据 |

**Frontend — 管理后台编辑页:**
| 文件 | 变更 |
|------|------|
| [AboutEditor.tsx](frontend/src/pages/admin/AboutEditor.tsx) | **新建** — 三区块表单：欢迎语（标题+内容）、关于博客（标题+内容）、联系方式（邮箱/GitHub/位置）。TanStack Query 加载 + `useMutation` 保存，成功显示"已保存"绿色反馈，带字符计数 |

**Frontend — 公开页面 API 化:**
| 文件 | 变更 |
|------|------|
| [About.tsx](frontend/src/pages/About.tsx) | 硬编码 → `useQuery<AboutContent>` 拉取 `GET /api/about`，所有字段有 fallback 默认值，联系方式空时不渲染区块。绑定数据到标题/段落/链接，GitHub 链接自动补全 `https://` |
| [App.tsx](frontend/src/App.tsx) | 新增 `/admin/about` 路由（ProtectedRoute 内）+ `AboutEditor` 导入 |
| [AdminLayout.tsx](frontend/src/components/AdminLayout.tsx) | `NAV_ITEMS` 新增「关于我编辑」项（`Info` 图标，`/admin/about`） |
| [types/index.ts](frontend/src/types/index.ts) | 新增 `AboutContent` 接口（id, greetingTitle, greetingContent, aboutTitle, aboutContent, email, github, location, updatedAt） |

**About 数据模型字段:**
| 字段 | 类型 | 说明 |
|------|------|------|
| `greetingTitle` | String (100) | 欢迎语标题，如"你好" |
| `greetingContent` | Text (2000) | 欢迎语正文 |
| `aboutTitle` | String (100) | 关于标题，如"关于这个博客" |
| `aboutContent` | Text (5000) | 关于正文 |
| `email` | String? (255) | 联系邮箱 |
| `github` | String? (255) | GitHub 链接 |
| `location` | String? (100) | 位置信息 |

**CMS 编辑流程:**
1. 管理员访问 `/admin/about` → `GET /api/about` 加载已有数据填充表单
2. 编辑任意字段 → 点击「保存」→ `PUT /api/admin/about`（JWT 认证 + JSON Schema 校验）
3. 公开 `/about` 页面 → `GET /api/about` 获取最新内容并渲染

**验证:** backend tsc ✓ · frontend tsc ✓ · ESLint 0 ✓ · vite build ✓ (547KB JS, 51KB CSS)

### ✅ Phase 4.12: 首页页脚 — 备案 & 免责声明 (2026-06-20)

**目标:** 为备案上架做准备，在首页最底部添加页脚，包含版权声明、免责声明和 ICP 备案号。

**新组件:**
| 组件 | 用途 |
|------|------|
| [Footer.tsx](frontend/src/components/Footer.tsx) | 深色页脚（`bg-zinc-900`），三栏布局：左（品牌 + © 年份）、中（`ShieldAlert` 图标 + 免责声明）、右（ICP 备案号 + 工信部链接） |

**集成:**
| 文件 | 变更 |
|------|------|
| [Home.tsx](frontend/src/pages/Home.tsx) | 导入 `Footer`，在标签侧边栏区域结束后、页面最底部渲染 |

**免责声明内容:** "本站为个人博客，所有文章仅代表作者个人观点，与任何机构无关。转载文章版权归原作者所有，如有侵权请联系删除。"

**ICP:** 备案号当前标记为 `待备案`，拿到后替换 [Footer.tsx:34](frontend/src/components/Footer.tsx#L34) 中的文本即可。

**验证:** tsc ✓ · ESLint 0 ✓

### ✅ Phase 4.13: 启动崩溃循环修复 — try/catch 作用域 (2026-06-20)

**Bug:** 服务器 `pm2 list` 显示运行但 `curl localhost:3001` 连接失败，PM2 重启次数高达 481 次。

**根因分析:**

| 问题 | 说明 |
|------|------|
| `buildApp()` 在 try 外面 | [index.ts:119](backend/src/index.ts#L119) `const app = buildApp()` 在 `try/catch` 之前，构造函数体内 `validateSecrets()` 在 production 模式下检测到弱密钥直接 `throw Error` |
| 未捕获异常 | 异常未被 catch → Node.js 进程崩溃 → PM2 重启 → 又崩溃 → 无限循环 |
| 异常处理引用了 `app` | `catch` 块内 `app.log.error(err)` — 但 `app` 对象尚未创建，二次崩溃 |
| JWT secrets 是占位符 | `.env` 中 `change-me-to-a-random-64-char-string` 匹配弱密钥正则 `/^change-me/i` |

**修复:**

| 文件 | 变更 |
|------|------|
| [index.ts:118-126](backend/src/index.ts#L118-L126) | `buildApp()` + `listen()` 整体包裹在 `try` 块内；`catch` 改用 `console.error`（`app` 可能不存在） |

```typescript
// Before — buildApp() outside try
const app = buildApp();
try { await app.listen(...); } catch (err) { app.log.error(err); }

// After — buildApp() inside try
try {
  const app = buildApp();
  await app.listen(...);
} catch (err) {
  console.error('FATAL: Failed to start server:', ...);
  process.exit(1);
}
```

**服务器端必须做的:** 替换 JWT secrets 为强随机值（`openssl rand -base64 64`），否则服务仍会正常退出（只是不再无限重启）。

**验证:** tsc ✓

### ✅ Phase 4.14: 生产环境一键部署脚本 (2026-06-21)

**目标:** 根目录下创建分步部署脚本，Ubuntu/Debian 服务器从零部署。

**新文件:**
| 文件 | 说明 |
|------|------|
| [setup-server.sh](setup-server.sh) | 服务器环境安装脚本 — 6 步交互式：基础包 → Node.js 22 → PostgreSQL 17 → Nginx → PM2 → ufw |
| [deploy-app.sh](deploy-app.sh) | 网站部署脚本 — 8 步交互式：克隆 → .env → 后端构建 → PM2 → 前端构建 → Nginx → SSL → 验证。默认公网 IP，预留域名 |

**脚本特性:**
| 特性 | 实现 |
|------|------|
| 14 步分步执行 | 每步幂等检查 + 确认后执行，安全重复运行 |
| 干运行 | `--check` 仅验证前置条件，不做变更 |
| 非交互式 | `--yes` + `--domain/--db-password/--git-repo` 参数 |
| 彩色输出 | ANSI 绿/黄/红 + section header 排版 |
| 自动密钥生成 | `openssl rand -base64 64` 生成 JWT access + refresh secrets |
| 安全加固 | `.env` chmod 600，`HOST=127.0.0.1`，`NODE_ENV=production` |
| 错误处理 | `set -euo pipefail` + ERR/EXIT/SIGINT trap |

**14 个步骤:**
| # | 步骤 | 幂等检查 |
|---|------|----------|
| 1 | `apt install` 基础软件包 | `dpkg -l` |
| 2 | Node.js 22 LTS | `node -v` |
| 3 | PostgreSQL 17 + 用户/数据库 | `pg_isready` + psql |
| 4 | Nginx | `nginx -v` |
| 5 | PM2 全局安装 + systemd | `pm2 -v` |
| 6 | ufw 防火墙 (SSH + Nginx Full) | `ufw status` |
| 7 | `git clone` 项目 | `.git` 目录 |
| 8 | 配置 `backend/.env` (生成密钥) | `grep NODE_ENV=production` |
| 9 | 后端构建 (`npm install` → `prisma` → `tsc`) | `dist/index.js` |
| 10 | 生成 `ecosystem.production.config.cjs` + `pm2 start` | `pm2 jlist` |
| 11 | 前端构建 + 部署到 Nginx | `index.html` in Nginx root |
| 12 | Nginx 站点配置 (反代 / SPA) | `sites-enabled/memorystory` |
| 13 | Let's Encrypt SSL (certbot) | `/etc/letsencrypt/live/$DOMAIN` |
| 14 | 最终验证 + 汇总报告 | 全部检查 |

**PM2 配置策略:**
- `ecosystem.config.cjs` — 保留不动（本地开发参考）
- `ecosystem.production.config.cjs` — 部署时生成，`interpreter: 'node'`（Linux），注入实际密钥，加入 `.gitignore`

**`.gitignore` 更新:** 新增 `ecosystem.production.config.cjs` 忽略规则（防止生产密钥提交到 Git）。

**验证:** `bash -n setup-server.sh && bash -n deploy-app.sh` ✓ (syntax OK)

### ✅ Phase 4.15: Production Readiness Audit (2026-06-21)

模拟 Ubuntu 生产环境，对后端核心文件进行了全量审查 + `NODE_ENV=production` 实际启动测试。

**验证通过项:**

| 检查项 | 结果 |
|--------|------|
| `tsc --noEmit` 类型检查 | ✅ 零错误 |
| 生产启动 — 弱密钥拒绝 (`validateSecrets`) | ✅ 正确抛出 FATAL |
| 生产启动 — DB 连接重试 (2次, 3s 间隔) | ✅ 正常 |
| 全局异常处理器 (`uncaughtException` / `unhandledRejection`) | ✅ 已就位 |
| SIGINT / SIGTERM 优雅关闭 (防重入 `isShuttingDown`) | ✅ 正确 |
| `authGuard` + `adminGuard` preHandler 链 | ✅ 异常正确冒泡 |
| 渐进式登录锁定 (5→15min, 10→1h) | ✅ 正确 |
| XSS 过滤 (`xss` 空白名单) | ✅ 全量过滤 |
| 文件上传安全 (MIME + 扩展名校验 + UUID + 路径遍历防护) | ✅ 正确 |
| Nginx SPA 配置 (try_files + API 反代 + gzip) | ✅ 正确 |
| Prisma onClose hook | ✅ 已注册 |
| PM2 `wait_ready: true` + `process.send('ready')` | ✅ 正确 |

**已知问题 (Known Issues):**

| # | 严重度 | 问题 | 说明 |
|---|--------|------|------|
| 1 | LOW | `buildApp()` 未 async | 9 处 `fastify.register()` 未 await。插件初始化错误会推迟到 `listen()` 时集中暴露，难以定位。当前实际运行无影响，但建议改为 `async function buildApp()` + `await fastify.register(...)` |
| 2 | NOTE | 缺少 HTTP 健康检查端点 | 无 `GET /api/health`。当前依赖 PM2 `wait_ready` + `process.send('ready')`，但 Nginx healthcheck 无法通过 HTTP 判断后端就绪状态 |
| 3 | NOTE | `unhandledRejection` 仅记录不退出 | 日志后继续运行是 Node.js 22 默认行为，但长期运行可能因泄漏的 Promise 引用导致内存累积 |
| 4 | NOTE | Prisma 双重 disconnect | SIGINT/SIGTERM handler 和 `onClose` hook 都会调用 `$disconnect()`。幂等无害但 `onClose` 中的调用无 `.catch()` 保护，理论极端场景下可能阻塞关闭流程 |
| 5 | NOTE | `ecosystem.config.cjs` Windows 路径 | `interpreter: 'D:/Program Files/nodejs/node.exe'` — 仅在 Windows 本地开发有效。生产部署由 `deploy-app.sh` 生成 `ecosystem.production.config.cjs`，不受影响 |
| 6 | NOTE | `tsconfig.json` moduleResolution | 使用 `"bundler"` 而非 `"node16"` / `"nodenext"`，是为兼容 ESM `.js` 扩展名导入的折中方案。功能正常但语义不准确 |

**⚠️ 部署前必须确认:**
- `npm run build` (tsc) 重新编译后再部署 — dist 必须与源码同步，否则生产环境缺失 Phase 4.13+ 的崩溃防护代码
- JWT secrets 已替换为 `openssl rand -base64 64` 强随机值

### ✅ Phase 4.16: PM2 fork + ESM 兼容修复 (2026-06-22)

**Bug:** 服务器 `pm2 status` 显示 `launching` 且不断重启（↺ 9+），日志完全为空。`node dist/index.js` 手动启动正常。

**诊断过程:**
| 步骤 | 测试 | 结果 |
|------|------|------|
| 1 | `node dist/index.js` 直接运行 | ✅ 正常（`Database connected` + `Listening at 127.0.0.1:3001`） |
| 2 | `NODE_ENV=production node dist/index.js` | ✅ 生产模式也正常 |
| 3 | PM2 + 简单 CJS 脚本 | ✅ PM2 自身正常 |
| 4 | PM2 + 独立 ESM `.mjs` 脚本 | ✅ 扩展名触发 ESM，正常 |
| 5 | PM2 + `"type":"module"` 目录内 `.js` | ❌ **静默崩溃，零日志** |

**根因:** PM2 7.x fork 模式不能直接运行 `"type": "module"` 的 `.js` 文件。进程在 ESM 模块解析阶段崩溃（在 `import Fastify...` 第一行之前），日志完全为空。动态 `import()` 在任何模块系统中都能正常解析 ESM。

**修复:**

| 文件 | 变更 |
|------|------|
| [index.ts](backend/src/index.ts) | 提取 `startServer()` 为导出 async 函数（`buildApp()` → DB → listen → PM2 ready） |
| [boot.cjs](backend/boot.cjs) | **新建** — CJS 启动器，`await import('./dist/index.js')` + `startServer()` |
| [deploy-app.sh](deploy-app.sh) | PM2 配置入口脚本 `dist/index.js` → `boot.cjs` |

**架构原理:**
```
PM2 启动 node boot.cjs          ← CJS 入口，PM2 完全兼容
  → await import('./dist/index.js')  ← 动态 import，正确解析 ESM 模块图
    → await mod.startServer()   ← 导出的启动函数
      → buildApp()              ← Fastify 工厂
      → prisma.$connect()       ← DB 连接（2 次重试，3s 间隔）
      → app.listen()            ← 端口绑定
      → process.send('ready')   ← PM2 wait_ready 信号
```

**验证:** backend tsc ✓ · frontend tsc ✓ · bash -n ✓ · git push ✓

### ✅ Phase 4.17: 首页视频卡顿 + 标签搜索 + 登录占位符修复 (2026-06-22)

**Bug #1 — 默认壁纸不显示（LFS 指针文件）：**
| 问题 | 根因 | 修复 |
|------|------|------|
| 首页默认视频壁纸一片黑 | `Suvan_2k_02b29.mp4` 被 Git LFS 追踪，服务器 `git clone` 后只拿到了 134 字节的 LFS 指针文件（`version https://git-lfs.github.com/…`），`<video>` 无法解码文本文件 | 服务器执行 `git lfs install && git lfs pull` 拉取实际视频（16.2 MB） |

**Bug #2 — 视频卡顿严重：**
| 问题 | 根因 | 修复 |
|------|------|------|
| 16MB 2K 视频在 hero 背景播放，首次缓冲极慢，播放中频繁卡顿 | 原始视频 2K 分辨率 + 高码率，客户端下载速度远低于理论带宽，缓冲区耗尽即卡 | ① 服务器用 ffmpeg 压缩至 720p（crf 28 + faststart）→ ≤5MB；② 前端 `<video>` 加 `preload="auto"` + `onCanPlayThrough` 回调 |

```bash
# 服务器端压缩命令
ffmpeg -i frontend/images/Suvan_2k_02b29.mp4 \
  -vf "scale=-2:720" -c:v libx264 -crf 28 -preset fast \
  -c:a aac -b:a 48k -movflags +faststart \
  frontend/images/Suvan_compressed.mp4
```

**Bug #3 — 英文标签搜索无结果：**
| 问题 | 根因 | 修复 |
|------|------|------|
| 标签页点击英文标签（如 `UI/UX`）跳转搜索页，但搜不出对应文章 | [posts.routes.ts:133-136](backend/src/routes/posts.routes.ts#L133-L136) `GET /api/search` 的 `OR` 只搜 `title` + `content`（`contains` + `insensitive`），不搜 `tags` 数组。英文标签在中文标题和正文中完全是另一个词 | `OR` 新增 `{ tags: { has: q } }` — 精确标签匹配 |

**Bug #4 — 登录页 placeholder 误导：**
| 问题 | 根因 | 修复 |
|------|------|------|
| 用户看到 placeholder `admin@example.com` → 输入此邮箱 → `Invalid credentials` | seed.ts 创建的 admin 邮箱是 `admin@memorystory.dev`，placeholder 写的是 `admin@example.com` | [AdminLogin.tsx:55](frontend/src/pages/admin/AdminLogin.tsx#L55) placeholder 改为 `admin@memorystory.dev` |

**文件变更：**
| 文件 | 变更 |
|------|------|
| [posts.routes.ts](backend/src/routes/posts.routes.ts) | 搜索 OR 新增 `{ tags: { has: q } }` |
| [Home.tsx](frontend/src/pages/Home.tsx) | 两个 `<video>` 加 `preload="auto"` + `onCanPlayThrough` |
| [AdminLogin.tsx](frontend/src/pages/admin/AdminLogin.tsx) | placeholder 邮箱修正 |

**验证:** backend tsc ✓ · frontend tsc ✓

### ✅ Phase 4.18: 文件上传安全加固 (2026-06-22)

**目标:** 对图片/视频上传端点进行纵深防御强化 — 魔数校验、速率限制、二次文件大小校验。

**改进项:**

| # | 改进 | 文件 | 说明 |
|---|------|------|------|
| 1 | 文件魔数（Magic Bytes）校验 | [upload.routes.ts](backend/src/routes/upload.routes.ts) | 读取文件头部 12 字节，与 JPEG (`FF D8 FF`)、PNG (`89 50 4E 47`)、MP4 (`…ftyp`/`…moov`/`…moof`) 的已知特征比对。防止伪造 `Content-Type` 上传非图片/视频文件 |
| 2 | 上传端点速率限制 | [upload.routes.ts](backend/src/routes/upload.routes.ts) + [rate-limit.ts](backend/src/middleware/rate-limit.ts) | 新增 `upload` 预设：20次/分钟。`POST /api/admin/upload` 应用 `config: { rateLimit: rateLimitPresets.upload }` |
| 3 | Handler 内二次文件大小校验 | [upload.routes.ts](backend/src/routes/upload.routes.ts) | `data.toBuffer()` 后检查 `buffer.length > MAX_UPLOAD_SIZE`，超限返回 413。multipart 插件层 50MB + handler 层 50MB 双重保护 |

**实现细节:**

| 细节 | 说明 |
|------|------|
| 流处理简化 | `pipeline(stream, createWriteStream)` → `data.toBuffer()` + `writeFile()`。端点仅管理员可访问，内存缓冲 50MB 是可接受的权衡 |
| 魔数通配符 | `0x00` 字节作为通配符（不比对），适配 MP4 ISO BMFF 格式中前 4 字节为可变大小字段 |
| 未知类型宽容 | `MAGIC_BYTES` 中未注册的 MIME 类型默认放行（不拒绝未来的新格式） |
| 清理旧导入 | 移除 `pipeline`、`Readable`、`Transform` 导入（不再需要） |

**文件变更:**
| 文件 | 变更 |
|------|------|
| [upload.routes.ts](backend/src/routes/upload.routes.ts) | 重写 POST handler — `toBuffer()` + 魔数校验 + 二次大小校验 + 速率限制；移除 `pipeline` 相关流处理代码 |
| [rate-limit.ts](backend/src/middleware/rate-limit.ts) | 新增 `upload` preset（20次/分钟） |

**验证:** backend tsc ✓ · frontend tsc ✓ · ESLint 0 ✓ · vite build ✓

### ✅ Phase 4.19: UI 打磨 — 文本选择 / 光标 / 毛玻璃内容区 (2026-06-22)

**目标:** 修复鼠标框选时 UI chrome 文字被选中、`<select>` 错误显示 I 型光标、内容区与背景粘在一起。

**Bug #1 — UI chrome 文字被框选:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 拖选导航栏、按钮、标签芯片时文字高亮 | 项目中零个 `select-none` 类 | 9 个文件 12 处 UI 容器添加 `select-none cursor-default`：Layout nav、AdminLayout sidebar + mobile bar、Footer、Pagination、MarkdownToolbar、PostCard meta row + tag chips、PostDetail hero meta row、Home tag sidebar + tag chips、TagsPage tag chips |

**Bug #2 — `<select>` 显示 I 型光标:**
| 问题 | 根因 | 修复 |
|------|------|------|
| 管理后台状态下拉框显示文本光标 | [index.css](frontend/src/index.css) 全局规则把 `select` 和 `input`/`textarea` 一起设为 `cursor: text` | 从 `cursor: text` 规则中移除 `select`，新增 `select { cursor: default; }` 显式声明 |

**功能 — 内容区毛玻璃 + 阴影扩散:**

| 区域 | 旧 | 新 |
|------|----|----|
| PostDetail 内容区 | `bg-white` | `bg-white/80 backdrop-blur-xl shadow-diffuse border-t border-white/40` |
| PostDetail 评论表单容器 | `border-zinc-200 rounded-lg bg-white` | `border-white/40 rounded-2xl bg-white/80 backdrop-blur-xl shadow-diffuse` |
| PostCard 卡片 | `bg-white shadow-card` | `bg-white/80 backdrop-blur-sm shadow-diffuse` |
| PostPreview 外层 | `border-zinc-200 rounded-lg bg-white` | `border-white/40 rounded-2xl bg-white/80 backdrop-blur-xl shadow-diffuse` |
| Home 博文列表 | `bg-white` | `bg-white/80 backdrop-blur-xl shadow-diffuse border-t border-white/40` |
| CommentForm 输入框 ×4 | `bg-white` | `bg-white/70 backdrop-blur-sm` |

**新 Design Token:**
| Token | 值 |
|-------|----|
| `--shadow-diffuse` | `0 4px 24px -4px rgba(0,0,0,0.08), 0 8px 32px -8px rgba(0,0,0,0.06)` |

**设计决策:**
- 毛玻璃方案参考 Layout nav 已有的 `bg-white/70 backdrop-blur-xl` 模式，统一视觉语言
- `bg-white/80` 在 `bg-zinc-50` 页面背景下保证文本可读性（WCAG AA 对比度以上）
- PostCard 用 `backdrop-blur-sm`（轻量），大块内容区用 `backdrop-blur-xl`（深度分离感）
- `rounded-2xl` 替代部分 `rounded-lg`，与 PostCard 一致

**文件变更:** 12 个文件，+32 -25 行

**验证:** tsc ✓ · ESLint 0 ✓ · vite build ✓ (553.71 KB JS, 73.07 KB CSS)

### ⏳ Phase 5: Polish (Pending)
- [ ] SEO meta tags + RSS feed
- [ ] Responsive testing (375px / 768px / 1024px / 1440px)
- [ ] `prefers-reduced-motion` verification
- [ ] Production build optimization
- [ ] Accessibility audit

## Immutability (CRITICAL)
- ALWAYS create new objects, NEVER mutate existing ones
- Use spread/rest, map/filter/reduce patterns
- Example: `buildCommentTree()` uses `[...parent.children, node]` not `.push()`

## Security Checklist (before any commit)
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user input validated (JSON Schema on all routes)
- [ ] All user input sanitized via `sanitizeContent()` before DB insert
- [ ] bodyLimit enforced (512KB) to prevent DoS
- [ ] Schema maxLength constraints on all user-input fields
- [ ] JWT verified on every protected route
- [ ] `adminGuard` applied alongside `authGuard` on all admin-only routes
- [ ] tokenVersion verified on refresh to enable token revocation
- [ ] bcrypt cost factor 12 for password hashing
- [ ] Helmet + CORS + rate limiting active
- [ ] No public login link anywhere in navbar
- [ ] Error messages do not leak sensitive data
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] No `console.log` in production code
- [ ] JWT secrets set in production (validated at startup by `validateSecrets`)
- [ ] Progressive login lockout active (5 fails→15min, 10 fails→1h)

## PM2 Services

| Port | Name | Type |
|------|------|------|
| 3001 | memorystory-backend | Fastify (Node.js) |

**Local dev config:** `ecosystem.config.cjs` (Windows path, placeholder secrets, dev CORS origin). Reference only — **do NOT use in production**.

**Production config:** `ecosystem.production.config.cjs` — auto-generated by `deploy-app.sh` step 4 at deploy time. Contains actual JWT secrets + DB password (chmod 600). Git-ignored. Entry point: `boot.cjs` (CJS → ESM bridge, PM2 7.x fork compatibility).

**Terminal Commands:**
```bash
# Production (via ecosystem.production.config.cjs)
pm2 start ecosystem.production.config.cjs   # First time
pm2 start all                               # After first time
pm2 stop all / pm2 restart all
pm2 start memorystory-backend / pm2 stop memorystory-backend
pm2 logs memorystory-backend                # View backend logs
pm2 logs / pm2 status / pm2 monit
pm2 save                                    # Save process list
pm2 resurrect                               # Restore saved list
```

**Cloud Deployment Notes:**
- 部署至阿里云 ECS（Ubuntu 22.04），详见 [ALIYUN.md](ALIYUN.md) 阿里云部署指南
- `deploy-app.sh` generates `ecosystem.production.config.cjs` with actual secrets from `backend/.env` — no manual config needed
- JWT secrets must be cryptographically strong (use `openssl rand -base64 64`) or `validateSecrets()` throws in production
- `NODE_ENV=production` triggers strict secret validation, `logger.level='warn'`
- Backend binding: `HOST=127.0.0.1` — only Nginx can reach backend (port 3001 not exposed to network)
- Backend log files: `backend/logs/backend-out.log`, `backend/logs/backend-error.log`
- Graceful shutdown: `kill_timeout: 5000`, waits 10s for ready signal (`listen_timeout`)
- Full deployment flow: run `bash deploy-app.sh` on the server → follow 8-step prompts → done
- For first-time setup, run `bash setup-server.sh` first to install all runtimes
