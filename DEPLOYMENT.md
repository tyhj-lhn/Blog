# MemoryStory Blog — 部署与运维文档

> 最后更新：2026-06-20
>
> 本文档涵盖项目目录结构、数据库设计和云端部署全流程，供运维人员和后续开发者参考。

---

## 目录

- [1. 项目概览](#1-项目概览)
- [2. 目录结构](#2-目录结构)
- [3. 数据库结构](#3-数据库结构)
- [4. 云端部署指南](#4-云端部署指南)
  - [4.1 服务器选型与环境准备](#41-服务器选型与环境准备)
  - [4.2 后端部署](#42-后端部署)
  - [4.3 前端部署](#43-前端部署)
  - [4.4 Nginx 反向代理](#44-nginx-反向代理)
  - [4.5 HTTPS / SSL 证书](#45-https--ssl-证书)
  - [4.6 日常运维命令](#46-日常运维命令)
- [5. 安全清单](#5-安全清单)

---

## 1. 项目概览

| 项目 | 说明 |
|------|------|
| 名称 | MemoryStory Blog |
| 类型 | 个人博客网站 |
| 前端 | React 19.2 + TypeScript 6.0 + Vite 8.0 + Tailwind CSS 4.3 |
| 后端 | Fastify 5.3 + TypeScript 5.7 + Prisma 6.6 |
| 数据库 | PostgreSQL 17 |
| 认证 | JWT 双 Token（access 15min + refresh 7d），bcryptjs cost 12 |
| 设计 | Swiss Modernism 2.0（zinc 色系，Noto Serif SC + Quicksand 字体） |
| 特性 | 隐藏式后台管理、盖楼式评论、Markdown 编辑器、文件上传、点赞系统 |

---

## 2. 目录结构

```
my_Blog/
├── .env.example                    # 环境变量模板
├── .gitignore
├── CLAUDE.md                       # AI 辅助开发文档（架构、变更记录）
├── DEPLOYMENT.md                   # 本文档
├── docker-compose.yml              # 本地开发 PostgreSQL 17 容器
│
├── backend/                        # ============ 后端服务 ============
│   ├── package.json                # 依赖 & npm scripts
│   ├── tsconfig.json               # TypeScript 配置（ES2022 / ESNext）
│   ├── .env                        # 本地环境变量（不提交 Git）
│   ├── prisma/
│   │   ├── schema.prisma           # 数据模型定义（6 个模型）
│   │   ├── seed.ts                 # 种子数据（管理员 + 示例文章）
│   │   └── migrations/             # 数据库迁移文件（自动生成）
│   └── src/
│       ├── index.ts                # 入口 — buildApp() 工厂 + 服务器启动
│       ├── lib/                    # 工具库
│       │   ├── prisma.ts           # Prisma 客户端单例
│       │   ├── jwt.ts              # JWT 生成/验证 + 启动时密钥校验
│       │   ├── errors.ts           # AppError 类 + 工厂函数
│       │   ├── slugify.ts          # 标题 → URL 安全 slug
│       │   ├── sanitize.ts         # XSS 过滤（xss 库，白名单为空）
│       │   ├── login-guard.ts      # 渐进式登录锁定（5次→15min, 10次→1h）
│       │   └── comments.ts         # 盖楼评论树构建（O(n) 两趟算法）
│       ├── schemas/                # Fastify JSON Schema 校验
│       │   ├── common.schema.ts    # 分页 + 搜索查询
│       │   ├── auth.schema.ts      # 登录 + Token 刷新
│       │   ├── post.schema.ts      # 文章创建/更新 + 点赞 toggle
│       │   ├── comment.schema.ts   # 评论创建
│       │   ├── guestbook.schema.ts # 留言板输入
│       │   ├── wallpaper.schema.ts # 壁纸类型 + URL
│       │   └── about.schema.ts     # 关于页内容
│       ├── middleware/
│       │   ├── auth.ts             # authGuard (JWT 验证) + adminGuard
│       │   └── rate-limit.ts       # 速率限制预设（全局/登录/留言/评论）
│       └── routes/                 # 路由模块
│           ├── auth.routes.ts      # 登录/刷新/个人资料/改密
│           ├── posts.routes.ts     # 文章 CRUD + 搜索 + 标签过滤 + 点赞
│           ├── comments.routes.ts  # 评论树 + 创建 + 管理
│           ├── tags.routes.ts      # 标签云（含文章计数）
│           ├── guestbook.routes.ts # 留言板 CRUD
│           ├── wallpaper.routes.ts # 壁纸读写 + 删除
│           ├── about.routes.ts     # 关于页 CMS
│           ├── upload.routes.ts    # 图片/视频上传 + 文件管理
│           └── admin.routes.ts     # 仪表盘统计
│
├── frontend/                       # ============ 前端应用 ============
│   ├── package.json
│   ├── vite.config.ts              # Vite + React + Tailwind 插件，/api & /uploads 代理
│   ├── tsconfig.app.json           # 严格 TypeScript + verbatimModuleSyntax
│   ├── index.html                  # Google Fonts（Noto Serif SC + Quicksand）
│   ├── images/
│   │   └── Suvan_2k_02b29.mp4      # 默认 Hero 背景视频
│   └── src/
│       ├── main.tsx                # React 入口（StrictMode）
│       ├── App.tsx                 # 路由 + QueryClient + AuthProvider
│       ├── index.css               # Tailwind v4 @theme + 字体变量
│       ├── lib/
│       │   ├── api.ts              # Fetch 封装 — JWT 注入 + 401 刷新队列 + 上传
│       │   └── auth.ts             # localStorage Token 读写
│       ├── types/
│       │   └── index.ts            # 共享 TypeScript 接口
│       ├── hooks/
│       │   ├── useAuth.tsx         # AuthProvider（登录/登出/用户恢复）
│       │   ├── useAuth.ts          # AuthContext + useAuth() hook
│       │   ├── useLike.ts          # 点赞 toggle（localStorage + 乐观 UI）
│       │   ├── useAutoSave.ts      # 草稿 localStorage 自动保存
│       │   └── useDebounce.ts      # 防抖 hook
│       ├── components/
│       │   ├── Layout.tsx          # 前台布局 — 固定导航栏 + Outlet
│       │   ├── AdminLayout.tsx     # 后台布局 — 深色侧边栏 + 内容区
│       │   ├── ErrorBoundary.tsx   # React 渲染异常降级 UI
│       │   ├── ConfirmDialog.tsx   # 可复用删除确认模态框
│       │   ├── TagInput.tsx        # 芯片化标签输入
│       │   ├── CoverImageUpload.tsx# 拖拽图片上传
│       │   ├── MarkdownToolbar.tsx # 12 按钮 Markdown 格式工具栏
│       │   ├── PostPreview.tsx     # 发布预览（模拟 PostDetail）
│       │   ├── PostCard.tsx        # 文章卡片（封面+元数据+点赞）
│       │   ├── CommentTree.tsx     # 递归评论树（盖楼）
│       │   ├── CommentForm.tsx     # 评论提交表单
│       │   ├── SearchBar.tsx       # 搜索框
│       │   ├── Pagination.tsx      # 分页组件
│       │   ├── Footer.tsx          # 首页页脚（版权+免责+备案）
│       │   └── ScrollToTop.tsx     # 路由切换自动回顶
│       └── pages/
│           ├── Home.tsx            # 首页 — 全屏 Hero + 文章网格
│           ├── PostDetail.tsx      # 文章详情 — Hero 封面 + Markdown 正文
│           ├── TagsPage.tsx        # 标签云
│           ├── Guestbook.tsx       # 留言板
│           ├── About.tsx           # 关于我（CMS 驱动）
│           ├── SearchPage.tsx      # 全文搜索
│           └── admin/
│               ├── AdminLogin.tsx          # 独立全屏登录页
│               ├── AdminDashboard.tsx      # 仪表盘
│               ├── PostEditor.tsx          # Markdown 分屏编辑器
│               ├── PostManagement.tsx      # 文章管理
│               ├── CommentManagement.tsx   # 评论管理
│               ├── GuestbookManagement.tsx # 留言板管理
│               ├── WallpaperAdmin.tsx      # 壁纸管理
│               ├── AboutEditor.tsx         # 关于页 CMS 编辑
│               └── AdminProfile.tsx        # 管理员设置
```

---

## 3. 数据库结构

**数据库：** PostgreSQL 17
**ORM：** Prisma 6.6
**迁移：** `backend/prisma/migrations/`

### 3.1 枚举类型

| 枚举 | 值 | 用途 |
|------|-----|------|
| `Role` | `ADMIN` | 用户角色（仅管理员） |
| `PostStatus` | `DRAFT`, `PUBLISHED` | 文章发布状态 |

### 3.2 数据表

#### users — 用户（管理员）

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `INT` | PK, AUTO_INCREMENT | 主键 |
| `username` | `VARCHAR(50)` | UNIQUE, NOT NULL | 用户名 |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | 邮箱（登录用） |
| `password_hash` | `TEXT` | NOT NULL | bcryptjs cost 12 哈希 |
| `role` | `Role` | DEFAULT ADMIN | 角色 |
| `token_version` | `INT` | DEFAULT 0 | Token 版本号（递增则全部 Token 失效） |
| `avatar` | `VARCHAR(500)` | NULLABLE | 头像 URL |

**关联：** `posts`（一对多 → Post.authorId）

---

#### posts — 文章

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `INT` | PK, AUTO_INCREMENT | 主键 |
| `title` | `VARCHAR(200)` | NOT NULL | 标题 |
| `slug` | `VARCHAR(200)` | UNIQUE, NOT NULL | URL 友好标识（自动生成） |
| `content` | `TEXT` | NOT NULL | Markdown 正文 |
| `excerpt` | `VARCHAR(500)` | NULLABLE | 摘要 |
| `cover_image` | `TEXT` | NULLABLE | 封面图 URL |
| `status` | `PostStatus` | DEFAULT DRAFT | 草稿 / 已发布 |
| `tags` | `TEXT[]` | NOT NULL | PostgreSQL 原生数组 |
| `view_count` | `INT` | DEFAULT 0 | 阅读量（fire-and-forget 递增） |
| `like_count` | `INT` | DEFAULT 0 | 点赞数（原子 toggle） |
| `author_id` | `INT` | FK → users.id | 作者 |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `updated_at` | `TIMESTAMP` | AUTO | 更新时间 |

**索引：** `author_id`
**关联：** `comments`（一对多 → Comment.postId）

---

#### comments — 评论（盖楼）

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `INT` | PK, AUTO_INCREMENT | 主键 |
| `content` | `TEXT` | NOT NULL | 评论内容（经 XSS 过滤） |
| `post_id` | `INT` | FK → posts.id, CASCADE | 所属文章 |
| `username` | `VARCHAR(50)` | NOT NULL | 评论者昵称（游客） |
| `email` | `VARCHAR(255)` | NULLABLE | 评论者邮箱（可选） |
| `website_url` | `VARCHAR(500)` | NULLABLE | 评论者网站（可选） |
| `parent_id` | `INT` | FK → comments.id, CASCADE | 父评论（盖楼回复） |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |
| `updated_at` | `TIMESTAMP` | AUTO | 更新时间 |

**索引：** `post_id`, `parent_id`
**自关联：** `parent` ↔ `children`（关系名 `CommentReplies`）

**盖楼实现：** 后端 `buildCommentTree()` — O(n) 两趟算法（Map 索引 + 树组装）；查询使用 PostgreSQL 递归 CTE。

---

#### guestbook — 留言板

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `INT` | PK, AUTO_INCREMENT | 主键 |
| `nickname` | `VARCHAR(100)` | NOT NULL | 昵称 |
| `message` | `TEXT` | NOT NULL | 留言内容（经 XSS 过滤） |
| `created_at` | `TIMESTAMP` | DEFAULT NOW() | 创建时间 |

---

#### wallpaper — 首页 Hero 壁纸

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `INT` | PK, AUTO_INCREMENT | 主键 |
| `type` | `VARCHAR(10)` | NOT NULL | `"image"` 或 `"video"` |
| `url` | `VARCHAR(500)` | NOT NULL | 图片/视频 URL |
| `updated_at` | `TIMESTAMP` | AUTO | 更新时间 |

**模式：** 单条记录 upsert（id=1），有则更新，无则创建。

---

#### about — 关于页面内容

| 列 | 类型 | 约束 | 说明 |
|----|------|------|------|
| `id` | `INT` | PK, AUTO_INCREMENT | 主键（固定为 1） |
| `greeting_title` | `VARCHAR(100)` | DEFAULT '你好' | 欢迎语标题 |
| `greeting_content` | `TEXT` | DEFAULT '欢迎来到...' | 欢迎语正文 |
| `about_title` | `VARCHAR(100)` | DEFAULT '关于这个博客' | 关于标题 |
| `about_content` | `TEXT` | DEFAULT '从事软件...' | 关于正文 |
| `email` | `VARCHAR(255)` | NULLABLE | 联系邮箱 |
| `github` | `VARCHAR(255)` | NULLABLE | GitHub 链接 |
| `location` | `VARCHAR(100)` | NULLABLE | 位置信息 |
| `updated_at` | `TIMESTAMP` | AUTO | 更新时间 |

**模式：** 单行表，始终 upsert `id=1`。

---

### 3.3 ER 关系图

```
┌──────────┐        ┌──────────┐        ┌──────────┐
│   User   │ 1───N  │   Post   │ 1───N  │ Comment  │
│ (users)  │        │ (posts)  │        │(comments)│
└──────────┘        └──────────┘        └──────────┘
                                              │
                                              │ parent_id (自关联)
                                              ▼
                                        ┌──────────┐
                                        │ Comment  │
                                        │ (children)│
                                        └──────────┘

┌───────────┐     ┌───────────┐     ┌──────────┐
│ Guestbook │     │ Wallpaper │     │  About   │
│(guestbook)│     │(wallpaper)│     │ (about)  │
└───────────┘     └───────────┘     └──────────┘
    (独立表)          (独立表)          (单行表)
```

---

## 4. 云端部署指南

### 4.1 服务器选型与环境准备

#### 最低配置

| 资源 | 要求 |
|------|------|
| CPU | 1 核（推荐 2 核） |
| 内存 | 1 GB（推荐 2 GB） |
| 磁盘 | 20 GB SSD（推荐 40 GB） |
| 系统 | Ubuntu 22.04 LTS / 24.04 LTS |
| 带宽 | 1 Mbps+ |

#### 推荐云服务商

| 服务商 | 推荐机型 | 月费参考 |
|--------|----------|----------|
| 阿里云 ECS | ecs.e-c1m1.large（2C1G） | ¥50–80 |
| 腾讯云 CVM | 标准型 S5（2C2G） | ¥50–80 |
| AWS Lightsail | $5/月计划 | ~¥36 |
| Vultr | 1vCPU / 1GB | $6/月 |

#### Step 1 — 登录服务器 & 更新系统

```bash
ssh root@<你的服务器IP>

# 更新系统包
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git ufw build-essential
```

#### Step 2 — 安装 Node.js 22 LTS

```bash
# 使用 NodeSource 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 验证
node -v   # 应显示 v22.x.x
npm -v    # 应显示 10.x.x
```

#### Step 3 — 安装 PostgreSQL 17

```bash
# 安装
apt install -y postgresql postgresql-contrib

# 启动 & 设置开机自启
systemctl enable postgresql
systemctl start postgresql

# 创建数据库和用户
sudo -u postgres psql <<EOF
CREATE USER memorystory WITH PASSWORD '<你的数据库密码>';
CREATE DATABASE memorystory OWNER memorystory;
\q
EOF
```

> **注意：** 将 `<你的数据库密码>` 替换为强随机密码。建议使用 `openssl rand -base64 32` 生成。

#### Step 4 — 安装 Nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

#### Step 5 — 安装 PM2（进程管理）

```bash
npm install -g pm2
pm2 startup systemd   # 设置开机自启
```

#### Step 6 — 配置防火墙

```bash
ufw allow OpenSSH        # SSH
ufw allow 'Nginx Full'   # HTTP (80) + HTTPS (443)
ufw enable

# 确认规则
ufw status verbose
```

---

### 4.2 后端部署

#### Step 1 — 克隆项目 & 配置环境变量

```bash
# 创建应用目录
mkdir -p /var/www
cd /var/www
git clone <你的仓库地址> memorystory
cd memorystory/backend

# 复制并编辑环境变量
cp ../.env.example .env
nano .env
```

生产环境 `.env` 配置：

```env
# ===== Database =====
DATABASE_URL=postgresql://memorystory:<你的数据库密码>@localhost:5432/memorystory

# ===== JWT（务必更换！）=====
JWT_ACCESS_SECRET=<用 openssl rand -base64 64 生成>
JWT_REFRESH_SECRET=<用 openssl rand -base64 64 生成>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ===== Bcrypt =====
BCRYPT_SALT_ROUNDS=12

# ===== Server =====
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=https://<你的域名>
NODE_ENV=production
```

> **关键安全项：** `JWT_ACCESS_SECRET` 和 `JWT_REFRESH_SECRET` 必须替换为强随机字符串。`NODE_ENV=production` 时，启动阶段会校验这两个值是否已设置，若为默认值则进程直接退出。

#### Step 2 — 安装依赖 & 构建

```bash
cd /var/www/memorystory/backend

# 安装依赖
npm ci --omit=dev

# 如果运行数据库迁移需要 devDependencies（一次性）：
npm install

# 运行数据库迁移
npx prisma migrate deploy

# 初始化种子数据（创建管理员账户）
npx prisma db seed

# 构建 TypeScript
npm run build

# 清理 devDependencies（可选，减小磁盘占用）
npm ci --omit=dev
```

#### Step 3 — 创建上传目录

```bash
mkdir -p /var/www/memorystory/backend/uploads
chmod 755 /var/www/memorystory/backend/uploads
```

#### Step 4 — 用 PM2 启动后端

```bash
cd /var/www/memorystory/backend

# 启动
pm2 start dist/index.js \
  --name memorystory-api \
  --cwd /var/www/memorystory/backend

# 保存 PM2 进程列表（开机自启）
pm2 save
```

验证后端运行：

```bash
pm2 status                    # 应显示 online
curl http://localhost:3001/api/posts   # 应返回 JSON
```

---

### 4.3 前端部署

#### Step 1 — 构建前端

前端 Vite 构建输出为纯静态文件（HTML + JS + CSS），无需 Node.js 运行。

```bash
cd /var/www/memorystory/frontend

# 安装依赖
npm ci

# 构建（tsc 类型检查 + Vite 打包）
npm run build
```

构建产物在 `frontend/dist/` 目录下。

#### Step 2 — 部署静态文件

```bash
# 部署到 Nginx 服务目录
cp -r /var/www/memorystory/frontend/dist/* /var/www/html/
```

> 也可以自定义路径，对应修改 Nginx 配置中的 `root` 指令即可。

---

### 4.4 Nginx 反向代理

完整配置 `/etc/nginx/sites-available/memorystory`：

```nginx
server {
    listen 80;
    server_name <你的域名>;

    # 上传文件（图片/视频）
    location /uploads/ {
        alias /var/www/memorystory/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 代理到后端 Fastify（3001 端口）
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 上传文件大小限制（后端限制 50MB）
        client_max_body_size 55m;
    }

    # 前端 SPA 静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_vary on;
}
```

启用配置：

```bash
# 创建软链接
ln -s /etc/nginx/sites-available/memorystory /etc/nginx/sites-enabled/

# 移除默认站点（可选）
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重载 Nginx
systemctl reload nginx
```

---

### 4.5 HTTPS / SSL 证书

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 自动获取 + 配置 Nginx
certbot --nginx -d <你的域名>

# 证书会自动续期（已内置 timer）
systemctl status certbot.timer
```

获取完成后 Certbot 会自动修改 Nginx 配置添加 HTTPS，重启 Nginx 生效。

---

### 4.6 日常运维命令

#### PM2 进程管理

```bash
pm2 status                  # 查看进程状态
pm2 logs memorystory-api    # 查看后端日志
pm2 restart memorystory-api # 重启后端
pm2 stop memorystory-api    # 停止后端
pm2 delete memorystory-api  # 删除进程
```

#### 更新部署

```bash
cd /var/www/memorystory
git pull

# 后端
cd backend
npm ci --omit=dev
npx prisma migrate deploy
npm run build
pm2 restart memorystory-api

# 前端
cd ../frontend
npm ci
npm run build
cp -r dist/* /var/www/html/
```

#### 数据库备份

```bash
# 手动备份
pg_dump -U memorystory memorystory > /backup/memorystory_$(date +%Y%m%d).sql

# 定时备份（推荐 crontab）
# 0 3 * * * pg_dump -U memorystory memorystory > /backup/memorystory_$(date +\%Y\%m\%d).sql
```

#### 查看磁盘占用

```bash
# 上传文件占用
du -sh /var/www/memorystory/backend/uploads/

# 清理超过 30 天的备份
find /backup/ -name "memorystory_*.sql" -mtime +30 -delete
```

---

## 5. 安全清单

部署到生产环境前，请逐项确认：

- [ ] `.env` 中 `JWT_ACCESS_SECRET` 和 `JWT_REFRESH_SECRET` 已更换为强随机值
- [ ] `.env` 中 `NODE_ENV=production`
- [ ] 数据库密码已更换为强随机值（非默认 `postgres`）
- [ ] `CORS_ORIGIN` 设置为实际域名（生产环境不使用 `*`）
- [ ] 防火墙仅开放 22 (SSH)、80 (HTTP)、443 (HTTPS)
- [ ] 后端 `PORT=3001` 绑定 `127.0.0.1`（仅本地访问，不对外暴露）
- [ ] Nginx 已配置 HTTPS（Let's Encrypt 证书）
- [ ] 上传目录 `/var/www/memorystory/backend/uploads/` 权限正确（755）
- [ ] `.env` 和 `node_modules` 不包含在 Nginx 静态文件服务路径内
- [ ] `client_max_body_size` 已在上传路径设置
- [ ] 定期备份数据库（建议每日自动备份 + 异地存储）
- [ ] 服务器时区正确：`timedatectl set-timezone Asia/Shanghai`
- [ ] PM2 已设置开机自启：`pm2 startup` + `pm2 save`
- [ ] 管理后台无公开入口（仅通过 `/admin` URL 直接访问）

---

## 附录 A：首次管理员登录

数据库种子（`prisma db seed`）默认创建的管理员账户：

| 字段 | 值 |
|------|-----|
| 用户名 | `admin` |
| 邮箱 | `admin@example.com` |
| 密码 | `admin123` |

> **⚠️ 生产环境务必在首次登录后立即修改密码！**
>
> 路径：管理后台 → 管理员设置（`/admin/profile`）→ 修改密码。

---

## 附录 B：环境变量完整参考

| 变量 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | — | ✅ |
| `JWT_ACCESS_SECRET` | Access Token 签名密钥 | — | ✅ |
| `JWT_REFRESH_SECRET` | Refresh Token 签名密钥 | — | ✅ |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `15m` | ❌ |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `7d` | ❌ |
| `BCRYPT_SALT_ROUNDS` | bcrypt 加密轮数 | `12` | ❌ |
| `PORT` | 后端监听端口 | `3001` | ❌ |
| `HOST` | 后端监听地址 | `0.0.0.0` | ❌ |
| `CORS_ORIGIN` | 允许的跨域来源 | — | ✅（生产） |
| `NODE_ENV` | 运行环境 | `development` | ✅（生产设 `production`） |

---

## 附录 C：Speedrun（全新服务器一键部署摘要）

```bash
# 1. 基础环境
apt update && apt upgrade -y && apt install -y curl git ufw nginx postgresql
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
npm install -g pm2 && pm2 startup systemd

# 2. 数据库
sudo -u postgres psql -c "CREATE USER memorystory WITH PASSWORD '<密码>';"
sudo -u postgres psql -c "CREATE DATABASE memorystory OWNER memorystory;"

# 3. 克隆项目 & 配置 .env
cd /var/www && git clone <仓库URL> memorystory
cd memorystory/backend && cp ../.env.example .env
# 编辑 .env → 填入 JWT secrets + 数据库密码 + NODE_ENV=production

# 4. 构建 & 启动后端
npm install && npx prisma migrate deploy && npx prisma db seed
npm run build && npm ci --omit=dev
mkdir -p uploads && pm2 start dist/index.js --name memorystory-api && pm2 save

# 5. 构建 & 部署前端
cd ../frontend && npm ci && npm run build && cp -r dist/* /var/www/html/

# 6. Nginx + SSL
# 创建上面的 Nginx 配置 → /etc/nginx/sites-available/memorystory
ln -s /etc/nginx/sites-available/memorystory /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d <你的域名>

# 7. 防火墙
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

---

> **部署完成后验证：**
> - 访问 `https://<你的域名>` → 显示博客首页
> - 访问 `https://<你的域名>/admin` → 跳转到登录页
> - `pm2 status` → memorystory-api 状态为 `online`
> - `systemctl status nginx postgresql` → 均为 `active (running)`
