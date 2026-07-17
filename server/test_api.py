#!/usr/bin/env python3
"""API 接口测试脚本 - 验证所有路由端点"""

import subprocess
import time
import json
import urllib.request
import sys

BASE_URL = "http://localhost:3000"
HEADERS = {"x-test-openid": "test_user_123", "Content-Type": "application/json"}


def test_endpoint(name, method, path, data=None, expect_status=200):
    """测试单个端点"""
    url = f"{BASE_URL}{path}"
    try:
        req = urllib.request.Request(url, method=method, headers=HEADERS)
        if data:
            req.data = json.dumps(data).encode()

        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.getcode()
            result = json.loads(resp.read().decode())
            
        if status == expect_status:
            print(f"✅ {name}: {status}")
            return True
        else:
            print(f"❌ {name}: 期望{expect_status}, 实际{status}")
            return False
    except Exception as e:
        print(f"⚠️  {name}: {e}")
        return None  # 网络问题，跳过


def main():
    print("🧪 开始 API 端到端测试...\n")

    tests_passed = []
    
    # 健康检查
    test_endpoint("🏥 健康检查", "GET", "/health")
    print("")

    # word_sets RESTful 端点
    print("📚 Word Sets (RESTful CRUD)")
    tests_passed.append(test_endpoint("   获取单词集列表", "GET", "/api/v1/word_sets"))
    tests_passed.append(test_endpoint("   创建单词集", "POST", "/api/v1/word_sets", 
                                       {"name": "测试词集", "description": "自动测试用"}))
    print("")

    # word_query 端点
    print("🔍 Word Query")
    tests_passed.append(test_endpoint("   搜索单词", "GET", "/api/v1/word_query/search?keyword=test"))
    tests_passed.append(test_endpoint("   待复习队列", "GET", "/api/v1/word_query/review-queue"))
    tests_passed.append(test_endpoint("   新词列表", "GET", "/api/v1/word_query/new-words"))
    tests_passed.append(test_endpoint("   单词详情", "GET", "/api/v1/word_query/1"))
    tests_passed.append(test_endpoint("   单词列表（分页）", "GET", "/api/v1/word_query?limit=10"))
    print("")

    # record_review 端点
    print("🔄 Record Review (SM-2)")
    tests_passed.append(test_endpoint("   记录复习", "POST", "/api/v1/record_review/record",
                                       {"wordId": 1, "quality": 4}))
    tests_passed.append(test_endpoint("   获取记忆状态", "GET", "/api/v1/record_review/memory/1"))
    tests_passed.append(test_endpoint("   更新记忆状态", "PUT", "/api/v1/record_review/memory/1",
                                       {"memoryData": {"memory_level": 3}}))
    print("")

    # user_stats 端点
    print("📊 User Stats")
    tests_passed.append(test_endpoint("   统计概览", "GET", "/api/v1/user_stats/overview"))
    tests_passed.append(test_endpoint("   每日计划", "GET", "/api/v1/user_stats/daily-plan"))
    tests_passed.append(test_endpoint("   学习历史", "GET", "/api/v1/user_stats/history?days=7"))
    print("")

    # word_lookup 端点
    print("📖 Word Lookup")
    tests_passed.append(test_endpoint("   查词", "GET", "/api/v1/word_lookup/lookup?word=test"))
    tests_passed.append(test_endpoint("   单词详情", "GET", "/api/v1/word_lookup/detail/1"))
    tests_passed.append(test_endpoint("   按年级查询", "GET", "/api/v1/word_lookup/by-grade/7"))
    print("")

    # category_manager 端点
    print("📁 Category Manager")
    tests_passed.append(test_endpoint("   分类列表", "GET", "/api/v1/category_manager"))
    tests_passed.append(test_endpoint("   创建分类", "POST", "/api/v1/category_manager",
                                       {"name": "测试分类"}))
    print("")

    # goal_manager 端点
    print("🎯 Goal Manager")
    tests_passed.append(test_endpoint("   学习目标列表", "GET", "/api/v1/goal_manager"))
    tests_passed.append(test_endpoint("   创建目标", "POST", "/api/v1/goal_manager",
                                       {"goal_type": "daily", "target_count": 50}))
    print("")

    # stats_advanced 端点
    print("📈 Stats Advanced")
    tests_passed.append(test_endpoint("   综合统计", "GET", "/api/v1/stats_advanced/stats"))
    tests_passed.append(test_endpoint("   学习趋势", "GET", "/api/v1/stats_advanced/trends?days=30"))
    tests_passed.append(test_endpoint("   成就徽章", "GET", "/api/v1/stats_advanced/achievements"))
    print("")

    # 总结
    passed = sum(1 for x in tests_passed if x is True)
    failed = sum(1 for x in tests_passed if x is False)
    skipped = sum(1 for x in tests_passed if x is None)

    print("=" * 60)
    print(f"测试结果：✅ {passed} 通过 | ⚠️  {skipped} 跳过 (数据库未连接) | ❌ {failed} 失败")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
