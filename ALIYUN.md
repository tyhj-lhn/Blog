# MemoryStory Blog — 阿里云部署指南

> 最后更新：2026-06-21

本文档涵盖在阿里云 ECS（Ubuntu 22.04 LTS）上从零部署 MemoryStory Blog 的完整流程。

---

## 目录

- [1. 前置准备](#1-前置准备)
- [2. 阿里云控制台配置](#2-阿里云控制台配置)
- [3. 服务器环境安装](#3-服务器环境安装)
- [4. 网站部署](#4-网站部署)
- [5. 域名与 HTTPS](#5-域名与https)
- [6. 日常运维](#6-日常运维)
- [7. 故障排查](#7-故障排查)

---

## 1. 前置准备

### 1.1 你需要准备的

| 项目 | 说明 |
|------|------|
| 阿里云账号 | 已实名认证 |
| ECS 实例 | Ubuntu 22.04 LTS（推荐 2C4G 起步） |
| 域名（可选） | 已备案，DNS 解析到 ECS 公网 IP |
| SSH 客户端 | 能通过密钥或密码登录服务器 |
| Git 仓库地址 | 项目源码地址 |

### 1.2 系统要求

| 组件 | 最低版本 | 说明 |
|------|----------|------|
| CPU | 2 核 | 构建时需要 |
| 内存 | 4 GB | Node.js 构建 + PostgreSQL 运行 |
| 系统盘 | 40 GB | 系统 + 项目 + 上传文件 |
| 操作系统 | Ubuntu 22.04 LTS | `setup-server.sh` 仅支持 Debian/Ubuntu |
| 带宽 | 1 Mbps 以上 | 按量计费或固定带宽均可 |

### 1.3 费用估算（最低配）

| 产品 | 配置 | 月费用（约） |
|------|------|-------------|
| ECS | 2C4G, 40GB ESSD | ¥150–200 |
| 域名 | .com/.cn | ¥60–80 / 年 |
| SSL | Let's Encrypt | 免费 |
| 备案 | — | 免费 |

---

## 2. 阿里云控制台配置

### 2.1 创建 ECS 实例

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com) → 云服务器 ECS → 实例 → **创建实例**
2. **计费方式**：包年包月（长期运行）或按量付费（测试）
3. **地域**：选择离目标用户最近的地域
4. **镜像**：Ubuntu 22.04 LTS 64位
5. **实例规格**：2 vCPU / 4 GiB 内存（ecs.c7.large 或同类）
6. **系统盘**：40 GB ESSD 云盘
7. **网络**：分配公网 IPv4 地址，按使用流量计费
8. **安全组**：创建后配置（见下一步）
9. **登录凭证**：建议密钥对（.pem），也可用密码

### 2.2 配置安全组

进入 **安全组** → **配置规则** → 添加以下 **入方向** 规则：

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 22 | TCP | 0.0.0.0/0 | SSH |
| 80 | TCP | 0.0.0.0/0 | HTTP（Nginx） |
| 443 | TCP | 0.0.0.0/0 | HTTPS（Nginx + SSL） |

> ⚠️ **不要放行 3001 端口**（后端端口）。后端绑定 `127.0.0.1`，仅 Nginx 可访问。

### 2.3 登录服务器

```bash
# 密钥登录
ssh -i /path/to/your-key.pem root@<服务器公网IP>

# 密码登录
ssh root@<服务器公网IP>
```

### 2.4（可选）域名 DNS 解析

在域名 DNS 管理后台添加 A 记录：

| 类型 | 主机记录 | 记录值 | TTL |
|------|----------|--------|-----|
| A | @ | `<服务器公网IP>` | 600 |
| A | www | `<服务器公网IP>` | 600 |

---

## 3. 服务器环境安装

> **注意**：以下命令以 `root` 身份执行。

### 3.1 一键安装（推荐）

```bash
# 克隆项目到服务器
cd /root
git clone <你的git仓库地址> memorystory
cd memorystory

# 运行环境安装脚本
bash setup-server.sh
```

脚本将自动安装：

1. `apt` 基础包（curl, git, build-essential, ufw 等）
2. Node.js 22 LTS（通过 NodeSource 官方源）
3. PostgreSQL 17（通过官方 APT 源）
4. Nginx（latest stable）
5. PM2（全局 npm 安装 + systemd 自启）
6. ufw 防火墙（放行 SSH + Nginx Full）

### 3.2 非交互式安装

```bash
# 跳过所有确认提示
bash setup-server.sh --yes

# 预检查（不做变更）
bash setup-server.sh --dry-run
```

### 3.3 手动验证安装

```bash
node -v        # 应输出 v22.x.x
psql --version # 应输出 17.x
nginx -v       # 应输出 nginx/1.x.x
pm2 -v         # 应输出版本号
ufw status     # 应显示 Status: active，规则包含 22/tcp、80/tcp、443/tcp
```

---

## 4. 网站部署

### 4.1 一键部署（推荐）

```bash
cd /root/memorystory
bash deploy-app.sh
```

脚本将自动完成：

1. 克隆/更新项目到 `/var/www/memorystory`
2. 生成 `backend/.env`（自动生成 JWT 密钥）
3. 后端构建（`npm install` → `prisma migrate deploy` → `tsc`）
4. 生成 `ecosystem.production.config.cjs` → PM2 启动后端
5. 前端构建 → 部署到 Nginx
6. Nginx 站点配置（SPA + API 反代）
7. SSL 证书（如果有域名）
8. 最终验证

### 4.2 非交互式部署

```bash
bash deploy-app.sh \
  --yes \
  --git-repo https://github.com/你的用户名/你的仓库.git \
  --db-password 你的数据库密码
```

### 4.3 更新部署

项目需要更新时，只需重新运行部署脚本：

```bash
cd /root/memorystory
git pull origin main
bash deploy-app.sh
```

脚本自动检测为更新模式，跳过环境检查，仅重新构建和重启。

### 4.4 部署后验证

```bash
# 检查后端状态
pm2 status

# 测试 API
curl http://localhost:3001/api/posts

# 检查前端
curl -I http://localhost

# 从外网访问
curl http://<服务器公网IP>
```

---

## 5. 域名与 HTTPS

### 5.1 配置域名

编辑 `deploy-app.sh` 中的 `DOMAIN` 变量：

```bash
# 第 24 行，将空字符串改为你的域名
DOMAIN="example.com"
```

重新运行部署脚本：

```bash
bash deploy-app.sh
```

### 5.2 HTTPS / SSL 证书

脚本在检测到 `DOMAIN` 非空时，会自动：

1. 调用 certbot 获取 Let's Encrypt 免费 SSL 证书
2. 配置 Nginx HTTPS 重定向
3. 设置证书自动续期定时任务

### 5.3 手动申请证书（可选）

如果脚本自动申请失败，手动操作：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
certbot renew --dry-run  # 测试自动续期
```

---

## 6. 日常运维

### 6.1 PM2 管理后端

```bash
pm2 status                    # 查看状态
pm2 logs memorystory-backend  # 查看日志
pm2 restart memorystory-backend  # 重启后端
pm2 stop memorystory-backend     # 停止后端
pm2 save                      # 保存进程列表（重启后恢复）
```

### 6.2 Nginx 管理

```bash
nginx -t                      # 测试配置
systemctl reload nginx        # 重载配置（不中断服务）
systemctl restart nginx       # 重启 Nginx
systemctl status nginx        # 查看状态
tail -f /var/log/nginx/access.log  # 查看访问日志
```

### 6.3 PostgreSQL 管理

```bash
sudo -u postgres psql                     # 登录数据库
\l                                        # 列出所有数据库
\c memorystory                            # 切换到项目数据库
\dt                                       # 列出所有表
SELECT count(*) FROM "Post";              # 文章总数
```

### 6.4 备份

```bash
# 数据库备份
pg_dump -U memorystory memorystory > backup_$(date +%Y%m%d).sql

# 上传文件备份
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/www/memorystory/backend/uploads/

# 设置定时备份（crontab -e）
0 3 * * * pg_dump -U memorystory memorystory > /root/backups/db_$(date +\%Y\%m\%d).sql
```

### 6.5 监控

```bash
# 磁盘空间
df -h

# 内存
free -h

# PM2 实时监控
pm2 monit

# 日志实时监控
pm2 logs memorystory-backend --lines 100
```

---

## 7. 故障排查

### 7.1 后端无法启动

```bash
# 查看 PM2 日志
pm2 logs memorystory-backend --err --lines 50

# 常见原因：
# 1. 数据库连接失败 — 检查 PostgreSQL 状态：systemctl status postgresql
# 2. JWT 密钥为弱密钥 — 用 openssl rand -base64 64 生成强密钥
# 3. 端口被占用 — lsof -i :3001
```

### 7.2 前端显示 502 Bad Gateway

```bash
# 检查后端是否运行
pm2 status
curl http://127.0.0.1:3001/api/posts

# 如果后端正常，检查 Nginx 反代配置
cat /etc/nginx/sites-enabled/memorystory
nginx -t && systemctl reload nginx
```

### 7.3 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
systemctl status postgresql

# 检查数据库是否存在
sudo -u postgres psql -c "\l" | grep memorystory

# 检查 .env 中的 DATABASE_URL 是否正确
cat /var/www/memorystory/backend/.env | grep DATABASE_URL
```

### 7.4 Nginx 端口冲突

阿里云 ECS 某些镜像默认安装了 Apache 占用 80 端口：

```bash
# 检查是否有其他服务占用 80 端口
lsof -i :80

# 如果有 Apache，卸载
apt remove apache2 -y

# 重装 Nginx
apt install nginx -y
```

---

## 附录

### A. 推荐阿里云配套产品

| 产品 | 用途 | 是否必需 |
|------|------|----------|
| ECS 云服务器 | 部署网站 | ✅ 必需 |
| 域名 + DNS 解析 | 绑定域名 | 建议 |
| SSL 证书 | Let's Encrypt 免费 | 建议 |
| 对象存储 OSS | 存放上传图片/视频 | 可选（高流量时建议） |
| CDN | 加速静态资源 | 可选 |
| 云监控 | 服务器监控告警 | 建议 |

### B. 项目文件结构（服务器端）

```
/var/www/memorystory/
├── backend/
│   ├── .env                   # 生产环境配置（chmod 600）
│   ├── dist/                  # 编译产物
│   ├── logs/                  # PM2 日志
│   ├── uploads/               # 用户上传文件
│   └── node_modules/
├── frontend/
│   ├── dist/                  # Vite 构建产物
│   └── node_modules/
├── ecosystem.production.config.cjs  # PM2 生产配置
├── setup-server.sh
└── deploy-app.sh

/etc/nginx/sites-enabled/
└── memorystory                # Nginx 站点配置

/var/www/html/                 # Nginx 根目录（前端静态文件）
├── index.html
└── assets/
```
