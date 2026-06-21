#!/usr/bin/env bash
# ───────────────────────────────────────────────
#  MemoryStory Blog — 生产环境分步部署脚本
#  Ubuntu / Debian 服务器一键部署
#
#  用法:
#    bash deploy.sh                          # 交互式部署
#    bash deploy.sh --check                  # 干运行（仅验证前置条件）
#    bash deploy.sh --yes --domain example.com --git-repo https://...
#    bash deploy.sh --help                   # 查看完整用法
# ───────────────────────────────────────────────
set -euo pipefail

# ═══════════════════════════════════════════════
#  全局变量 & 默认值
# ═══════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_VERSION="1.0.0"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# 用户输入（可通过命令行参数或交互式设置）
DOMAIN=""
DB_PASSWORD=""
GIT_REPO=""
PROJECT_DIR="/var/www/memorystory"
CERT_EMAIL=""

# 自动生成
JWT_ACCESS_SECRET=""
JWT_REFRESH_SECRET=""

# 模式标志
DRY_RUN=false
SKIP_CONFIRM=false
NON_INTERACTIVE=false

# Nginx 默认路径
NGINX_HTML_ROOT="/var/www/html"
NGINX_SITE_NAME="memorystory"

# 后端用户（PostgreSQL）
DB_USER="memorystory"
DB_NAME="memorystory"

# 临时目录（EXIT trap 清理）
TEMP_DIR=""

# ───────────────────────────────────────────────
#  颜色定义
# ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════
#  Trap handlers
# ═══════════════════════════════════════════════
on_exit() {
    local exit_code=$?
    if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR" 2>/dev/null || true
    fi
    if [[ $exit_code -ne 0 && $exit_code -ne 130 ]]; then
        echo ""
        warn "脚本以退出码 $exit_code 结束。部分步骤可能未完成。"
        warn "你可以重新运行此脚本——已完成步骤会自动跳过。"
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
    warn "被用户中断 (Ctrl+C)。"
    warn "部署状态不完整，请重新运行脚本继续。"
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
    echo -e "${BLUE}${BOLD}║${NC}     ${BOLD}MemoryStory Blog — 生产环境部署脚本${NC}       ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}║${NC}     v${SCRIPT_VERSION}  |  ${TIMESTAMP}               ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
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
#  密码生成 & 校验
# ───────────────────────────────────────────────

generate_secret() {
    openssl rand -base64 64 2>/dev/null | tr -d '\n' || {
        warn "openssl 不可用，使用 /dev/urandom 回退方案"
        cat /dev/urandom | tr -dc 'a-zA-Z0-9+/' | head -c 88
    }
}

generate_password() {
    openssl rand -base64 32 2>/dev/null | tr -d '\n' || {
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32
    }
}

validate_domain() {
    local domain="$1"
    if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]]; then
        error "域名格式无效: ${domain}"
        error "正确示例: example.com / blog.example.com"
        return 1
    fi
    return 0
}

