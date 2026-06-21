#!/usr/bin/env bash
# ───────────────────────────────────────────────
#  MemoryStory Blog — 网站部署脚本
#  Ubuntu / Debian 服务器（需先运行 setup-server.sh）
#
#  用法:
#    bash deploy-app.sh                                  # 交互式
#    bash deploy-app.sh --yes                            # 跳过确认
#    bash deploy-app.sh --dry-run                        # 干运行（仅检查）
#    bash deploy-app.sh --yes --git-repo <url> --db-password <pw>
#    bash deploy-app.sh --help                           # 查看帮助
#
#  域名说明:
#    当前使用公网 IP 访问（无需域名）。
#    以后有域名时，修改下方 DOMAIN 变量并重新运行即可。
# ───────────────────────────────────────────────
set -euo pipefail

# ═══════════════════════════════════════════════
#  ★ 域名配置（有域名后修改此处，重新运行脚本）
# ═══════════════════════════════════════════════
#  留空 = 使用公网 IP 访问（HTTP）
#  填写 = 使用域名访问（HTTPS + Let's Encrypt）
DOMAIN=""
# ═══════════════════════════════════════════════

# 全局变量 & 默认值
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_VERSION="2.0.0"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# 用户可配置
GIT_REPO=""
DB_PASSWORD=""
PROJECT_DIR="/var/www/memorystory"
CERT_EMAIL=""          # 有域名后才需要

# 数据库连接
DB_USER="memorystory"
DB_NAME="memorystory"

# Nginx
NGINX_HTML_ROOT="/var/www/html"
NGINX_SITE_NAME="memorystory"

# 自动检测 / 自动生成
SERVER_IP=""           # 自动获取公网 IP
JWT_ACCESS_SECRET=""
JWT_REFRESH_SECRET=""

# 模式标志
DRY_RUN=false
SKIP_CONFIRM=false
IS_UPDATE=false        # 检测是否为更新部署

# ───────────────────────────────────────────────
#  颜色定义
# ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ═══════════════════════════════════════════════
#  Trap handlers
# ═══════════════════════════════════════════════

on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 && $exit_code -ne 130 ]]; then
        echo ""
        warn "脚本以退出码 $exit_code 结束。已完成步骤不会重复执行。"
    fi
}

on_error() {
    local line=$1
    local cmd=$2
    error "第 ${line} 行执行失败: ${cmd}"
    if $DRY_RUN; then
        info "(干运行模式，未做实际变更)"
    fi
    exit 1
}

on_interrupt() {
    echo ""
    warn "被用户中断 (Ctrl+C)。已完成步骤不会重复执行。"
    exit 130
}

trap 'on_error ${LINENO} "${BASH_COMMAND}"' ERR
trap 'on_exit' EXIT
trap 'on_interrupt' SIGINT SIGTERM

# ═══════════════════════════════════════════════
#  工具函数
# ═══════════════════════════════════════════════

print_banner() {
    echo ""
    echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║${NC}     ${BOLD}MemoryStory Blog — 网站部署${NC}                    ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}║${NC}     v${SCRIPT_VERSION}  |  ${TIMESTAMP}               ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    if $IS_UPDATE; then
        echo -e "   ${BLUE}检测到已有部署，将执行更新模式。${NC}"
    fi
    echo ""
}

success() { echo -e "   ${GREEN}✓${NC} $1"; }
warn()    { echo -e "   ${YELLOW}⚠${NC} $1"; }
error()   { echo -e "   ${RED}✗${NC} $1" >&2; }
info()    { echo -e "   ${BLUE}ℹ${NC} $1"; }
detail()  { echo -e "     $1"; }

header() {
    echo ""
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════${NC}"
    echo ""
}

confirm() {
    local prompt="${1:-是否继续？}"
    local default="${2:-y}"

    if $DRY_RUN; then
        info "[干运行] 跳过确认: ${prompt}"
        return 0
    fi

    if $SKIP_CONFIRM; then
        return 0
    fi

    local yn
    if [[ "$default" == "y" ]]; then
        read -r -p "   ❓ ${prompt} [Y/n]: " yn
        [[ -z "$yn" || "$yn" =~ ^[Yy] ]]
    else
        read -r -p "   ❓ ${prompt} [y/N]: " yn
        [[ "$yn" =~ ^[Yy] ]]
    fi
}

run_cmd() {
    local description="$1"
    shift
    if $DRY_RUN; then
        info "[干运行] ${description}"
        detail "→ $*"
        return 0
    fi
    info "${description}..."
    "$@"
}

prompt_required() {
    local prompt="$1"
    local default="${2:-}"
    local value=""
    while [[ -z "$value" ]]; do
        if [[ -n "$default" ]]; then
            read -r -p "   ❓ ${prompt} [${default}]: " value
            value="${value:-$default}"
        else
            read -r -p "   ❓ ${prompt}: " value
        fi
    done
    echo "$value"
}

prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local value=""
    read -r -p "   ❓ ${prompt} [${default}]: " value
    echo "${value:-$default}"
}

# ───────────────────────────────────────────────
#  密钥 & 密码生成
# ───────────────────────────────────────────────

generate_secret() {
    openssl rand -base64 64 2>/dev/null | tr -d '\n' || {
        cat /dev/urandom | tr -dc 'a-zA-Z0-9+/' | head -c 88
    }
}

# ───────────────────────────────────────────────
#  公网 IP 检测
# ───────────────────────────────────────────────

detect_public_ip() {
    local ip=""
    for src in \
        "https://api.ipify.org" \
        "https://ifconfig.me" \
        "https://icanhazip.com" \
        "https://checkip.amazonaws.com"; do
        ip=$(curl -s --max-time 5 "$src" 2>/dev/null) || true
        if [[ -n "$ip" && "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "$ip"
            return 0
        fi
    done
    return 1
}

# ═══════════════════════════════════════════════
#  CLI 参数解析
# ═══════════════════════════════════════════════

print_usage() {
    echo ""
    echo "用法: bash deploy-app.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h               显示此帮助信息"
    echo "  --dry-run                干运行 — 仅检查前置条件"
    echo "  --yes, -y                跳过所有确认提示（非交互式）"
    echo ""
    echo "  --git-repo <url>         Git 仓库地址（必填）"
    echo "  --db-password <pw>       数据库密码（必填）"
    echo "  --project-dir <path>     项目目录（默认 /var/www/memorystory）"
    echo "  --domain <domain>        域名（有域名后使用，默认用公网 IP）"
    echo "  --cert-email <email>     Let's Encrypt 邮箱（有域名后使用）"
    echo ""
    echo "部署步骤:"
    echo "  1.  克隆 / 更新项目代码"
    echo "  2.  配置生产环境变量 (.env)"
    echo "  3.  后端构建 (npm install → prisma → tsc)"
    echo "  4.  PM2 启动 / 重启后端"
    echo "  5.  前端构建 (npm ci → vite build)"
    echo "  6.  Nginx 站点配置（IP / 域名模式）"
    echo "  7.  SSL 证书（仅域名模式）"
    echo "  8.  最终验证"
    echo ""
    echo "示例:"
    echo "  bash deploy-app.sh                           # 交互式"
    echo "  bash deploy-app.sh --yes \\"
    echo "    --git-repo https://github.com/user/repo.git \\"
    echo "    --db-password 'your-db-password'"
    echo "  bash deploy-app.sh --dry-run                  # 仅检查"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help|-h)
                print_usage
                exit 0
                ;;
            --dry-run)
                DRY_RUN=true
                ;;
            --yes|-y)
                SKIP_CONFIRM=true
                ;;
            --git-repo)
                GIT_REPO="$2"
                shift
                ;;
            --db-password)
                DB_PASSWORD="$2"
                shift
                ;;
            --project-dir)
                PROJECT_DIR="$2"
                shift
                ;;
            --domain)
                DOMAIN="$2"
                shift
                ;;
            --cert-email)
                CERT_EMAIL="$2"
                shift
                ;;
            *)
                error "未知参数: $1"
                print_usage
                exit 1
                ;;
        esac
        shift
    done
}

# ═══════════════════════════════════════════════
#  前置条件检查
# ═══════════════════════════════════════════════

check_result() {
    local status="$1"
    local label="$2"
    local hint="${3:-}"
    if [[ "$status" == "pass" ]]; then
        echo -e "   ${GREEN}[✓]${NC} ${label}"
        return 0
    elif [[ "$status" == "warn" ]]; then
        echo -e "   ${YELLOW}[!]${NC} ${label}"
        [[ -n "$hint" ]] && echo -e "       → ${hint}"
        return 0
    else
        echo -e "   ${RED}[✗]${NC} ${label}"
        [[ -n "$hint" ]] && echo -e "       → ${hint}"
        return 1
    fi
}

is_root_or_sudo() {
    [[ $EUID -eq 0 ]] && return 0
    command -v sudo &>/dev/null && sudo -v &>/dev/null && return 0
    return 1
}

