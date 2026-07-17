#!/bin/bash
# 词库迁移工具 - 执行脚本
# Author: 一帮人马工作室（QQ691481548）

echo "================================================"
echo "📖 单词记忆系统 - 词库迁移工具 v1.0"
echo "Author: 一帮人马工作室（QQ691481548）"
echo "================================================"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查 Python 环境
PYTHON_CMD="python3.12"
if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "❌ 未找到 python3.12，尝试使用默认的 python3"
    PYTHON_CMD="python3"
fi

echo "使用 Python: $($PYTHON_CMD --version)"

# 安装依赖
echo ""
echo "🔧 检查依赖..."
$PYTHON_CMD -c "import mysql.connector" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  mysql-connector-python 未安装，开始安装..."
    pip3 install mysql-connector-python --break-system-packages
fi

# 执行迁移
echo ""
echo "🚀 开始迁移..."
$PYTHON_CMD migrate_words.py

EXIT_CODE=$?

echo ""
echo "================================================"
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ 迁移任务完成！"
else
    echo "❌ 迁移任务失败，请检查日志"
fi
echo "================================================"

exit $EXIT_CODE
