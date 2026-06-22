#!/usr/bin/env bash
# ───────────────────────────────────────────────
#  MemoryStory Blog — 网站更新脚本
#  用于更新已部署的网站（需先完成首次部署）
#
#  用法:
#    bash update.sh                        # 自动检测并更新
#    PROJECT_DIR=/var/www/memorystory bash update.sh
#
#  相比 deploy-app.sh 更新模式:
#    - 跳过 Nginx 配置（已部署）
#    - 跳过 SSL 检查
#    - 跳过 .env 生成
#    - 跳过前置条件检查
#    - 零交互，可放入 cron
# ───────────────────────────────────────────────
set -euo pipefail

# ═══════════════════════════════════════════════
#  颜色定义（与 deploy-app.sh 一致）
# ═══════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

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

# ═══════════════════════════════════════════════
#  自动检测项目目录
# ═══════════════════════════════════════════════
detect_project_dir() {
    # 1. 环境变量
    if [[ -n "${PROJECT_DIR:-}" ]] && [[ -d "$PROJECT_DIR/.git" ]]; then
        echo "$PROJECT_DIR"
        return 0
    fi

    # 2. 默认路径
    if [[ -d "/var/www/memorystory/.git" ]]; then
        echo "/var/www/memorystory"
        return 0
    fi

    # 3. 脚本所在目录的父目录（开发环境）
    local script_parent
    script_parent="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -d "$script_parent/.git" ]]; then
        echo "$script_parent"
        return 0
    fi

    return 1
}

# ═══════════════════════════════════════════════
#  Trap handlers
# ═══════════════════════════════════════════════
on_error() {
    local line=$1
    local cmd=$2
    error "第 ${line} 行执行失败: ${cmd}"
    error "更新中断。已完成步骤不会重复执行，修复后可重新运行。"
    exit 1
}

on_interrupt() {
    echo ""
    warn "被用户中断 (Ctrl+C)"
    exit 130
}

trap 'on_error ${LINENO} "${BASH_COMMAND}"' ERR
trap 'on_interrupt' SIGINT SIGTERM

# ═══════════════════════════════════════════════
#  主流程
# ═══════════════════════════════════════════════

main() {
    echo ""
    echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}${BOLD}║${NC}     ${BOLD}MemoryStory Blog — 网站更新${NC}                     ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}║${NC}     $(date '+%Y-%m-%d %H:%M:%S')                              ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
    echo ""

    # ──── 检测项目目录 ────
    PROJECT_DIR=$(detect_project_dir) || {
        error "未找到项目目录。请设置环境变量:"
        detail "  export PROJECT_DIR=/var/www/memorystory"
        detail "  bash update.sh"
        exit 1
    }
    info "项目目录: ${PROJECT_DIR}"

    # ═══════════════════════════════════════════════
    #  步骤 1: Git Pull
    # ═══════════════════════════════════════════════
    header "1/6 Git 拉取最新代码"

    local branch
    branch=$(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    info "当前分支: ${branch}"

    # 有本地修改就先 stash
    if [[ -n $(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null) ]]; then
        warn "检测到本地修改，自动备份 (git stash)"
        git -C "$PROJECT_DIR" stash -u
    fi

    info "git pull origin ${branch}..."
    git -C "$PROJECT_DIR" pull origin "$branch"
    success "步骤 1 完成 — 代码已是最新"

    # ═══════════════════════════════════════════════
    #  步骤 2: 后端构建
    # ═══════════════════════════════════════════════
    header "2/6 后端构建"

    info "安装依赖..."
    cd "$PROJECT_DIR/backend"
    npm install

    info "生成 Prisma Client..."
    npx prisma generate

    info "运行数据库迁移..."
    npx prisma migrate deploy

    info "编译 TypeScript..."
    npm run build

    info "清理开发依赖..."
    npm prune --production

    info "确保 uploads + logs 目录存在..."
    mkdir -p uploads logs
    chmod 755 uploads logs

    success "步骤 2 完成 — 后端构建成功"

    # ═══════════════════════════════════════════════
    #  步骤 3: PM2 重启
    # ═══════════════════════════════════════════════
    header "3/6 PM2 重启后端"

    if pm2 jlist 2>/dev/null | grep -q "memorystory-backend"; then
        info "重启 memorystory-backend..."
        pm2 restart memorystory-backend
    else
        warn "未找到 memorystory-backend 进程，尝试启动..."
        local pm2_config="$PROJECT_DIR/ecosystem.production.config.cjs"
        if [[ -f "$pm2_config" ]]; then
            pm2 start "$pm2_config"
        else
            error "未找到 ecosystem.production.config.cjs，请先运行 deploy-app.sh"
            exit 1
        fi
    fi

    pm2 save
    success "步骤 3 完成 — PM2 已重启"

    # ═══════════════════════════════════════════════
    #  步骤 4: 前端构建
    # ═══════════════════════════════════════════════
    header "4/6 前端构建"

    cd "$PROJECT_DIR/frontend"
    info "安装依赖..."
    npm ci

    info "vite build..."
    npm run build
    success "步骤 4 完成 — 前端构建成功"

    # ═══════════════════════════════════════════════
    #  步骤 5: 部署到 Nginx
    # ═══════════════════════════════════════════════
    header "5/6 部署静态文件到 Nginx"

    NGINX_HTML_ROOT="/var/www/html"

    # 备份旧文件
    if [[ -d "$NGINX_HTML_ROOT" ]] && [[ -n "$(ls -A "$NGINX_HTML_ROOT" 2>/dev/null)" ]]; then
        local bak="${NGINX_HTML_ROOT}.bak.$(date +%Y%m%d%H%M%S)"
        info "备份旧静态文件 → ${bak}"
        sudo cp -r "$NGINX_HTML_ROOT" "$bak" 2>/dev/null || true
    fi

    info "清空 Nginx 根目录并部署新文件..."
    sudo rm -rf "$NGINX_HTML_ROOT"/* 2>/dev/null || true
    sudo cp -r "$PROJECT_DIR/frontend/dist/"* "$NGINX_HTML_ROOT/"
    success "步骤 5 完成 — 前端已部署"

    # ═══════════════════════════════════════════════
    #  步骤 6: 快速验证
    # ═══════════════════════════════════════════════
    header "6/6 快速验证"

    sleep 2

    local all_ok=true

    # 后端 API
    if curl -sf http://127.0.0.1:3001/api/posts > /dev/null 2>&1; then
        success "后端 API: 正常"
    else
        error "后端 API: 无响应"
        all_ok=false
    fi

    # 前端
    if curl -sf http://localhost > /dev/null 2>&1; then
        success "前端首页: 正常"
    else
        warn "前端首页: 无响应（可能尚未就绪）"
        all_ok=false
    fi

    echo ""

    if $all_ok; then
        echo -e "   ${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
        echo -e "   ${GREEN}${BOLD}║  ✓ 网站更新完成！                           ║${NC}"
        echo -e "   ${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
    else
        echo -e "   ${YELLOW}${BOLD}╔══════════════════════════════════════════════╗${NC}"
        echo -e "   ${YELLOW}${BOLD}║  ⚠ 更新完成，但部分检查未通过              ║${NC}"
        echo -e "   ${YELLOW}${BOLD}╚══════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "   ${YELLOW}排查建议:${NC}"
        detail "1. 查看 PM2 日志: pm2 logs memorystory-backend --lines 30"
        detail "2. 手动启动测试: cd ${PROJECT_DIR}/backend && node dist/index.js"
        detail "3. 运行诊断脚本: bash ${PROJECT_DIR}/diagnose.sh"
    fi

    echo ""
}

main "$@"
