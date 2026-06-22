#!/usr/bin/env bash
# ──────────────────────────────────────────────
# 视频壁纸压缩 — 2K → 720p (~155MB → ~5MB)
# 用法: bash compress-video.sh
# ──────────────────────────────────────────────
set -euo pipefail

INPUT="frontend/images/Suvan_2k_02b29.mp4"
OUTPUT="frontend/images/Suvan_compressed.mp4"

if ! command -v ffmpeg &>/dev/null; then
  echo -e "\033[31m❌ ffmpeg 未安装\033[0m"
  echo ""
  echo "安装 ffmpeg:"
  echo "  Windows (winget): winget install ffmpeg"
  echo "  macOS (brew):     brew install ffmpeg"
  echo "  Ubuntu/Debian:    sudo apt install ffmpeg"
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "❌ 输入文件不存在: $INPUT"
  echo "   请先运行: git lfs pull"
  exit 1
fi

BEFORE=$(du -h "$INPUT" | cut -f1)
echo "📦 原始: $INPUT ($BEFORE)"
echo "🎬 压缩中 (2K → 720p, CRF 28)..."

ffmpeg -i "$INPUT" \
  -vf "scale=-2:720" \
  -c:v libx264 \
  -crf 28 \
  -preset fast \
  -c:a aac \
  -b:a 48k \
  -movflags +faststart \
  -y \
  "$OUTPUT"

AFTER=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "✅ 完成: $OUTPUT ($AFTER)"
echo ""
echo "下一步:"
echo "  1. 编辑 frontend/src/pages/Home.tsx 第 10 行:"
echo "     -import heroVideo from '../../images/Suvan_2k_02b29.mp4';"
echo "     +import heroVideo from '../../images/Suvan_compressed.mp4';"
echo "  2. 验证构建: cd frontend && npm run build"
