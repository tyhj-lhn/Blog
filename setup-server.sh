#!/usr/bin/env bash
# ───────────────────────────────────────────────
#  MemoryStory Blog — 服务器环境部署脚本
#  Ubuntu / Debian 服务器初始化（一次性运行）
#
#  安装所有必需的运行时:
#  Node.js 22 / PostgreSQL 17 / Nginx / PM2 / 防火墙
#
#  用法:
#    bash setup-server.sh                     # 交互式
#    bash setup-server.sh --yes               # 跳过确认
#    bash setup-server.sh --dry-run           # 干运行（仅检查前置条件）
#    bash setup-server.sh --help              # 查看帮助
# ───────────────────────────────────────────────
set -euo pipefail

# ═══════════════════════════════════════════════
#  全局变量 & 默认值
# ═══════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_VERSION="2.0.0"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"

# 数据库配置
DB_USER="memorystory"
DB_NAME="memorystory"
DB_PASSWORD=""

# 模式标志
DRY_RUN=false
SKIP_CONFIRM=false

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
    echo -e "${BLUE}${BOLD}║${NC}   ${BOLD}MemoryStory Blog — 服务器环境部署${NC}              ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}║${NC}   v${SCRIPT_VERSION}  |  ${TIMESTAMP}               ${BLUE}${BOLD}║${NC}"
    echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "   ${YELLOW}此脚本安装运行时环境（一次性）。${NC}"
    echo -e "   ${YELLOW}网站部署请使用: bash deploy-app.sh${NC}"
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
#  密码生成
# ───────────────────────────────────────────────

generate_password() {
    openssl rand -base64 32 2>/dev/null | tr -d '\n' || {
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32
    }
}

# ═══════════════════════════════════════════════
#  CLI 参数解析
# ═══════════════════════════════════════════════

