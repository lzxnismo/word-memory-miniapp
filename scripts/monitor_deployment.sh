#!/bin/bash
# 监控云托管部署状态和接口健康检查

API_URL="https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com"
OPENID="test_user_001"
COUNTER=0
MAX_RETRIES=15

echo "=========================================="
echo "开始监控部署状态..."
echo "目标：$API_URL"
echo "预计等待时间：$((MAX_RETRIES * 30)) 秒"
echo "=========================================="

while [ $COUNTER -lt $MAX_RETRIES ]; do
    COUNTER=$((COUNTER + 1))
    echo ""
    echo "[$(date '+%H:%M:%S')] 第 $COUNTER 次检查..."
    
    # 健康检查
    HEALTH=$(curl -s "$API_URL/health" | head -c 50)
    
    # 测试 user_settings (关键修复点)
    SETTINGS=$(curl -s -X GET "$API_URL/api/v1/user_settings" -H "x-test-openid:$OPENID" 2>/dev/null)
    
    # 检查是否修复成功
    if echo "$SETTINGS" | grep -q "doesn't exist"; then
        echo "  ❌ 仍在部署中... (旧代码)"
        sleep 30
        continue
    fi
    
    if echo "$SETTINGS" | grep -q '"code":200'; then
        echo "  ✅ 部署成功！"
        echo ""
        echo "=== 测试结果 ==="
        echo "$SETTINGS" | python3 -m json.tool 2>/dev/null || echo "$SETTINGS"
        echo ""
        echo "=============================="
        echo "✅ 用户设置接口已恢复正常！"
        exit 0
    fi
    
    echo "  ⏳ 返回结果异常: $SETTINGS"
    sleep 30
done

echo ""
echo "=============================="
echo "❌ 等待超时，请手动检查云开发控制台"
exit 1
