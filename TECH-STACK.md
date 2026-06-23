# MemoryStory 技术架构

一个个人博客，用 TypeScript 写的前后端分离项目。前端 React + Vite，后端 Fastify + PostgreSQL。管理后台藏在 `/admin` 路径下，普通访客看不到入口。

---

## 🏗️ 前后端分离

| 层 | 技术 | 说明 |
|---|------|------|
| 前端 | React 19 + TypeScript + Vite 8 | SPA，构建产物纯静态文件 |
| 后端 | Fastify 5 + TypeScript + Prisma 6 | RESTful API，跑在 `127.0.0.1:3001` |
| 数据库 | PostgreSQL 17 | 通过 Prisma ORM 访问 |
| 反向代理 | Nginx | 静态文件 + API 反代 + SSL |

前端和后端完全独立部署。Nginx 把 `/api/*` 的请求转发给后端，其他请求直接返回前端静态文件。好处很直接——前后端可以各自开发、各自构建、各自替换。

### 为什么选这套

**TypeScript 全栈。** 前后端同一种语言，类型定义可以共享心智模型。后端用 Fastify 而不是 Express，主要是 JSON Schema 校验开箱即用，性能也高一个量级。

**React + Vite。** Vite 开发服务器启动不到一秒，HMR 即时生效。React 19 的 Concurrent 特性在文章页切换时避免输入卡顿。

**Tailwind CSS + Swiss Modernism。** 设计系统用 Zinc 色系，Noto Serif SC 做标题字体。不引入组件库——自己写毛玻璃卡片、骨架屏、渐变过渡，控制在手里。

**隐藏管理后台。** 导航栏没有登录按钮，只有直接访问 `/admin` 才能看到登录页。不是安全性依赖，但减少了攻击面。

---

## 🗄️ 数据库表结构

### User — 管理员

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数（自增） | 主键 |
| `username` | 字符串（最长50） | 管理员用户名，唯一 |
| `email` | 字符串（最长255） | 登录邮箱，唯一 |
| `passwordHash` | 字符串 | bcryptjs 加密（cost=12） |
| `role` | 枚举（ADMIN） | 角色，目前仅管理员 |
| `tokenVersion` | 整数 | 令牌版本号，递增后所有已发令牌失效 |
| `avatar` | 字符串（最长500，可选） | 头像 URL |

### Post — 文章

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数（自增） | 主键 |
| `title` | 字符串（最长200） | 文章标题 |
| `slug` | 字符串（最长200） | URL 友好标识，唯一，标题自动生成 |
| `content` | 长文本 | Markdown 正文 |
| `excerpt` | 字符串（最长500，可选） | 摘要 |
| `coverImage` | 字符串（可选） | 封面图 URL |
| `status` | 枚举 | `DRAFT`（草稿）或 `PUBLISHED`（已发布） |
| `tags` | 字符串数组 | PostgreSQL 原生数组，如 `["TypeScript", "React"]` |
| `viewCount` | 整数 | 浏览量，每次打开文章页 +1 |
| `likeCount` | 整数 | 点赞数，前端 localStorage 去重 |
| `authorId` | 整数 | 外键 → User |
| `createdAt` | 时间戳 | — |
| `updatedAt` | 时间戳 | 自动更新 |

### Comment — 评论（盖楼）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数（自增） | 主键 |
| `content` | 长文本 | 评论内容（纯文本，HTML 全量过滤） |
| `postId` | 整数 | 外键 → Post，级联删除 |
| `username` | 字符串（最长50） | 评论者昵称（必填） |
| `email` | 字符串（最长255，可选） | 评论者邮箱 |
| `websiteUrl` | 字符串（最长500，可选） | 评论者网站 |
| `parentId` | 整数（可选） | 自引用外键 → Comment，实现嵌套回复 |
| `createdAt` | 时间戳 | — |
| `updatedAt` | 时间戳 | 自动更新 |

用 PostgreSQL 递归 CTE 查询评论树，后端 `buildCommentTree()` 两趟 O(n) 组装成树形结构返回前端。

