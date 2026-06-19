# MemoryStory Blog

## Project Overview
Personal blog website with threaded comments, Swiss Modernism design, hidden admin access.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Fastify 5 + TypeScript + Prisma + PostgreSQL 16
- **Auth**: JWT dual-token (access 15min + refresh 7d), bcrypt 12
- **Security**: No public login link; admin only via `/admin` URL path

## Commands
```bash
# Dev
docker-compose up -d                                         # PostgreSQL on :5432
cd backend && npx prisma migrate dev && npm run dev          # Fastify on :3001
cd frontend && npm run dev                                   # Vite on :5173

# Production
cd backend && npm run build && npm start
cd frontend && npm run build    # Output: dist/
```

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

## Architecture
```
my_Blog/
├── frontend/                  # React SPA
│   └── src/
│       ├── components/        # Navbar, PostCard, CommentTree, CommentForm, SearchBar, Pagination
│       ├── pages/             # Home, PostDetail, TagsPage, Guestbook, About, SearchPage, Login, Admin/
│       ├── hooks/             # useAuth (JWT context), useApi (TanStack Query wrappers)
│       ├── lib/               # api.ts (fetch client), auth.ts (token storage/refresh)
│       └── types/             # Shared TypeScript types
├── backend/                   # Fastify 5 API
│   └── src/
│       ├── routes/            # auth, posts, comments (threaded), tags, guestbook
│       ├── middleware/         # JWT guard, rate limiting
│       ├── lib/               # prisma singleton, jwt helpers
│       └── schemas/           # JSON Schema validation
├── docker-compose.yml         # PostgreSQL 16
└── .env.example
```

## Key Design Decisions

### Hidden Admin Access
- Navbar has NO login button — only 首页 / 标签 / 留言板 / 搜索 / 关于我 (all with Lucide SVG icons)
- Admin accessed only by typing `/admin` URL directly
- Route guard: `/admin/*` → redirect to `/admin/login` if unauthenticated
- `/admin/login` is the only login form — no public link to it exists

### Threaded Comments (盖楼)
- PostgreSQL recursive CTE with `parent_id` self-reference on Comment model
- Frontend: recursive React component with colored left borders per nesting level
- Query pattern: `WITH RECURSIVE ... ORDER BY depth, created_at`

### Homepage Layout
- **Above fold**: Navbar + large central whitespace with blog title/subtitle + "Scroll" text + double chevron `>>` near bottom edge
- **Below fold**: 2-column post grid (desktop) / 1 column (mobile) + "Load More" button
- Post cards: cover image placeholder, tag icon + label, title, excerpt, date, read time

### Immutability (CRITICAL)
- ALWAYS create new objects, NEVER mutate existing ones
- Use spread/rest, map/filter/reduce patterns — no in-place modifications

## Data Model (Prisma)

| Model | Key Fields |
|-------|-----------|
| **User** | id, username, email, passwordHash, role |
| **Post** | id, title, slug (unique), content (Markdown), excerpt, coverImage, status (draft/published), tags (String[]), authorId |
| **Comment** | id, content, postId, userId, parentId (self-ref → CommentReplies, Cascade on delete) |

## API Routes

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/posts` | List published posts (paginated) |
| GET | `/api/posts/:slug` | Single post by slug |
| GET | `/api/comments/:postId` | Threaded comments for a post |
| GET | `/api/tags` | All tags with post counts |
| GET | `/api/guestbook` | Guestbook messages (paginated) |
| POST | `/api/guestbook` | Create guestbook message |
| GET | `/api/search?q=` | Search posts by title/content |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → access + refresh token |
| POST | `/api/auth/refresh` | Refresh access token |

### Protected (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/posts` | Create post |
| PUT | `/api/admin/posts/:id` | Update post |
| DELETE | `/api/admin/posts/:id` | Delete post |
| POST | `/api/comments` | Create comment |
| DELETE | `/api/admin/comments/:id` | Delete comment |
| GET | `/api/admin/stats` | Dashboard statistics |

## Implementation Phases

1. **Scaffolding**: Init frontend (Vite+React+Tailwind+Lucide+ReactRouter+TanStackQuery), init backend (Fastify+Prisma), docker-compose.yml, .env.example
2. **Backend Core**: Prisma schema → migration → seed → JWT auth → all CRUD endpoints → rate limiting
3. **Frontend Core**: Layout + Navbar → all pages → auth flow → admin dashboard + Markdown editor
4. **Polish**: SEO meta + RSS + responsive testing (375px/768px/1024px/1440px) + `prefers-reduced-motion` + production build

## Security Checklist (before any commit)
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user input validated (JSON Schema on all routes)
- [ ] JWT verified on every protected route
- [ ] bcrypt cost factor 12 for password hashing
- [ ] Helmet + CORS + rate limiting active
- [ ] No public login link anywhere in navbar
- [ ] Error messages do not leak sensitive data
- [ ] SQL injection prevention (Prisma parameterized queries)