is_debian_based() {
    [[ -f /etc/os-release ]] && source /etc/os-release
    [[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" || "${ID_LIKE:-}" == *"debian"* ]]
}

check_nodejs()          { command -v node &>/dev/null && node -v 2>/dev/null | grep -qE 'v(2[2-9]|[3-9][0-9])' && echo "pass" || echo "fail"; }
check_postgresql()      { command -v psql &>/dev/null && pg_isready -q 2>/dev/null && echo "pass" || echo "fail"; }
check_nginx()           { command -v nginx &>/dev/null && echo "pass" || echo "fail"; }
check_pm2()             { command -v pm2 &>/dev/null && echo "pass" || echo "fail"; }
check_git()             { command -v git &>/dev/null && echo "pass" || echo "fail"; }
check_certbot()         { command -v certbot &>/dev/null && echo "pass" || echo "fail"; }

check_project_cloned()  { [[ -d "$PROJECT_DIR/.git" ]] && echo "pass" || echo "fail"; }
check_env_configured()  { [[ -f "$PROJECT_DIR/backend/.env" ]] && grep -q "^NODE_ENV=production" "$PROJECT_DIR/backend/.env" 2>/dev/null && echo "pass" || echo "fail"; }
check_backend_built()   { [[ -f "$PROJECT_DIR/backend/dist/index.js" ]] && echo "pass" || echo "fail"; }
check_pm2_running()     { pm2 jlist 2>/dev/null | grep -q "memorystory-backend" && echo "pass" || echo "fail"; }
check_frontend_built()  { [[ -f "${NGINX_HTML_ROOT}/index.html" ]] && echo "pass" || echo "fail"; }
check_nginx_site()      { [[ -f "/etc/nginx/sites-enabled/${NGINX_SITE_NAME}" ]] && echo "pass" || echo "fail"; }
check_ssl_cert()        { [[ -n "$DOMAIN" && -d "/etc/letsencrypt/live/${DOMAIN}" ]] && echo "pass" || echo "fail"; }

run_prerequisite_checks() {
    header "前置条件检查"

    local total=0 pass=0 fail=0

    check_one() {
        local result
        result=$("$1")
        total=$((total + 1))
        if [[ "$result" == "pass" ]]; then
            pass=$((pass + 1))
        else
            fail=$((fail + 1))
        fi
        check_result "$result" "$2" "${3:-}"
    }

    check_one is_root_or_sudo       "Root 或 sudo 权限"       "请以 root 运行或配置 sudo"
    check_one check_nodejs          "Node.js ≥ 22"            "请先运行 bash setup-server.sh"
    check_one check_postgresql      "PostgreSQL (运行中)"     "请先运行 bash setup-server.sh"
    check_one check_nginx           "Nginx"                   "请先运行 bash setup-server.sh"
    check_one check_pm2             "PM2"                     "请先运行 bash setup-server.sh"
    check_one check_git             "Git"                     "apt install git"

    if $IS_UPDATE; then
        check_one check_project_cloned "项目已克隆"
        check_one check_env_configured "生产 .env 已配置"
        check_one check_backend_built  "后端已构建"
    fi

    echo ""
    echo -e "   ${BOLD}总计: ${total}  就绪: ${GREEN}${pass}${NC}  未就绪: ${YELLOW}${fail}${NC}${NC}"
    echo ""

    return 0
}

# ═══════════════════════════════════════════════
#  Nginx 配置生成
# ═══════════════════════════════════════════════

determine_server_name() {
    if [[ -n "$DOMAIN" ]]; then
        echo "$DOMAIN"
        return
    fi

    if [[ -z "$SERVER_IP" ]]; then
        info "正在检测服务器公网 IP..."
        SERVER_IP=$(detect_public_ip) || true
        if [[ -z "$SERVER_IP" ]]; then
            warn "无法自动获取公网 IP。"
            SERVER_IP=$(prompt_required "请输入服务器公网 IP 地址")
        fi
        detail "公网 IP: ${SERVER_IP}"
    fi

    echo "${SERVER_IP}"
}

generate_nginx_config() {
    local server_name="$1"
    local use_ssl="${2:-false}"

    if $use_ssl; then
        cat << NGINXEOF
# MemoryStory Blog — Nginx 配置（HTTPS）
# 由 deploy-app.sh 自动生成 — $(date '+%Y-%m-%d %H:%M:%S')

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name ${server_name};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${server_name};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 上传文件（图片/视频）— 长时间缓存
    location /uploads/ {
        alias ${PROJECT_DIR}/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 代理到后端 Fastify (:3001)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 55m;
    }

    # SPA 前端静态文件
    location / {
        root ${NGINX_HTML_ROOT};
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_vary on;
}
NGINXEOF
    else
        cat << NGINXEOF
# MemoryStory Blog — Nginx 配置（HTTP）
# 由 deploy-app.sh 自动生成 — $(date '+%Y-%m-%d %H:%M:%S')
# ★ 有域名后，修改脚本开头 DOMAIN 变量，重新运行即可切换 HTTPS

server {
    listen 80;
    server_name ${server_name};

    # 上传文件（图片/视频）— 长时间缓存
    location /uploads/ {
        alias ${PROJECT_DIR}/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # API 代理到后端 Fastify (:3001)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 55m;
    }

    # SPA 前端静态文件
    location / {
        root ${NGINX_HTML_ROOT};
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;
    gzip_vary on;
}
NGINXEOF
    fi
}

# ═══════════════════════════════════════════════
#  分步部署函数
# ═══════════════════════════════════════════════

step_clone_project() {
    header "步骤 1/8: 获取项目代码"

    if [[ -z "$GIT_REPO" ]]; then
        warn "未提供 Git 仓库 URL，跳过。"
        return 0
    fi

    if check_project_cloned | grep -q pass; then
        success "项目已存在于 ${PROJECT_DIR}"
        IS_UPDATE=true

        info "当前分支: $(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

        if confirm "是否备份本地修改并拉取最新代码？" "y"; then
            local stash_needed=false
            if [[ -n $(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null) ]]; then
                stash_needed=true
                run_cmd "备份本地修改 (git stash)" git -C "$PROJECT_DIR" stash -u
            fi

            run_cmd "拉取最新代码" git -C "$PROJECT_DIR" pull

            if $stash_needed; then
                info "本地修改已备份到 git stash。恢复: git -C ${PROJECT_DIR} stash pop"
            fi
        fi
        return 0
    fi

    info "将克隆仓库到: ${PROJECT_DIR}"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    local parent_dir
    parent_dir=$(dirname "$PROJECT_DIR")
    run_cmd "创建父目录" mkdir -p "$parent_dir"
    run_cmd "克隆仓库" git clone "$GIT_REPO" "$PROJECT_DIR"

    success "步骤 1 完成。"
}

step_configure_env() {
    header "步骤 2/8: 配置生产环境变量"

    if [[ ! -d "$PROJECT_DIR" ]]; then
        warn "项目目录 ${PROJECT_DIR} 不存在，跳过。"
        return 0
    fi

    local env_file="$PROJECT_DIR/backend/.env"
    local example_file="$PROJECT_DIR/.env.example"

    # 如果是更新且 .env 已配置，跳过
    if check_env_configured | grep -q pass; then
        success "生产环境 .env 已配置。"
        if $IS_UPDATE; then
            detail "更新模式：保留现有配置不变。"
            return 0
        fi
        if confirm "是否重新生成 .env（会覆盖现有配置）？" "n"; then
            cp "$env_file" "${env_file}.bak.$(date +%Y%m%d%H%M%S)"
            detail "已备份旧 .env"
        else
            return 0
        fi
    fi

    # 自动生成密钥
    info "正在生成安全密钥..."
    JWT_ACCESS_SECRET=$(generate_secret)
    JWT_REFRESH_SECRET=$(generate_secret)

    if ! $DRY_RUN; then
        # 确定 CORS origin
        local cors_origin=""
        if [[ -n "$DOMAIN" ]]; then
            cors_origin="https://${DOMAIN}"
        elif [[ -n "$SERVER_IP" ]]; then
            cors_origin="http://${SERVER_IP}"
        else
            cors_origin="http://localhost:5173"
        fi

        if [[ -f "$example_file" ]]; then
            cp "$example_file" "$env_file"
        else
            # 无模板时生成最小化配置
            cat > "$env_file" << EOF
# MemoryStory Blog — 生产环境配置
# 由 deploy-app.sh 生成 — $(date '+%Y-%m-%d %H:%M:%S')
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
DATABASE_URL=postgresql://memorystory:CHANGEME@localhost:5432/memorystory
JWT_ACCESS_SECRET=CHANGEME
JWT_REFRESH_SECRET=CHANGEME
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
EOF
        fi

        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}|" "$env_file"
        sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}|" "$env_file"
        sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "$env_file"
        sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$env_file"
        sed -i "s|^HOST=.*|HOST=127.0.0.1|" "$env_file"
        sed -i "s|^PORT=.*|PORT=3001|" "$env_file"
        sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${cors_origin}|" "$env_file"
        sed -i "s|^BCRYPT_SALT_ROUNDS=.*|BCRYPT_SALT_ROUNDS=12|" "$env_file"

        # 移除 docker-compose 专用变量 & 非生产变量
        sed -i '/^POSTGRES_USER=/d' "$env_file"
        sed -i '/^POSTGRES_PASSWORD=/d' "$env_file"
        sed -i '/^POSTGRES_DB=/d' "$env_file"
        sed -i '/^DB_PORT=/d' "$env_file"
        sed -i '/^FRONTEND_PORT=/d' "$env_file"

        chmod 600 "$env_file"
    fi

    echo ""
    echo -e "   ${BOLD}════════ 重要 ════════${NC}"
    echo -e "   ${YELLOW}以下密钥仅在本次显示，请妥善保存！${NC}"
    echo ""
    detail "JWT_ACCESS_SECRET:  ${JWT_ACCESS_SECRET}"
    detail "JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}"
    echo ""
    detail "以上值已写入 ${env_file} (权限 600)"
    echo -e "   ${BOLD}════════════════════════${NC}"
    echo ""

    success "步骤 2 完成。"
}

step_backend_build() {
    header "步骤 3/8: 后端构建"

    if [[ ! -d "$PROJECT_DIR/backend" ]]; then
        warn "后端目录 ${PROJECT_DIR}/backend 不存在，跳过。"
        return 0
    fi

    if check_backend_built | grep -q pass && ! $IS_UPDATE; then
        success "后端已构建 (dist/index.js 存在)。"
        if ! confirm "是否重新构建？" "n"; then
            return 0
        fi
    fi

    info "将执行: npm install → prisma generate → prisma migrate → prisma seed → tsc → npm prune"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "安装依赖" \
        bash -c "cd '$PROJECT_DIR/backend' && npm install"

    run_cmd "生成 Prisma Client (关键 — 确保引擎二进制匹配当前平台)" \
        bash -c "cd '$PROJECT_DIR/backend' && npx prisma generate"

    run_cmd "运行数据库迁移" \
        bash -c "cd '$PROJECT_DIR/backend' && npx prisma migrate deploy"

    run_cmd "初始化种子数据" \
        bash -c "cd '$PROJECT_DIR/backend' && npx prisma db seed" || {
            warn "种子数据初始化失败（可能已有数据）；继续..."
        }

    run_cmd "编译 TypeScript" \
        bash -c "cd '$PROJECT_DIR/backend' && npm run build"

    run_cmd "清理开发依赖" \
        bash -c "cd '$PROJECT_DIR/backend' && npm prune --production"

    run_cmd "创建 uploads 目录" \
        bash -c "mkdir -p '$PROJECT_DIR/backend/uploads' && chmod 755 '$PROJECT_DIR/backend/uploads'"

    run_cmd "创建 logs 目录" \
        bash -c "mkdir -p '$PROJECT_DIR/backend/logs' && chmod 755 '$PROJECT_DIR/backend/logs'"

    success "步骤 3 完成。"
}

step_backend_pm2() {
    header "步骤 4/8: PM2 启动后端"

    if [[ ! -f "$PROJECT_DIR/backend/dist/index.js" ]]; then
        warn "未找到 dist/index.js，请先完成步骤 3。"
        return 0
    fi

    local pm2_config="$PROJECT_DIR/ecosystem.production.config.cjs"
    info "生成生产 PM2 配置: ${pm2_config}"

    if ! $DRY_RUN; then
        local db_url jwt_access jwt_refresh cors_origin
        db_url=$(grep "^DATABASE_URL=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "")
        jwt_access=$(grep "^JWT_ACCESS_SECRET=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "$JWT_ACCESS_SECRET")
        jwt_refresh=$(grep "^JWT_REFRESH_SECRET=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "$JWT_REFRESH_SECRET")

        if [[ -n "$DOMAIN" ]]; then
            cors_origin="https://${DOMAIN}"
        elif [[ -n "$SERVER_IP" ]]; then
            cors_origin="http://${SERVER_IP}"
        else
            cors_origin="http://localhost"
        fi

        cat > "$pm2_config" << PM2EOF
// 由 deploy-app.sh 自动生成 — $(date '+%Y-%m-%d %H:%M:%S')
// 生产环境 PM2 配置 — 勿手动编辑
module.exports = {
  apps: [
    {
      name: 'memorystory-backend',
      cwd: '${PROJECT_DIR}/backend',
      script: 'dist/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOST: '127.0.0.1',
        DATABASE_URL: '${db_url}',
        JWT_ACCESS_SECRET: '${jwt_access}',
        JWT_REFRESH_SECRET: '${jwt_refresh}',
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        BCRYPT_SALT_ROUNDS: '12',
        CORS_ORIGIN: '${cors_origin}',
      },
      // 日志
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 重启策略
      // min_uptime: 进程必须存活 ≥10s 才算"稳定"（防止 DB 重试循环绕过 unstable 计数）
      // max_restarts: 10 次不稳定重启后停止，避免无限重启填满磁盘日志
      // restart_delay: 每次重启间隔 5s，给数据库恢复留出时间
      min_uptime: 10000,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '300M',
      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 15000,
    },
  ],
};
PM2EOF
        chmod 600 "$pm2_config"
    fi

    if check_pm2_running | grep -q pass; then
        success "PM2 后端进程已在运行。"
        if $IS_UPDATE || confirm "是否重启后端？" "y"; then
            run_cmd "重启后端" pm2 restart memorystory-backend
            success "后端已重启。"
        fi
    else
        confirm "启动后端？" || { warn "已跳过。"; return 0; }
        run_cmd "启动 PM2 后端" pm2 start "$pm2_config"
    fi

    run_cmd "保存 PM2 进程列表" pm2 save

    sleep 3
    info "验证后端健康状态..."
    if curl -sf http://127.0.0.1:3001/api/posts > /dev/null 2>&1; then
        success "后端 API 响应正常。"
    else
        warn "后端未能就绪。以下是最新的错误日志:"
        echo ""
        pm2 logs memorystory-backend --lines 20 --nostream 2>/dev/null || true
        echo ""
        detail "排查建议:"
        detail "  1. 手动启动看完整报错: cd ${PROJECT_DIR}/backend && node dist/index.js"
        detail "  2. 检查 DB 连通性: psql -U ${DB_USER} -d ${DB_NAME} -h localhost -c 'SELECT 1'"
        detail "  3. 确认 Prisma Client 已生成: ls node_modules/.prisma/client/"
        detail "  4. 查看完整 PM2 日志: pm2 logs memorystory-backend --lines 50"
    fi

    success "步骤 4 完成。"
}

step_frontend_build() {
    header "步骤 5/8: 前端构建"

    if [[ ! -d "$PROJECT_DIR/frontend" ]]; then
        warn "前端目录 ${PROJECT_DIR}/frontend 不存在，跳过。"
        return 0
    fi

    if check_frontend_built | grep -q pass && ! $IS_UPDATE; then
        success "前端已部署。"
        if ! confirm "是否重新构建？" "n"; then
            return 0
        fi
    fi

    info "将执行: npm ci → vite build → 部署到 Nginx"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "安装前端依赖" \
        bash -c "cd '$PROJECT_DIR/frontend' && npm ci"

    run_cmd "构建前端" \
        bash -c "cd '$PROJECT_DIR/frontend' && npm run build"

    # 备份旧文件
    if [[ -d "$NGINX_HTML_ROOT" ]] && [[ -n "$(ls -A "$NGINX_HTML_ROOT" 2>/dev/null)" ]]; then
        run_cmd "备份旧静态文件" \
            bash -c "sudo cp -r '$NGINX_HTML_ROOT' '${NGINX_HTML_ROOT}.bak.$(date +%Y%m%d%H%M%S)' 2>/dev/null || true"
    fi

    run_cmd "部署静态文件到 Nginx" \
        bash -c "sudo rm -rf '$NGINX_HTML_ROOT'/* 2>/dev/null; sudo cp -r '$PROJECT_DIR/frontend/dist/'* '$NGINX_HTML_ROOT/'"

    success "步骤 5 完成。"
}

step_nginx_config() {
    header "步骤 6/8: Nginx 站点配置"

    local server_name
    server_name=$(determine_server_name)

    local site_config="/etc/nginx/sites-available/${NGINX_SITE_NAME}"

    if check_nginx_site | grep -q pass && ! $IS_UPDATE; then
        success "Nginx 站点配置已存在。"
        if ! confirm "是否覆盖？" "n"; then
            return 0
        fi
    fi

    local mode_label
    if [[ -n "$DOMAIN" ]]; then
        mode_label="域名 + HTTPS"
    else
        mode_label="公网 IP (HTTP)"
    fi

    info "Nginx server_name: ${server_name}"
    info "模式: ${mode_label}"

    confirm "创建 Nginx 配置？" || { warn "已跳过。"; return 0; }

    if ! $DRY_RUN; then
        generate_nginx_config "$server_name" false | sudo tee "$site_config" > /dev/null
    fi

    run_cmd "创建站点软链接" sudo ln -sf "$site_config" "/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"

    if [[ -f /etc/nginx/sites-enabled/default ]]; then
        run_cmd "移除默认站点配置" sudo rm -f /etc/nginx/sites-enabled/default
    fi

    run_cmd "测试 Nginx 配置" sudo nginx -t
    run_cmd "重载 Nginx" sudo systemctl reload nginx

    success "步骤 6 完成。"

    # 域名提示
    if [[ -z "$DOMAIN" ]]; then
        echo ""
        echo -e "   ${YELLOW}════════ 域名提醒 ════════${NC}"
        echo -e "   ${YELLOW}当前使用公网 IP 访问，未配置 SSL。${NC}"
        echo -e "   ${YELLOW}有域名后，只需两步:${NC}"
        detail "1. 编辑 deploy-app.sh 顶部 DOMAIN=\"你的域名\""
        detail "2. 重新运行: bash deploy-app.sh"
        detail "   脚本将自动切换为 HTTPS + Let's Encrypt"
        echo -e "   ${YELLOW}════════════════════════════${NC}"
        echo ""
    fi
}

step_ssl() {
    header "步骤 7/8: SSL 证书 (Let's Encrypt)"

    if [[ -z "$DOMAIN" ]]; then
        info "未配置域名，跳过 SSL（IP 模式下无法申请证书）。"
        return 0
    fi

    if check_ssl_cert | grep -q pass; then
        success "SSL 证书已存在: /etc/letsencrypt/live/${DOMAIN}/"
        info "验证自动续期状态..."
        if systemctl is-active certbot.timer &>/dev/null; then
            success "certbot 自动续期 timer 已激活。"
        else
            run_cmd "启动 certbot timer" sudo systemctl enable --now certbot.timer
        fi
        return 0
    fi

    info "将通过 Let's Encrypt 获取免费 SSL 证书"
    warn "请确保域名 ${DOMAIN} 已解析到此服务器的 IP 地址！"
    confirm "继续？" || { warn "已跳过 SSL 配置。"; return 0; }

    if ! check_certbot | grep -q pass; then
        run_cmd "安装 certbot" apt install -y certbot python3-certbot-nginx
    fi

    if [[ -z "$CERT_EMAIL" ]]; then
        CERT_EMAIL="admin@${DOMAIN}"
    fi

    info "正在申请 SSL 证书 (${DOMAIN})..."
    if ! $DRY_RUN; then
        if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$CERT_EMAIL" 2>&1; then
            success "SSL 证书已获取并配置。"
            run_cmd "启用 certbot 自动续期" sudo systemctl enable --now certbot.timer
        else
            warn "SSL 证书获取失败（DNS 可能尚未生效）。"
            warn "请稍后手动运行:"
            detail "  sudo certbot --nginx -d ${DOMAIN}"
        fi
    fi

    success "步骤 7 完成。"
}

step_verify() {
    header "步骤 8/8: 最终验证"

    echo ""
    echo -e "   ${BOLD}部署验证报告 — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo "   ─────────────────────────────────────────"

    local ok=true

    _check() {
        local label="$1"; shift
        local result
        result=$("$1" 2>/dev/null || echo "fail")
        if [[ "$result" == "pass" ]]; then
            echo -e "   ${GREEN}✓${NC} ${label}"
        elif [[ "$result" == "warn" ]]; then
            echo -e "   ${YELLOW}⚠${NC} ${label}"
            ok=false
        else
            echo -e "   ${RED}✗${NC} ${label}"
            ok=false
        fi
    }

    _check "PostgreSQL 运行"       check_postgresql
    _check "Nginx 运行"            check_nginx
    _check "PM2 已安装"            check_pm2
    _check "项目已克隆"            check_project_cloned
    _check "生产 .env 已配置"      check_env_configured
    _check "后端已构建"            check_backend_built
    _check "PM2 后端运行中"        check_pm2_running
    _check "前端已部署"            check_frontend_built
    _check "Nginx 站点已配置"      check_nginx_site
    if [[ -n "$DOMAIN" ]]; then
        _check "SSL 证书"          check_ssl_cert
    fi

    echo "   ─────────────────────────────────────────"
    echo ""

    if $ok; then
        success "所有检查通过！"
    else
        warn "部分检查未通过，请检查上述标记项。"
    fi

    # 访问地址
    local site_url
    if [[ -n "$DOMAIN" ]]; then
        site_url="https://${DOMAIN}"
    elif [[ -n "$SERVER_IP" ]]; then
        site_url="http://${SERVER_IP}"
    else
        site_url="http://<服务器IP>"
    fi

    echo ""
    echo -e "   ${BOLD}════════════════════════════════════════${NC}"
    echo -e "   ${GREEN}博客地址:  ${site_url}${NC}"
    echo -e "   ${GREEN}管理后台:  ${site_url}/admin${NC}"
    echo ""
    echo -e "   ${BOLD}默认管理员账户:${NC}"
    echo -e "     邮箱:    admin@example.com"
    echo -e "     密码:    admin123"
    echo -e "   ${RED}请立即登录管理后台修改密码！${NC}"
    echo -e "     路径: /admin/profile → 修改密码"
    echo ""
    echo -e "   ${BOLD}运维命令:${NC}"
    echo -e "     pm2 status                     查看进程状态"
    echo -e "     pm2 logs memorystory-backend   查看后端日志"
    echo -e "     pm2 restart memorystory-backend 重启后端"
    echo ""
    if [[ -z "$DOMAIN" ]]; then
        echo -e "   ${YELLOW}提示: 有域名后，修改脚本 DOMAIN 变量并重新运行即可。${NC}"
        echo ""
    fi
    echo -e "   ${BOLD}════════════════════════════════════════${NC}"
    echo ""

    success "步骤 8 完成。"
}

# ═══════════════════════════════════════════════
#  交互式输入收集
# ═══════════════════════════════════════════════

collect_inputs() {
    echo ""
    echo -e "   ${BOLD}请输入以下部署信息:${NC}"
    echo ""

    # Git 仓库
    if [[ -z "$GIT_REPO" ]]; then
        GIT_REPO=$(prompt_required "Git 仓库地址 (如 https://github.com/user/repo.git)")
    else
        info "Git 仓库: ${GIT_REPO} (来自命令行参数)"
    fi

    # 数据库密码
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(prompt_required "数据库密码 (setup-server.sh 输出的密码)")
    else
        info "数据库密码: *** (来自命令行参数)"
    fi

    # 域名（可选）
    if [[ -z "$DOMAIN" ]]; then
        DOMAIN=$(prompt_with_default "域名 (留空使用公网 IP)" "")
    fi

    # 项目目录
    PROJECT_DIR=$(prompt_with_default "项目安装目录" "$PROJECT_DIR")

    # 公网 IP（无域名时）
    if [[ -z "$DOMAIN" ]]; then
        info "正在检测公网 IP..."
        SERVER_IP=$(detect_public_ip) || true
        if [[ -n "$SERVER_IP" ]]; then
            detail "检测到公网 IP: ${SERVER_IP}"
            SERVER_IP=$(prompt_with_default "确认公网 IP（用于 Nginx 配置）" "$SERVER_IP")
        else
            SERVER_IP=$(prompt_required "无法自动检测，请输入服务器公网 IP")
        fi
    fi

    # SSL 邮箱（有域名时）
    if [[ -n "$DOMAIN" && -z "$CERT_EMAIL" ]]; then
        CERT_EMAIL=$(prompt_with_default "Let's Encrypt 通知邮箱" "admin@${DOMAIN}")
    fi
}

print_summary() {
    echo ""
    echo -e "   ${BOLD}════════ 部署配置摘要 ════════${NC}"
    echo ""
    detail "Git 仓库:         ${GIT_REPO}"
    detail "项目目录:         ${PROJECT_DIR}"
    detail "数据库用户:       ${DB_USER}"
    detail "数据库名:         ${DB_NAME}"
    detail "数据库密码:       ***"
    detail "Nginx 静态目录:   ${NGINX_HTML_ROOT}"
    detail "后端端口:         3001 (127.0.0.1)"
    if [[ -n "$DOMAIN" ]]; then
        detail "访问方式:         域名 (${DOMAIN})"
        detail "SSL:              将自动配置"
        detail "SSL 邮箱:         ${CERT_EMAIL}"
    else
        detail "访问方式:         公网 IP (${SERVER_IP:-未检测})"
        detail "SSL:              不可用（需域名）"
    fi
    echo ""
    echo -e "   ${BOLD}═══════════════════════════════${NC}"
    echo ""
}

# ═══════════════════════════════════════════════
#  main — 入口
# ═══════════════════════════════════════════════

main() {
    parse_args "$@"

    # 提前检测更新状态
    if check_project_cloned | grep -q pass 2>/dev/null; then
        IS_UPDATE=true
    fi

    print_banner

    # 干运行模式
    if $DRY_RUN; then
        echo -e "   ${YELLOW}${BOLD}[干运行模式]${NC} — 仅检查前置条件，不做任何变更。"
        echo ""
        run_prerequisite_checks
        echo ""
        info "干运行完成。运行 bash deploy-app.sh 开始实际部署。"
        exit 0
    fi

    # 权限检查
    if ! is_root_or_sudo; then
        error "此脚本需要 root 权限。请使用 sudo 或以 root 登录后运行:"
        detail "  sudo bash deploy-app.sh"
        exit 1
    fi

    # 验证操作系统
    if ! is_debian_based; then
        warn "此脚本专为 Ubuntu/Debian 设计。"
        warn "当前系统: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '"')"
        confirm "非 Debian 系系统，是否继续？" "n" || {
            info "已退出。"
            exit 0
        }
    fi

    # 检查运行时依赖
    local deps_missing=false
    for dep in node npm psql nginx pm2 git; do
        if ! command -v "$dep" &>/dev/null; then
            error "缺少运行时: $dep"
            deps_missing=true
        fi
    done
    if $deps_missing; then
        error "请先运行环境部署脚本: bash setup-server.sh"
        exit 1
    fi

    # 收集输入
    collect_inputs

    # 打印摘要
    print_summary
    echo -e "   ${YELLOW}${BOLD}即将开始部署网站，共 8 个步骤。${NC}"
    echo ""
    confirm "确认以上配置无误，开始部署？" "y" || {
        info "已取消部署。"
        exit 0
    }

    # ──── 执行部署步骤 ────

    step_clone_project
    step_configure_env
    step_backend_build
    step_backend_pm2
    step_frontend_build
    step_nginx_config
    step_ssl
    step_verify

    # ──── 完成 ────
    echo ""
    echo -e "   ${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
    echo -e "   ${GREEN}${BOLD}║  MemoryStory Blog 部署完成！                  ║${NC}"
    echo -e "   ${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
    echo ""

    info "更新代码只需再次运行: bash deploy-app.sh"
}

main "$@"
