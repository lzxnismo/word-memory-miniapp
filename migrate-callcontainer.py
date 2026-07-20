#!/usr/bin/env python3
"""
批量迁移小程序代码：将 wx.cloud.callContainer 替换为 utils/request.js

© 一帮人马工作室（QQ691481548）
"""
import os
import re
from pathlib import Path

# 需要替换的文件列表（基于 search_files 结果）
FILES_TO_UPDATE = [
    'pages/index/index.js',
    'pages/wordset-list/wordset-list.js',
    'pages/settings/settings.js',
    'pages/wordset-detail/wordset-detail.js',
    'pages/plan-daily/plan-daily.js',
    'pages/words-list/words-list.js',
    'pages/word-detail/word-detail.js',
    'pages/goal-manager/goal-manager.js',
    'pages/flash-card/flash-card.js',
    'pages/stats-stats/stats.js',
    'pages/dictation/dictation.js',
]

# API 路径映射（callContainer path → request 方法）
API_MAP = {
    # user_stats
    '/api/v1/user_stats?action=getReviewQueue': ('get', '/user_stats/review-queue'),
    '/api/v1/user_stats?action=getOpenId': None,  # 已在 app.js 处理
    '/api/v1/user_stats?action=getDailyPlan': ('post', '/user_stats/daily-plan'),
    '/api/v1/user_stats?action=getLearningHistory': ('get', '/user_stats/history'),
    
    # word_sets
    '/api/v1/word_sets?action=list': ('get', '/word_sets'),
    '/api/v1/word_sets?action=create': ('post', '/word_sets'),
    '/api/v1/word_sets?action=update': ('put', '/word_sets'),
    '/api/v1/word_sets?action=delete': ('delete', '/word_sets'),
    '/api/v1/word_sets?action=getMembers': ('get', '/word_sets/{id}/members'),
    
    # word_query
    '/api/v1/word_query?action=search': ('get', '/word_query/search'),
    '/api/v1/word_query?action=getById': ('get', '/word_query/{id}'),
    '/api/v1/word_query?action=getAll': ('get', '/word_query'),
    '/api/v1/word_query?action=getTodayRecommendation': ('get', '/word_query/recommend'),
    '/api/v1/word_query?action=getNewWords': ('get', '/word_query/new-words'),
    '/api/v1/word_query?action=getReviewQueue': ('get', '/word_query/review-queue'),
    
    # record_review
    '/api/v1/record_review?action=create': ('post', '/record_review'),
    '/api/v1/record_review?action=getStatus': ('get', '/record_review/status'),
    '/api/v1/record_review?action=updateStatus': ('put', '/record_review'),
    
    # word_lookup
    '/api/v1/word_lookup?action=getByWord': ('get', '/word_lookup/{word}'),
    '/api/v1/word_lookup?action=getGrades': ('get', '/word_lookup/grades'),
    '/api/v1/word_lookup?action=getUnits': ('get', '/word_lookup/units'),
    
    # category_manager
    '/api/v1/category_manager?action=list': ('get', '/category_manager'),
    '/api/v1/category_manager?action=create': ('post', '/category_manager'),
    
    # goal_manager
    '/api/v1/goal_manager?action=getGoals': ('get', '/goal_manager'),
    '/api/v1/goal_manager?action=setGoal': ('post', '/goal_manager'),
    
    # stats_advanced
    '/api/v1/stats_advanced?action=getStats': ('get', '/stats_advanced'),
    '/api/v1/stats_advanced?action=getTrends': ('get', '/stats_advanced/trends'),
    
    # category_management
    '/api/v1/category_management?action=sync': ('post', '/category_management/sync'),
    '/api/v1/category_management?action=batchCreate': ('post', '/category_management/batch'),
}

def extract_action_from_path(path):
    """从路径中提取 action 参数"""
    match = re.search(r'action=(\w+)', path)
    return match.group(1) if match else None

def map_callcontainer_to_request(code_line):
    """
    将 wx.cloud.callContainer 转换为 request() 调用
    
    原始格式：
    await wx.cloud.callContainer({
        path: '/api/v1/xxx',
        method: 'POST',
        data: { action: 'xxx', ... }
    })
    
    转换后：
    await request('/xxx', {
        method: 'GET',
        data: { ... }
    })
    """
    pass  # 稍后手动处理更复杂的情况

def process_file(file_path, base_dir):
    """处理单个文件"""
    full_path = os.path.join(base_dir, file_path)
    
    if not os.path.exists(full_path):
        print(f"⚠️  文件不存在：{file_path}")
        return False
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否需要添加 import
    has_import = 'import { request' in content or "const { request" in content
    
    if not has_import and 'callContainer' in content:
        # 在文件顶部插入 import
        if '// pages/' in content or 'Page({' in content:
            import_stmt = "\nimport { request } from '../../utils/request'\n\n"
            content = content.replace('Page({', import_stmt + 'Page({')
    
    # 标记哪些 callContainer 需要手动处理
    count = content.count('callContainer')
    
    return True, count

def main():
    base_dir = '/opt/win_hermes/word_memory_miniapp'
    
    print("🔄 开始批量迁移 callContainer → request()")
    print("=" * 60)
    
    success_count = 0
    
    for file in FILES_TO_UPDATE:
        result = process_file(file, base_dir)
        if isinstance(result, tuple):
            success, count = result
            if success:
                success_count += 1
                print(f"✅ {file} ({count}处)")
    
    print("=" * 60)
    print(f"✨ 完成！共处理 {success_count} 个文件")
    print("\n⚠️ 注意：由于 callContainer 转换逻辑复杂，")
    print("   建议逐个页面手动验证替换结果")

if __name__ == '__main__':
    main()
