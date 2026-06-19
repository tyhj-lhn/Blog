# MemoryStory Blog

## Project Overview
Personal blog website with threaded comments (盖楼), Swiss Modernism design, hidden admin access.
- **Frontend**: React 19.2 + TypeScript 6.0 + Vite 8.0 + Tailwind CSS 4.3
- **Backend**: Fastify 5.3 + TypeScript 5.7 + Prisma 6.6 + PostgreSQL 17 (Docker)
- **Auth**: JWT dual-token (access 15min + refresh 7d), bcryptjs cost 12
- **Security**: No public login link; admin only via `/admin` URL path

## Commands
```bash
# Infrastructure
docker-compose up -d                                         # PostgreSQL 17 on :5432

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
```

## Architecture
```
my_Blog/
├── docker-compose.yml              # PostgreSQL 17-alpine
├── .env.example                    # Template for .env
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma           # 4 models: User, Post, Comment, Guestbook
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
│       │   └── guestbook.schema.ts # Create guestbook entry
│       ├── middleware/
│       │   ├── auth.ts             # authGuard (JWT verify) + adminGuard
│       │   └── rate-limit.ts       # Presets: global 100/min, auth 5/min, guestbook 3/min
│       └── routes/
│           ├── auth.routes.ts      # POST login, POST refresh
│           ├── posts.routes.ts     # GET list/slug/search, POST/PUT/DELETE admin
│           ├── comments.routes.ts  # GET threaded by postId, POST create, DELETE admin
│           ├── tags.routes.ts      # GET all tags with counts ← unnest(tags)
│           ├── guestbook.routes.ts # GET list, POST create
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
│       │   ├── api.ts              # Fetch wrapper: JWT inject, 401 refresh queue, api.get/post/put/del
│       │   └── auth.ts             # localStorage token CRUD
│       ├── types/
│       │   └── index.ts            # All shared TS interfaces (Post, Comment, etc.)
│       ├── hooks/
│       │   └── useAuth.tsx         # AuthProvider + useAuth() hook
│       ├── components/
│       │   └── Layout.tsx          # Navbar (无登录链接) + Outlet
│       └── pages/
│           ├── Home.tsx            # Title + subtitle + scroll hint (placeholder)
│           ├── PostDetail.tsx      # Placeholder
│           ├── TagsPage.tsx        # Placeholder
│           ├── Guestbook.tsx       # Placeholder
│           ├── About.tsx           # Placeholder
│           ├── SearchPage.tsx      # Placeholder
│           └── admin/
│               ├── AdminLogin.tsx  # Placeholder
│               ├── AdminDashboard.tsx # Placeholder
│               └── PostEditor.tsx  # Placeholder
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
| `/post/:slug` | PostDetail | Public |
| `/tags` | TagsPage | Public |
| `/guestbook` | Guestbook | Public |
| `/about` | About | Public |
| `/search` | SearchPage | Public |
| `/admin/login` | AdminLogin | Public (login form) |
| `/admin` | → redirect /admin/dashboard | Auth required |
| `/admin/dashboard` | AdminDashboard | Auth required |
| `/admin/posts/new` | PostEditor | Auth required |
| `/admin/posts/:id/edit` | PostEditor | Auth required |
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
- **Headings**: Caveat (Google Fonts, 400–700) — handwritten, personal feel
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
| POST | `/api/comments` | Create comment. Body: `{content, postId, username, email?, websiteUrl?, parentId?}` |
| POST | `/api/guestbook` | Create guestbook entry. Body: `{nickname, message}` |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → `{accessToken, refreshToken, user}` |
| POST | `/api/auth/refresh` | Refresh → new token pair |

### Protected (JWT required — authGuard middleware)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/posts` | Create post |
| PUT | `/api/admin/posts/:id` | Update post (regenerates slug if title changes) |
| DELETE | `/api/admin/posts/:id` | Delete post (204) |
| DELETE | `/api/admin/comments/:id` | Delete comment + cascade children (204) |
| GET | `/api/admin/stats` | Dashboard: counts + recent posts + recent comments |

## Implementation Status

### ✅ Phase 1: Scaffolding (Complete)
- Docker PostgreSQL 17 running
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
- [x] About page — static, Lucide only, no emoji
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

### ⏳ Phase 4: Polish (Pending)
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