print_usage() {
    echo ""
    echo "用法: bash setup-server.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --help, -h           显示此帮助信息"
    echo "  --dry-run            干运行 — 仅检查前置条件，不做任何变更"
    echo "  --yes, -y            跳过所有确认提示（非交互式）"
    echo "  --db-password <pw>   预设数据库密码（≥8字符）"
    echo ""
    echo "安装步骤:"
    echo "  1.  系统基础软件包 (curl wget git ufw build-essential)"
    echo "  2.  Node.js 22 LTS"
    echo "  3.  PostgreSQL 17 + 用户 + 数据库"
    echo "  4.  Nginx"
    echo "  5.  PM2 进程管理"
    echo "  6.  ufw 防火墙"
    echo ""
    echo "示例:"
    echo "  bash setup-server.sh                          # 交互式（推荐）"
    echo "  bash setup-server.sh --yes --db-password 'xxx' # 非交互式"
    echo "  bash setup-server.sh --dry-run                 # 仅检查"
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
            --db-password)
                DB_PASSWORD="$2"
                if [[ ${#DB_PASSWORD} -lt 8 ]]; then
                    error "数据库密码长度至少 8 位"
                    exit 1
                fi
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

check_os()              { is_debian_based && echo "pass" || echo "fail"; }
check_nodejs()          { command -v node &>/dev/null && node -v 2>/dev/null | grep -qE 'v(2[2-9]|[3-9][0-9])' && echo "pass" || echo "fail"; }
check_postgresql()      { command -v psql &>/dev/null && pg_isready -q 2>/dev/null && echo "pass" || echo "fail"; }
check_nginx()           { command -v nginx &>/dev/null && echo "pass" || echo "fail"; }
check_pm2()             { command -v pm2 &>/dev/null && echo "pass" || echo "fail"; }
check_ufw()             { command -v ufw &>/dev/null && echo "pass" || echo "fail"; }
check_ufw_active()      { sudo ufw status 2>/dev/null | grep -q "Status: active" && echo "pass" || echo "fail"; }

check_postgres_user() {
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1 && echo "pass" || echo "fail"
}

check_postgres_db() {
    sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1 && echo "pass" || echo "fail"
}

check_disk_space() {
    local avail
    avail=$(df /var --output=avail 2>/dev/null | tail -1 | awk '{print $1}')
    [[ -n "$avail" && "$avail" -gt 1048576 ]] && echo "pass" || echo "warn"
}

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

    check_one check_os              "操作系统 (Ubuntu/Debian)"      "此脚本仅支持 Debian 系 Linux"
    check_one is_root_or_sudo       "Root 或 sudo 权限"             "请以 root 运行或配置 sudo"
    check_one check_nodejs          "Node.js ≥ 22"                  "步骤 2 将安装"
    check_one check_postgresql      "PostgreSQL (运行中)"           "步骤 3 将安装"
    check_one check_nginx           "Nginx"                         "步骤 4 将安装"
    check_one check_pm2             "PM2"                           "步骤 5 将安装"
    check_one check_ufw             "ufw 防火墙"                    "步骤 6 将配置"
    check_one check_disk_space      "磁盘空间 (>/var 1GB)"          "请清理磁盘空间"

    echo ""
    echo -e "   ${BOLD}总计: ${total}  就绪: ${GREEN}${pass}${NC}  待安装: ${YELLOW}${fail}${NC}${NC}"
    echo ""

    return 0
}

# ═══════════════════════════════════════════════
#  分步安装函数
# ═══════════════════════════════════════════════

step_system_packages() {
    header "步骤 1/6: 系统基础软件包"

    local all_installed=true
    for pkg in curl wget git ufw build-essential gnupg ca-certificates; do
        dpkg -l "$pkg" 2>/dev/null | grep -q '^ii' || { all_installed=false; break; }
    done

    if $all_installed; then
        success "所有基础软件包已安装，跳过。"
        return 0
    fi

    info "将安装: curl wget git ufw build-essential gnupg ca-certificates"
    confirm "继续？" || { warn "已跳过。"; return 0; }

    run_cmd "更新 apt 软件源" apt update -y
    run_cmd "安装系统软件包" apt install -y curl wget git ufw build-essential gnupg ca-certificates

    success "步骤 1 完成。"
}

step_nodejs() {
    header "步骤 2/6: Node.js 22 LTS"

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
    header "步骤 3/6: PostgreSQL 17"

    # --- 安装 PostgreSQL ---
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

    # --- 收集/生成数据库密码 ---
    if [[ -z "$DB_PASSWORD" ]]; then
        local generated
        generated=$(generate_password)
        DB_PASSWORD=$(prompt_with_default "数据库密码 (直接回车自动生成)" "$generated")
    fi

    # --- 创建用户 ---
    if check_postgres_user | grep -q pass; then
        success "数据库用户 '${DB_USER}' 已存在，跳过。"
    else
        info "创建数据库用户: ${DB_USER}"
        confirm "继续？" || { warn "已跳过用户创建。"; return 0; }
        run_cmd "创建数据库用户" sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
        success "用户 '${DB_USER}' 已创建。"
    fi

    # --- 创建数据库 ---
    if check_postgres_db | grep -q pass; then
        success "数据库 '${DB_NAME}' 已存在，跳过。"
    else
        info "创建数据库: ${DB_NAME}"
        confirm "继续？" || { warn "已跳过数据库创建。"; return 0; }
        run_cmd "创建数据库" sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
        success "数据库 '${DB_NAME}' 已创建。"
    fi

    # --- 输出密码（新创建时） ---
    echo ""
    echo -e "   ${BOLD}════════ 数据库信息 ════════${NC}"
    detail "用户:     ${DB_USER}"
    detail "数据库:   ${DB_NAME}"
    detail "密码:     ${DB_PASSWORD}"
    echo -e "   ${YELLOW}请妥善保存以上信息，网站部署时需要用到。${NC}"
    echo -e "   ${BOLD}════════════════════════════${NC}"
    echo ""

    success "步骤 3 完成。"
}

step_nginx() {
    header "步骤 4/6: Nginx"

    if check_nginx | grep -q pass; then
        success "Nginx 已安装 ($(nginx -v 2>&1))，跳过。"
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
    header "步骤 5/6: PM2 进程管理"

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
        local sudo_cmd
        sudo_cmd=$(echo "$startup_output" | grep -oP 'sudo\s+env.*' | head -1)
        if [[ -n "$sudo_cmd" ]]; then
            eval "$sudo_cmd" || warn "PM2 startup 注册可能未成功，请检查上述输出"
        fi
    fi

    success "步骤 5 完成。"
}

step_firewall() {
    header "步骤 6/6: 防火墙 (ufw)"

    if ! check_ufw | grep -q pass; then
        warn "ufw 未安装（步骤 1 应该已安装），跳过防火墙配置。"
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

# ═══════════════════════════════════════════════
#  交互式输入
# ═══════════════════════════════════════════════

collect_inputs() {
    echo ""
    echo -e "   ${BOLD}数据库配置:${NC}"
    echo ""

    if [[ -z "$DB_PASSWORD" ]]; then
        local generated
        generated=$(generate_password)
        DB_PASSWORD=$(prompt_with_default "数据库密码 (直接回车自动生成)" "$generated")
        if [[ ${#DB_PASSWORD} -lt 8 ]]; then
            error "数据库密码长度至少 8 位"
            exit 1
        fi
    else
        info "数据库密码: *** (来自命令行参数)"
    fi
}

print_summary() {
    echo ""
    echo -e "   ${BOLD}════════ 安装配置摘要 ════════${NC}"
    echo ""
    detail "数据库用户:       ${DB_USER}"
    detail "数据库名:         ${DB_NAME}"
    detail "数据库密码:       ***"
    detail "Node.js 版本:     22 LTS"
    detail "PostgreSQL 版本:  17"
    echo ""
    echo -e "   ${BOLD}════════════════════════════${NC}"
    echo ""
}

# ═══════════════════════════════════════════════
#  最终验证
# ═══════════════════════════════════════════════

step_verify() {
    header "环境验证"

    echo ""
    echo -e "   ${BOLD}环境验证报告 — $(date '+%Y-%m-%d %H:%M:%S')${NC}"
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
        else
            echo -e "   ${RED}✗${NC} ${label}"
            ok=false
        fi
    }

    _check "操作系统 (Ubuntu/Debian)"  check_os
    _check "Node.js ≥ 22"               check_nodejs
    _check "PostgreSQL 运行"            check_postgresql
    _check "数据库用户 '${DB_USER}'"    check_postgres_user
    _check "数据库 '${DB_NAME}'"        check_postgres_db
    _check "Nginx 运行"                 check_nginx
    _check "PM2 已安装"                 check_pm2
    _check "ufw 防火墙"                 check_ufw
    _check "防火墙已激活"               check_ufw_active

    echo "   ─────────────────────────────────────────"
    echo ""

    if $ok; then
        success "服务器环境安装完成！"
    else
        warn "部分检查未通过，请检查上述标记项。"
    fi

    echo ""
    echo -e "   ${BOLD}════════════════════════════════════════${NC}"
    echo -e "   ${GREEN}下一步: 运行网站部署脚本${NC}"
    echo -e "     bash deploy-app.sh"
    echo ""
    echo -e "   ${BOLD}数据库连接信息:${NC}"
    echo -e "     DATABASE_URL=postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}"
    echo ""
    echo -e "   ${BOLD}════════════════════════════════════════${NC}"
    echo ""

    success "服务器环境部署完成。"
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
        info "干运行完成。修复标记为 [✗] 的项后，运行 bash setup-server.sh 开始安装。"
        exit 0
    fi

    # 权限检查
    if ! is_root_or_sudo; then
        error "此脚本需要 root 权限。请使用 sudo 或以 root 登录后运行:"
        detail "  sudo bash setup-server.sh"
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

    # 收集输入
    collect_inputs

    # 打印摘要
    print_summary
    echo -e "   ${YELLOW}${BOLD}即将开始安装服务器环境，共 6 个步骤。${NC}"
    echo ""
    confirm "确认开始安装？" "y" || {
        info "已取消。"
        exit 0
    }

    # ──── 执行安装步骤 ────

    step_system_packages
    step_nodejs
    step_postgresql
    step_nginx
    step_pm2
    step_firewall
    step_verify

    # ──── 完成 ────
    echo ""
    echo -e "   ${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
    echo -e "   ${GREEN}${BOLD}║  服务器环境部署完成！                        ║${NC}"
    echo -e "   ${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    info "下一步: 运行 bash deploy-app.sh 部署网站"
}

main "$@"
