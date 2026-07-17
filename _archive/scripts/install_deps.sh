#!/bin/bash
# 云函数批量部署脚本 - 安装 mysql2 依赖
# Author: 一帮人马工作室（QQ691481548）

echo "================================================"
echo "📦 微信小程序云函数 - MySQL 依赖安装"
echo "Author: 一帮人马工作室 (QQ691481548)"
echo "================================================"
echo ""

CLOUDFUNCTIONS_DIR="/opt/win_hermes/word_memory_miniapp/cloudfunctions"

FUNCTIONS=(
  "word_sets"
  "category_manager" 
  "goal_manager"
  "stats_advanced"
  "word_lookup"
)

for func in "${FUNCTIONS[@]}"; do
  echo "🔧 处理 $func ..."
  cd "$CLOUDFUNCTIONS_DIR/$func"
  
  # 检查 package.json
  if [ ! -f "package.json" ]; then
    echo "   ❌ 未找到 package.json，跳过"
    continue
  fi
  
  # 检查是否已有 mysql2
  if grep -q '"mysql2"' package.json; then
    echo "   ✅ package.json 已包含 mysql2 依赖"
    
    # 提示用户在微信开发者工具中执行
    echo "   💡 请在微信开发者工具右键点击该云函数 → '安装 npm 依赖'"
  else
    echo "   ⚠️  package.json 缺少 mysql2 依赖"
  fi
  
  echo ""
done

echo "================================================"
echo "✅ 检查完成！"
echo ""
echo "💡 部署步骤："
echo "   1. 在微信开发者工具中打开项目"
echo "   2. 右键点击每个云函数文件夹"
echo "   3. 选择 '安装 npm 依赖'"
echo "   4. 等待安装完成后上传云函数"
echo ""
echo "================================================"