validate_git_url() {
    local url="$1"
    if [[ ! "$url" =~ ^(https://|git@) ]]; then
        error "Git 仓库 URL 必须以 https:// 或 git@ 开头"
        return 1
    fi
    return 0
}

validate_db_password() {
    local pw="$1"
    if [[ ${#pw} -lt 8 ]]; then
        error "数据库密码长度至少 8 位"
        return 1
    fi
    return 0
}

# ═══════════════════════════════════════════════
#  CLI 参数解析
# ═══════════════════════════════════════════════

print_usage() {
    echo ""
    echo "用法: bash deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h                   显示此帮助信息"
    echo "  --check                      干运行模式 — 仅检查前置条件，不做任何变更"
    echo "  --yes, -y                    跳过每步确认（非交互式）"
    echo ""
    echo "  --domain <domain>            预设域名（如 example.com）"
    echo "  --db-password <password>     预设数据库密码"
    echo "  --git-repo <url>             预设 Git 仓库 URL"
    echo "  --project-dir <path>         自定义项目目录（默认 /var/www/memorystory）"
    echo "  --cert-email <email>         Let's Encrypt 通知邮箱"
    echo ""
    echo "示例:"
    echo "  # 交互式（推荐）"
    echo "  bash deploy.sh"
    echo ""
    echo "  # 非交互式（CI/CD）"
    echo "  bash deploy.sh --yes \\"
    echo "    --domain blog.example.com \\"
    echo "    --db-password '\$(openssl rand -base64 32)' \\"
    echo "    --git-repo https://github.com/user/my-blog.git"
    echo ""
    echo "  # 仅检查前置条件"
    echo "  bash deploy.sh --check"
    echo ""
    echo "部署步骤 (共 14 步):"
    echo "  1.  系统基础软件包"
    echo "  2.  Node.js 22 LTS"
    echo "  3.  PostgreSQL 17 + 用户/数据库"
    echo "  4.  Nginx"
    echo "  5.  PM2 进程管理"
    echo "  6.  ufw 防火墙"
    echo "  7.  克隆项目"
    echo "  8.  配置生产环境变量 (.env)"
    echo "  9.  后端构建 (npm → prisma → tsc)"
    echo "  10. PM2 启动后端"
    echo "  11. 前端构建 (npm ci → vite build)"
    echo "  12. Nginx 站点配置"
    echo "  13. SSL 证书 (Let's Encrypt)"
    echo "  14. 最终验证"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help|-h)
                print_usage
                exit 0
                ;;
            --check)
                DRY_RUN=true
                ;;
            --yes|-y)
                SKIP_CONFIRM=true
                ;;
            --domain)
                DOMAIN="$2"
                validate_domain "$DOMAIN" || exit 1
                NON_INTERACTIVE=true
                shift
                ;;
            --db-password)
                DB_PASSWORD="$2"
                validate_db_password "$DB_PASSWORD" || exit 1
                NON_INTERACTIVE=true
                shift
                ;;
            --git-repo)
                GIT_REPO="$2"
                validate_git_url "$GIT_REPO" || exit 1
                NON_INTERACTIVE=true
                shift
                ;;
            --project-dir)
                PROJECT_DIR="$2"
                shift
                ;;
            --cert-email)
                CERT_EMAIL="$2"
                shift
                ;;
            *)
                error "未知参数: $1"
                echo ""
                print_usage
                exit 1
                ;;
        esac
        shift
    done
}

# ═══════════════════════════════════════════════
#  前置条件检查函数
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
    if [[ $EUID -eq 0 ]]; then
        return 0
    fi
    if command -v sudo &>/dev/null && sudo -v &>/dev/null; then
        return 0
    fi
    return 1
}