### Guestbook — 留言板

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数（自增） | 主键 |
| `nickname` | 字符串（最长100） | 留言者昵称 |
| `message` | 长文本 | 留言内容 |
| `createdAt` | 时间戳 | — |

### Wallpaper — 首页壁纸

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数（自增） | 主键 |
| `type` | 字符串（最长10） | `image` 或 `video` |
| `url` | 字符串（最长500） | 壁纸文件 URL |
| `updatedAt` | 时间戳 | 自动更新 |

### About — 关于我

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 整数（自增） | 主键（实际只存一行，id=1） |
| `greetingTitle` | 字符串（最长100） | 欢迎语标题 |
| `greetingContent` | 长文本（最长2000） | 欢迎语正文 |
| `aboutTitle` | 字符串（最长100） | 关于标题 |
| `aboutContent` | 长文本（最长5000） | 关于正文 |
| `email` | 字符串（最长255，可选） | 联系邮箱 |
| `github` | 字符串（最长255，可选） | GitHub 链接 |
| `location` | 字符串（最长100，可选） | 所在地 |
| `updatedAt` | 时间戳 | 自动更新 |

单行 upsert 模式 —— 始终读写 id=1 那一条。

---

## 🛡️ Web 安全

### XSS 防护

所有用户输入（评论、留言）进入数据库前，用 `xss` 库空白名单过滤 —— 任何 HTML 标签、属性、事件处理器统统剥离。纯文本存进去，纯文本读出来。Unicode 同形字攻击也一并处理。

### JWT 双令牌

`accessToken`（15分钟） + `refreshToken`（7天）。访问令牌过期后前端用刷新令牌静默换取新令牌。刷新时验证 `tokenVersion` —— 如果管理员改了密码，版本号递增，所有设备同时登出。

### 渐进式登录锁定

同一邮箱连续输错密码：
- 5 次 → 锁定 15 分钟
- 10 次 → 锁定 1 小时
- 30 分钟无操作 → 计数器归零

锁定时不做数据库查询，直接拒绝。`checkLockout()` 在查密码之前调用，避免时序侧信道泄露用户是否存在。

### 速率限制

| 端点 | 限制 |
|------|------|
| 全站 | 100 次/分钟 |
| 登录/刷新 | 5 次/分钟 |
| 留言板提交 | 3 次/分钟 |
| 评论提交 | 10 次/分钟 |
| 文件上传 | 20 次/分钟 |

基于 `@fastify/rate-limit`，内存计数，零依赖外部缓存。

### 文件上传安全

管理后台上传接口做了纵深防御：

- **MIME 校验** —— 仅允许 `image/jpeg`、`image/png`、`video/mp4`
- **扩展名白名单** —— `.jpg`、`.jpeg`、`.png`、`.mp4`
- **魔数校验** —— 读取文件头部 12 字节，比对 JPEG（`FF D8 FF`）、PNG（`89 50 4E 47`）、MP4（`ftyp`/`moov`/`moof` box）特征。伪造 `Content-Type` 直接拒绝
- **双重大小校验** —— multipart 插件层 50MB + handler 层 50MB
- **UUID 重命名** —— 上传后文件名替换为随机 UUID，防止覆盖和路径注入
- **路径遍历防护** —— 删除接口拒绝含 `/`、`\`、`.`、`..` 的文件名

### 其他

- **Helmet** 设置安全 HTTP 头（CSP、X-Frame-Options 等）
- **CORS** 仅允许自己的域名
- **Body 大小限制** 512KB，防止大 payload DoS
- **生产密钥强校验** —— `NODE_ENV=production` 时若 JWT 密钥是占位符或弱密钥，进程拒绝启动
- **bcrypt cost=12** 密码哈希
- **Prisma 参数化查询** —— 没有 SQL 拼接，没有注入
- **后端仅监听 127.0.0.1** —— 外部流量只经过 Nginx，不直接暴露 Node 进程
- **全局异常处理器** —— `uncaughtException` + `unhandledRejection` 兜底，不会静默崩溃

---

这套选型和防护措施是在开发过程中逐步累上去的，不是一次性设计。每个安全措施后面都有一个具体的攻击场景。
