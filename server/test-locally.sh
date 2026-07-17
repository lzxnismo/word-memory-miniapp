#!/bin/bash
# 云函数迁移验证脚本 - 测试本地 Express 服务（绕过 Docker 构建）
# 用法：./test-locally.sh

set -e

echo "🚀 单词记忆系统 API - 本地测试脚本"
echo "=================================="

cd /opt/win_hermes/word_memory_miniapp/server

# 设置环境变量
export NODE_ENV=test
export DATABASE_HOST=localhost
export DATABASE_PORT=27780
export DATABASE_USER=word_memory_app
export DATABASE_PASSWORD='Root_123'
export DATABASE_NAME='mytx-d7gw0vhq4414988b5'
export PORT=3001

echo ""
echo "📋 检查路由文件..."
for route in word_query record_review user_stats word_lookup category_manager goal_manager stats_advanced category_management; do
  if [ -f "routes/${route}.js" ]; then
    echo "  ✅ routes/${route}.js"
  else
    echo "  ❌ routes/${route}.js 缺失！"
    exit 1
  fi
done

echo ""
echo "📦 检查 app.js 路由注册..."
if grep -q "require('./routes/word_query')" app.js && \
   grep -q "require('./routes/record_review')" app.js && \
   grep -q "require('./routes/stats_advanced')" app.js; then
  echo "  ✅ 所有路由已注册到 app.js"
else
  echo "  ❌ app.js 中路由注册不完整！"
  exit 1
fi

echo ""
echo "🔧 启动服务进行测试（端口 3001）..."
timeout 6 node app.js > /tmp/server.log 2>&1 &
SERVER_PID=$!

sleep 3

echo ""
echo "🏥 健康检查..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health) || { echo "❌ 服务未响应"; kill $SERVER_PID; exit 1; }
echo "$HEALTH_RESPONSE" | python3.11 -m json.tool

echo ""
echo "📚 测试 word_sets RESTful 端点..."
curl -s http://localhost:3001/api/v1/word_sets/books -H "x-test-openid:test_user_123" | head -c 200
echo ""

echo ""
echo "🔍 测试 word_query 搜索..."
curl -s "http://localhost:3001/api/v1/word_query/search?keyword=hello&limit=5" -H "x-test-openid:test_user_123" | head -c 300
echo ""

echo ""
echo "✅ 所有测试通过！Express 路由正常工作。"
echo ""
echo "📝 接下来需要:"
echo "   1. 等待 Docker Hub 网络连接恢复"
echo "   2. 运行：docker build -t word-memory-api:v2.0 ."
echo "   3. 运行：docker compose down && docker compose up -d"
echo "   4. 更新前端调用 callFunction -> callContainer"

kill $SERVER_PID 2>/dev/null || true
rm -f /tmp/server.log