is_debian_based() {
    [[ -f /etc/os-release ]] && source /etc/os-release
    [[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" || "${ID_LIKE:-}" == *"debian"* ]]
}

check_os()              { is_debian_based && echo "pass" || echo "fail"; }
check_nodejs()          { command -v node &>/dev/null && node -v 2>/dev/null | grep -qE 'v(2[2-9]|[3-9][0-9])' && echo "pass" || echo "fail"; }
check_postgresql()      { command -v psql &>/dev/null && pg_isready -q 2>/dev/null && echo "pass" || echo "fail"; }
check_nginx()           { command -v nginx &>/dev/null && echo "pass" || echo "fail"; }
check_pm2()             { command -v pm2 &>/dev/null && echo "pass" || echo "fail"; }
check_git()             { command -v git &>/dev/null && echo "pass" || echo "fail"; }
check_ufw()             { command -v ufw &>/dev/null && echo "pass" || echo "fail"; }
check_certbot()         { command -v certbot &>/dev/null && echo "pass" || echo "fail"; }

check_postgres_user() {
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1 && echo "pass" || echo "fail"
}

check_postgres_db() {
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1 && echo "pass" || echo "fail"
}

check_project_cloned()  { [[ -d "$PROJECT_DIR/.git" ]] && echo "pass" || echo "fail"; }
check_env_configured()  { [[ -f "$PROJECT_DIR/backend/.env" ]] && grep -q "^NODE_ENV=production" "$PROJECT_DIR/backend/.env" 2>/dev/null && echo "pass" || echo "fail"; }
check_backend_built()   { [[ -f "$PROJECT_DIR/backend/dist/index.js" ]] && echo "pass" || echo "fail"; }
check_pm2_running()     { pm2 jlist 2>/dev/null | grep -q "memorystory-backend" && echo "pass" || echo "fail"; }
check_frontend_built()  { [[ -f "${NGINX_HTML_ROOT}/index.html" ]] && echo "pass" || echo "fail"; }
check_nginx_site()      { [[ -f "/etc/nginx/sites-enabled/${NGINX_SITE_NAME}" ]] && echo "pass" || echo "fail"; }
check_ufw_active()      { sudo ufw status 2>/dev/null | grep -q "Status: active" && echo "pass" || echo "fail"; }
check_ssl_cert()        { [[ -n "$DOMAIN" && -d "/etc/letsencrypt/live/${DOMAIN}" ]] && echo "pass" || echo "fail"; }
check_disk_space()      { local avail; avail=$(df /var/www --output=avail 2>/dev/null | tail -1 | awk '{print $1}'); [[ -n "$avail" && "$avail" -gt 1048576 ]] && echo "pass" || echo "warn"; }

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

    check_one check_os              "操作系统 (Ubuntu/Debian)"          "此脚本仅支持 Debian 系 Linux"
    check_one is_root_or_sudo       "Root 或 sudo 权限"                 "请以 root 运行或配置 sudo"
    check_one check_git             "Git"                               "apt install git"
    check_one check_nodejs          "Node.js ≥ 22"                      "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -"
    check_one check_postgresql      "PostgreSQL (运行中)"               "apt install postgresql"
    check_one check_nginx           "Nginx"                             "apt install nginx"
    check_one check_pm2             "PM2"                               "npm install -g pm2"
    check_one check_ufw             "ufw 防火墙"                        "apt install ufw"
    check_one check_disk_space      "磁盘空间 (>/var/www 1GB)"          "请清理磁盘空间"

    if [[ -n "$DOMAIN" ]]; then
        check_one check_postgres_user  "PostgreSQL 用户 '${DB_USER}'"
        check_one check_postgres_db    "PostgreSQL 数据库 '${DB_NAME}'"
        check_one check_project_cloned "项目已克隆到 ${PROJECT_DIR}"
        check_one check_env_configured "生产环境 .env 已配置"
        check_one check_backend_built  "后端已构建 (dist/index.js)"
        check_one check_pm2_running    "PM2 后端进程运行中"
        check_one check_frontend_built "前端已部署到 Nginx"
        check_one check_nginx_site     "Nginx 站点已配置"
        check_one check_ufw_active     "ufw 防火墙已激活"
    fi

    echo ""
    echo -e "   ${BOLD}总计: ${total}  通过: ${GREEN}${pass}${NC}  未通过: ${RED}${fail}${NC}  警告: ${YELLOW}$((total - pass - fail))${NC}"
    echo ""

    if [[ $fail -gt 0 ]]; then
        warn "有 ${fail} 项前置条件未满足。请先安装所需软件后再运行部署。"
        return 1
    fi

    success "所有前置条件已满足。"
    return 0
}

# ═══════════════════════════════════════════════
#  分步部署函数
# ═══════════════════════════════════════════════

step_system_packages() {
    header "步骤 1/14: 系统基础软件包"

    local all_installed=true
    for pkg in curl wget git ufw build-essential gnupg ca-certificates; do
        dpkg -l "$pkg" 2>/dev/null | grep -q '^ii' || { all_installed=false; break; }
    done

    if $all_installed; then
        success "所有基础软件包已安装，跳过。"
        return 0
    fi

    info "将更新 apt 并安装: curl wget git ufw build-essential gnupg ca-certificates"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "更新 apt 软件源" apt update -y
    run_cmd "安装系统软件包" apt install -y curl wget git ufw build-essential gnupg ca-certificates

    success "步骤 1 完成。"
}

step_nodejs() {
    header "步骤 2/14: Node.js 22 LTS"

    if check_nodejs | grep -q pass; then
        success "Node.js $(node -v) 已安装，跳过。"
        return 0
    fi

    info "将通过 NodeSource 安装 Node.js 22 LTS"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "下载 NodeSource 安装脚本" curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
    run_cmd "执行 NodeSource 安装脚本" bash /tmp/nodesource_setup.sh
    run_cmd "安装 Node.js" apt install -y nodejs
    rm -f /tmp/nodesource_setup.sh

    detail "Node.js $(node -v)"
    detail "npm $(npm -v)"
    success "步骤 2 完成。"
}

step_postgresql() {
    header "步骤 3/14: PostgreSQL 17"

    # 安装 PostgreSQL
    if check_postgresql | grep -q pass; then
        success "PostgreSQL 已安装并运行，跳过安装步骤。"
    else
        info "将安装并启动 PostgreSQL 17"
        confirm "继续？" || { warn "已跳过。"; return 0; }

        run_cmd "安装 PostgreSQL" apt install -y postgresql postgresql-contrib
        run_cmd "设置 PostgreSQL 开机自启" systemctl enable postgresql
        run_cmd "启动 PostgreSQL" systemctl start postgresql

        # 等待就绪
        info "等待 PostgreSQL 就绪..."
        local waited=0
        until pg_isready -q 2>/dev/null; do
            sleep 1
            waited=$((waited + 1))
            if [[ $waited -gt 30 ]]; then
                error "PostgreSQL 在 30 秒内未就绪"
                return 1
            fi
        done
        success "PostgreSQL 已就绪。"
    fi

    # 创建用户
    if [[ -n "$DB_PASSWORD" ]]; then
        if check_postgres_user | grep -q pass; then
            success "数据库用户 '${DB_USER}' 已存在。"
        else
            info "创建数据库用户: ${DB_USER}"
            confirm "继续？" || { warn "已跳过用户创建。"; return 0; }
            run_cmd "创建数据库用户" sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
            success "用户 '${DB_USER}' 已创建。"
        fi

        # 创建数据库
        if check_postgres_db | grep -q pass; then
            success "数据库 '${DB_NAME}' 已存在。"
        else
            info "创建数据库: ${DB_NAME}"
            confirm "继续？" || { warn "已跳过数据库创建。"; return 0; }
            run_cmd "创建数据库" sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
            success "数据库 '${DB_NAME}' 已创建。"
        fi
    else
        warn "数据库密码未设置（将在步骤 8 收集），暂跳过用户/数据库创建。"
    fi

    success "步骤 3 完成。"
}

step_nginx() {
    header "步骤 4/14: Nginx"

    if check_nginx | grep -q pass; then
        success "Nginx 已安装，跳过。"
        return 0
    fi

    info "将安装 Nginx 并设置开机自启"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "安装 Nginx" apt install -y nginx
    run_cmd "设置 Nginx 开机自启" systemctl enable nginx
    run_cmd "启动 Nginx" systemctl start nginx

    success "步骤 4 完成。"
}

step_pm2() {
    header "步骤 5/14: PM2 进程管理"

    if check_pm2 | grep -q pass; then
        success "PM2 $(pm2 -v) 已安装，跳过。"
        return 0
    fi

    info "将全局安装 PM2 并配置 systemd 开机自启"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "全局安装 PM2" npm install -g pm2

    # 配置开机自启
    info "配置 PM2 开机自启..."
    if ! $DRY_RUN; then
        local startup_output
        startup_output=$(pm2 startup systemd -u root --hp /root 2>&1) || true
        detail "${startup_output}"
        # pm2 startup 可能输出需要手动执行的 sudo 命令，尝试自动执行
        local sudo_cmd
        sudo_cmd=$(echo "$startup_output" | grep -oP 'sudo\s+env.*' | head -1)
        if [[ -n "$sudo_cmd" ]]; then
            eval "$sudo_cmd" || warn "PM2 startup 注册可能未成功，请检查上述输出"
        fi
    fi

    success "步骤 5 完成。"
}

step_firewall() {
    header "步骤 6/14: 防火墙 (ufw)"

    if ! check_ufw | grep -q pass; then
        warn "ufw 未安装，跳过防火墙配置。"
        return 0
    fi

    if check_ufw_active | grep -q pass; then
        info "ufw 已激活。检查规则..."
        local rules_ok=true
        if ! sudo ufw status | grep -q "OpenSSH"; then
            run_cmd "添加 SSH 规则" sudo ufw allow OpenSSH
            rules_ok=false
        fi
        if ! sudo ufw status | grep -q "Nginx Full"; then
            run_cmd "添加 Nginx Full 规则" sudo ufw allow 'Nginx Full'
            rules_ok=false
        fi
        $rules_ok && success "防火墙规则已正确配置，跳过。" || success "防火墙规则已补充。"
        return 0
    fi

    info "将配置防火墙: 允许 SSH (22) + HTTP (80) + HTTPS (443)"
    warn "请确保你已通过 SSH 连接，否则启用防火墙后可能断连！"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "允许 OpenSSH" sudo ufw allow OpenSSH
    run_cmd "允许 Nginx Full" sudo ufw allow 'Nginx Full'
    run_cmd "启用防火墙" sudo ufw --force enable

    success "步骤 6 完成。"
}

step_clone_project() {
    header "步骤 7/14: 克隆项目"

    if [[ -z "$GIT_REPO" ]]; then
        warn "未提供 Git 仓库 URL，跳过此步骤。"
        return 0
    fi

    if check_project_cloned | grep -q pass; then
        success "项目已存在于 ${PROJECT_DIR}，跳过克隆。"
        if confirm "是否执行 git pull 更新？" "n"; then
            run_cmd "拉取最新代码" git -C "$PROJECT_DIR" pull
        fi
        return 0
    fi

    info "将克隆仓库到: ${PROJECT_DIR}"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    local parent_dir
    parent_dir=$(dirname "$PROJECT_DIR")
    run_cmd "创建父目录" mkdir -p "$parent_dir"
    run_cmd "克隆仓库" git clone "$GIT_REPO" "$PROJECT_DIR"

    success "步骤 7 完成。"
}

step_configure_env() {
    header "步骤 8/14: 配置生产环境变量"

    if [[ ! -d "$PROJECT_DIR" ]]; then
        warn "项目目录 ${PROJECT_DIR} 不存在，跳过。"
        return 0
    fi

    local env_file="$PROJECT_DIR/backend/.env"
    local example_file="$PROJECT_DIR/.env.example"

    if check_env_configured | grep -q pass; then
        success "生产环境 .env 已配置，跳过。"
        detail "如需重新生成，请删除 ${env_file} 后重新运行。"
        return 0
    fi

    # 自动生成密钥
    info "正在生成安全密钥..."
    JWT_ACCESS_SECRET=$(generate_secret)
    JWT_REFRESH_SECRET=$(generate_secret)

    # 如果数据库密码尚未设置，自动生成
    if [[ -z "$DB_PASSWORD" ]]; then
        DB_PASSWORD=$(generate_password)
    fi

    if ! $DRY_RUN; then
        if [[ ! -f "$example_file" ]]; then
            error "找不到 .env.example 文件: ${example_file}"
            return 1
        fi

        cp "$example_file" "$env_file"

        # 使用 sed 替换占位符
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}|" "$env_file"
        sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}|" "$env_file"
        sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "$env_file"
        sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$env_file"
        sed -i "s|^HOST=.*|HOST=127.0.0.1|" "$env_file"
        sed -i "s|^PORT=.*|PORT=3001|" "$env_file"
        if [[ -n "$DOMAIN" ]]; then
            sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|" "$env_file"
        fi
        sed -i "s|^BCRYPT_SALT_ROUNDS=.*|BCRYPT_SALT_ROUNDS=12|" "$env_file"

        # 移除 docker-compose 专用变量（避免混淆）
        sed -i '/^POSTGRES_USER=/d' "$env_file"
        sed -i '/^POSTGRES_PASSWORD=/d' "$env_file"
        sed -i '/^POSTGRES_DB=/d' "$env_file"
        sed -i '/^DB_PORT=/d' "$env_file"

        # 安全权限
        chmod 600 "$env_file"
    fi

    echo ""
    echo -e "   ${BOLD}════════ 重要 ════════${NC}"
    echo -e "   ${YELLOW}以下密钥仅在本次显示，请妥善保存！${NC}"
    echo ""
    detail "JWT_ACCESS_SECRET:  ${JWT_ACCESS_SECRET}"
    detail "JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}"
    detail "数据库密码:         ${DB_PASSWORD}"
    echo ""
    detail "以上值已写入 ${env_file} (权限 600)"
    echo -e "   ${BOLD}════════════════════════${NC}"
    echo ""

    success "步骤 8 完成。"
}

