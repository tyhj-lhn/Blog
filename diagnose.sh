#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
#  MemoryStory Blog — 服务器快速诊断脚本
#  用法: bash diagnose.sh
# ═══════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
pass() { echo -e "   ${GREEN}✓${NC} $1"; }
fail() { echo -e "   ${RED}✗${NC} $1"; }
warn() { echo -e "   ${YELLOW}⚠${NC} $1"; }
info() { echo -e "   ${BLUE}→${NC} $1"; }

PROJECT_DIR="${PROJECT_DIR:-/var/www/memorystory}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MemoryStory Blog — 服务器诊断报告${NC}"
echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# ─── 1. PM2 状态 ───
echo -e "${BLUE}[1/6] PM2 进程状态${NC}"
if pm2 jlist 2>/dev/null | grep -q "memorystory-backend"; then
  status=$(pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  restarts=$(pm2 jlist 2>/dev/null | grep -o '"restarts":[0-9]*' | head -1 | cut -d':' -f2)
  echo "   状态: $status | 重启次数: $restarts"
  if [[ "$status" == "launching" || "$status" == "errored" ]]; then
    fail "后端未正常运行 (status=$status)"
  elif [[ "$status" == "online" ]]; then
    pass "后端运行中"
  fi
else
  fail "未找到 memorystory-backend 进程"
fi

# ─── 2. 手动启动测试 ───
echo ""
echo -e "${BLUE}[2/6] 手动启动测试（捕获真实错误）${NC}"
if [[ -f "$PROJECT_DIR/backend/dist/index.js" ]]; then
  info "尝试手动启动..."
  cd "$PROJECT_DIR/backend"
  output=$(timeout 10 node dist/index.js 2>&1) || true
  if echo "$output" | grep -qi "fatal\|cannot find\|missing\|ECONNREFUSED"; then
    fail "启动报错:"
    echo "$output" | tail -20 | while read -r line; do echo "      $line"; done
  elif echo "$output" | grep -qi "listening\|ready\|Server.*running"; then
    pass "手动启动成功（端口绑定正常）"
  else
    warn "启动输出:"
    echo "$output" | tail -10 | while read -r line; do echo "      $line"; done
  fi
else
  fail "dist/index.js 不存在"
fi

# ─── 3. 数据库连通性 ───
echo ""
echo -e "${BLUE}[3/6] 数据库连通性${NC}"
if [[ -f "$PROJECT_DIR/backend/.env" ]]; then
  DB_URL=$(grep "^DATABASE_URL=" "$PROJECT_DIR/backend/.env" | cut -d'=' -f2-)
  DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_NAME=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
else
  DB_USER="memorystory"
  DB_NAME="memorystory"
fi

if psql -U "$DB_USER" -d "$DB_NAME" -h localhost -c "SELECT 1 AS connected;" &>/dev/null 2>&1; then
  pass "数据库连接成功"
  table_count=$(psql -U "$DB_USER" -d "$DB_NAME" -h localhost -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ' || echo "0")
  info "表数量: $table_count"
else
  fail "无法连接数据库"
  info "手动测试: psql -U $DB_USER -d $DB_NAME -h localhost -c 'SELECT 1'"
fi

# ─── 4. Prisma Client ───
echo ""
echo -e "${BLUE}[4/6] Prisma Client 状态${NC}"
if [[ -d "$PROJECT_DIR/backend/node_modules/.prisma/client" ]]; then
  engine_count=$(find "$PROJECT_DIR/backend/node_modules/.prisma/client" -name "libquery_engine*" 2>/dev/null | wc -l)
  if [[ $engine_count -gt 0 ]]; then
    pass "Prisma Client 已生成 (引擎: $engine_count)"
  else
    fail "Prisma Client 目录存在但缺少引擎文件"
  fi
else
  fail "Prisma Client 未生成 — 需要运行: npx prisma generate"
fi

# ─── 5. .env 检查 ───
echo ""
echo -e "${BLUE}[5/6] .env 配置检查${NC}"
if [[ -f "$PROJECT_DIR/backend/.env" ]]; then
  pass ".env 存在"
  grep -q "^NODE_ENV=production" "$PROJECT_DIR/backend/.env" && pass "NODE_ENV=production ✓" || fail "NODE_ENV 不是 production"
  grep -q "^DATABASE_URL=" "$PROJECT_DIR/backend/.env" && pass "DATABASE_URL ✓" || fail "DATABASE_URL 未设置"
  grep -q "^JWT_ACCESS_SECRET=" "$PROJECT_DIR/backend/.env" && pass "JWT_ACCESS_SECRET ✓" || fail "JWT_ACCESS_SECRET 未设置"
  if grep -qE "^JWT_ACCESS_SECRET=change-me" "$PROJECT_DIR/backend/.env" 2>/dev/null; then
    fail "JWT 密钥仍是占位符！"
  fi
else
  fail ".env 不存在"
fi

# ─── 6. API ───
echo ""
echo -e "${BLUE}[6/6] API 可达性${NC}"
if curl -sf http://127.0.0.1:3001/api/posts > /dev/null 2>&1; then
  pass "后端 API 正常响应"
else
  fail "后端 API 无法访问 (127.0.0.1:3001)"
fi

# ─── 建议 ───
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  常见修复:${NC}"
echo ""
echo -e "  ${GREEN}1.${NC} 停止循环: ${YELLOW}pm2 delete memorystory-backend${NC}"
echo -e "  ${GREEN}2.${NC} 生成 Client: ${YELLOW}cd /var/www/memorystory/backend && npx prisma generate${NC}"
echo -e "  ${GREEN}3.${NC} 手动测试: ${YELLOW}cd /var/www/memorystory/backend && node dist/index.js${NC}"
echo -e "  ${GREEN}4.${NC} 重新部署: ${YELLOW}bash deploy-app.sh${NC}"
echo ""