step_backend_build() {
    header "步骤 9/14: 后端构建"

    if [[ ! -d "$PROJECT_DIR/backend" ]]; then
        warn "后端目录 ${PROJECT_DIR}/backend 不存在，跳过。"
        return 0
    fi

    if check_backend_built | grep -q pass; then
        success "后端已构建 (dist/index.js 存在)。"
        if confirm "是否重新构建？" "n"; then
            detail "将重新构建..."
        else
            return 0
        fi
    fi

    info "将执行: npm install → prisma migrate → prisma seed → tsc → npm prune"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "安装依赖 (含 devDependencies)" \
        bash -c "cd '$PROJECT_DIR/backend' && npm install"

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

    success "步骤 9 完成。"
}

step_backend_pm2() {
    header "步骤 10/14: PM2 启动后端"

    if [[ ! -f "$PROJECT_DIR/backend/dist/index.js" ]]; then
        warn "未找到 dist/index.js，请先完成步骤 9。"
        return 0
    fi

    if check_pm2_running | grep -q pass; then
        success "PM2 后端进程已在运行。"
        if confirm "是否重启后端？" "n"; then
            run_cmd "重启后端" pm2 restart memorystory-backend
            success "后端已重启。"
        fi
        return 0
    fi

    # 生成生产 PM2 配置
    local pm2_config="$PROJECT_DIR/ecosystem.production.config.cjs"
    info "生成生产 PM2 配置: ${pm2_config}"

    if ! $DRY_RUN; then
        # 读取 .env 中的值以保持一致性
        local db_url jwt_access jwt_refresh cors_origin
        db_url=$(grep "^DATABASE_URL=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "")
        jwt_access=$(grep "^JWT_ACCESS_SECRET=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "$JWT_ACCESS_SECRET")
        jwt_refresh=$(grep "^JWT_REFRESH_SECRET=" "$PROJECT_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- || echo "$JWT_REFRESH_SECRET")
        cors_origin="https://${DOMAIN:-localhost}"

        cat > "$pm2_config" << PM2EOF
// 由 deploy.sh 自动生成 — $(date '+%Y-%m-%d %H:%M:%S')
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
      max_restarts: 10,
      max_memory_restart: '300M',
      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
PM2EOF
        chmod 600 "$pm2_config"
    fi

    confirm "启动后端？" || { warn "已跳过。"; return 0; }

    run_cmd "启动 PM2 后端" pm2 start "$pm2_config"
    run_cmd "保存 PM2 进程列表" pm2 save

    # 快速验证
    sleep 2
    info "验证后端健康状态..."
    if curl -sf http://127.0.0.1:3001/api/posts > /dev/null 2>&1; then
        success "后端 API 响应正常。"
    else
        warn "后端尚未就绪（可能在启动中），请稍后检查。"
        detail "运行: pm2 logs memorystory-backend"
    fi

    success "步骤 10 完成。"
}

step_frontend_build() {
    header "步骤 11/14: 前端构建"

    if [[ ! -d "$PROJECT_DIR/frontend" ]]; then
        warn "前端目录 ${PROJECT_DIR}/frontend 不存在，跳过。"
        return 0
    fi

    if check_frontend_built | grep -q pass; then
        success "前端已部署到 ${NGINX_HTML_ROOT}。"
        if confirm "是否重新构建？" "n"; then
            detail "将重新构建..."
        else
            return 0
        fi
    fi

    info "将执行: npm ci → tsc + vite build → 部署到 Nginx"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "安装前端依赖" \
        bash -c "cd '$PROJECT_DIR/frontend' && npm ci"

    run_cmd "构建前端" \
        bash -c "cd '$PROJECT_DIR/frontend' && npm run build"

    run_cmd "部署静态文件到 Nginx" \
        bash -c "sudo cp -r '$PROJECT_DIR/frontend/dist/'* '$NGINX_HTML_ROOT/'"

    success "步骤 11 完成。"
}

step_nginx_config() {
    header "步骤 12/14: Nginx 站点配置"

    if [[ -z "$DOMAIN" ]]; then
        warn "未提供域名，跳过 Nginx 站点配置。"
        return 0
    fi

    if check_nginx_site | grep -q pass; then
        success "Nginx 站点配置已存在。"
        if confirm "是否覆盖？" "n"; then
            detail "将覆盖现有配置..."
        else
            return 0
        fi
    fi

    local site_config="/etc/nginx/sites-available/${NGINX_SITE_NAME}"
    info "将创建 Nginx 配置: ${site_config}"

    if ! $DRY_RUN; then
        sudo tee "$site_config" > /dev/null << NGINXEOF
# MemoryStory Blog — Nginx 配置
# 由 deploy.sh 自动生成 — $(date '+%Y-%m-%d %H:%M:%S')

server {
    listen 80;
    server_name ${DOMAIN};

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

        # 上传文件大小限制（匹配后端 50MB）
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

    run_cmd "创建站点软链接" sudo ln -sf "$site_config" "/etc/nginx/sites-enabled/${NGINX_SITE_NAME}"

    # 移除默认站点
    if [[ -f /etc/nginx/sites-enabled/default ]]; then
        run_cmd "移除默认站点配置" sudo rm -f /etc/nginx/sites-enabled/default
    fi

    run_cmd "测试 Nginx 配置" sudo nginx -t
    run_cmd "重载 Nginx" sudo systemctl reload nginx

    success "步骤 12 完成。"
}

step_ssl() {
    header "步骤 13/14: SSL 证书 (Let's Encrypt)"

    if [[ -z "$DOMAIN" ]]; then
        warn "未提供域名，跳过 SSL 配置。"
        return 0
    fi

    if check_ssl_cert | grep -q pass; then
        success "SSL 证书已存在: /etc/letsencrypt/live/${DOMAIN}/"
        info "验证自动续期状态..."
        if systemctl is-active certbot.timer &>/dev/null; then
            success "certbot 自动续期 timer 已激活。"
        else
            warn "certbot timer 未激活，尝试启动..."
            run_cmd "启动 certbot timer" sudo systemctl enable --now certbot.timer
        fi
        return 0
    fi

    info "将通过 Let's Encrypt 获取免费 SSL 证书"
    warn "请确保域名 ${DOMAIN} 已解析到此服务器的 IP 地址！"
    confirm "继续？" || { warn "已跳过 SSL 配置。"; return 0; }

    # 安装 certbot
    if ! check_certbot | grep -q pass; then
        run_cmd "安装 certbot" apt install -y certbot python3-certbot-nginx
    fi

    # 如果未设置通知邮箱，自动补全
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

    success "步骤 13 完成。"
}

step_verify() {
    header "步骤 14/14: 最终验证"

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
    [[ -n "$DOMAIN" ]] && _check "前端已部署"     check_frontend_built
    [[ -n "$DOMAIN" ]] && _check "Nginx 站点已配置" check_nginx_site
    [[ -n "$DOMAIN" ]] && _check "SSL 证书"        check_ssl_cert
    _check "防火墙已激活"          check_ufw_active

    echo "   ─────────────────────────────────────────"
    echo ""

    if $ok; then
        success "所有检查通过！"
    else
        warn "部分检查未通过，请检查上述标记项。"
    fi

    echo ""
    echo -e "   ${BOLD}════════════════════════════════════════${NC}"
    if [[ -n "$DOMAIN" ]]; then
        echo -e "   ${GREEN}博格地址:  https://${DOMAIN}${NC}"
        echo -e "   ${GREEN}管理后台:  https://${DOMAIN}/admin${NC}"
    else
        echo -e "   ${YELLOW}未配置域名，请手动完成 Nginx + SSL 配置${NC}"
    fi
    echo ""
    echo -e "   ${BOLD}默认管理员账户:${NC}"
    echo -e "     邮箱:    admin@example.com"
    echo -e "     密码:    admin123"
    echo -e "   ${RED}请立即登录管理后台修改密码！${NC}"
    echo -e "     路径: /admin/profile → 修改密码"
    echo ""
    echo -e "   ${BOLD}运维命令:${NC}"
    echo -e "     pm2 status                    查看进程状态"
    echo -e "     pm2 logs memorystory-backend   查看后端日志"
    echo -e "     pm2 restart memorystory-backend 重启后端"
    echo ""
    echo -e "   ${BOLD}════════════════════════════════════════${NC}"
    echo ""

    success "步骤 14 完成。"
}

# ═══════════════════════════════════════════════
#  交互式输入收集
# ═══════════════════════════════════════════════

collect_inputs() {
    echo ""
    echo -e "   ${BOLD}请输入以下部署信息:${NC}"
    echo ""

    if [[ -z "$DOMAIN" ]]; then
        DOMAIN=$(prompt_required "域名 (如 example.com)")
        validate_domain "$DOMAIN" || exit 1
    else
        info "域名: ${DOMAIN} (来自命令行参数)"
    fi

    if [[ -z "$DB_PASSWORD" ]]; then
        local generated
        generated=$(generate_password)
        DB_PASSWORD=$(prompt_with_default "数据库密码 (直接回车自动生成)" "$generated")
        validate_db_password "$DB_PASSWORD" || exit 1
    else
        info "数据库密码: *** (来自命令行参数)"
    fi

    if [[ -z "$GIT_REPO" ]]; then
        GIT_REPO=$(prompt_required "Git 仓库地址 (如 https://github.com/user/repo.git)")
        validate_git_url "$GIT_REPO" || exit 1
    else
        info "Git 仓库: ${GIT_REPO} (来自命令行参数)"
    fi

    PROJECT_DIR=$(prompt_with_default "项目安装目录" "$PROJECT_DIR")

    if [[ -z "$CERT_EMAIL" ]]; then
        CERT_EMAIL=$(prompt_with_default "Let's Encrypt 通知邮箱" "admin@${DOMAIN}")
    fi
}

print_summary() {
    echo ""
    echo -e "   ${BOLD}════════ 部署配置摘要 ════════${NC}"
    echo ""
    detail "域名:             ${DOMAIN}"
    detail "项目目录:         ${PROJECT_DIR}"
    detail "Git 仓库:         ${GIT_REPO}"
    detail "数据库用户:       ${DB_USER}"
    detail "数据库名:         ${DB_NAME}"
    detail "数据库密码:       ***"
    detail "Nginx 静态目录:   ${NGINX_HTML_ROOT}"
    detail "后端端口:         3001 (127.0.0.1)"
    detail "SSL 通知邮箱:     ${CERT_EMAIL}"
    echo ""
    echo -e "   ${BOLD}═══════════════════════════════${NC}"
    echo ""
}

# ═══════════════════════════════════════════════
#  main — 入口
# ═══════════════════════════════════════════════

main() {
    parse_args "$@"

    print_banner

    # 干运行模式
    if $DRY_RUN; then
        echo -e "   ${YELLOW}${BOLD}[干运行模式]${NC} — 仅检查前置条件，不做任何变更。"
        echo ""
        run_prerequisite_checks
        echo ""
        info "干运行完成。修复上述标记为 [✗] 的项后，运行 bash deploy.sh 开始实际部署。"
        exit 0
    fi

    # 权限检查
    if ! is_root_or_sudo; then
        error "此脚本需要 root 权限。请使用 sudo 或以 root 登录后运行:"
        detail "  sudo bash deploy.sh"
        exit 1
    fi

    # 验证操作系统
    if ! is_debian_based; then
        warn "此脚本专为 Ubuntu/Debian 设计。"
        warn "当前系统: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"')"
        confirm "非 Debian 系系统，是否继续？" "n" || {
            info "已退出。此脚本仅支持 Ubuntu/Debian。"
            exit 0
        }
    fi

    # 收集输入
    collect_inputs

    # 打印摘要并获得最终确认
    print_summary
    echo -e "   ${YELLOW}${BOLD}即将开始部署，共 14 个步骤。每步执行前会请求确认。${NC}"
    echo ""
    confirm "确认以上配置无误，开始部署？" "y" || {
        info "已取消部署。"
        exit 0
    }

    # ──── 执行部署步骤 ────

    step_system_packages
    step_nodejs
    step_postgresql
    step_nginx
    step_pm2
    step_firewall
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

    if $SKIP_CONFIRM; then
        info "非交互式部署完成。"
    else
        info "如需帮助，请查看: ${PROJECT_DIR}/DEPLOYMENT.md"
    fi
}

# 执行
main "$@"
