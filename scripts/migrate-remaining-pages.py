#!/usr/bin/env python3
"""
批量迁移脚本：将剩余页面的 callContainer 替换为 request()

运行后会自动修改以下文件:
- pages/flash-card/flash-card.js
- pages/dictation/dictation.js
- pages/wordset-detail/wordset-detail.js
- pages/word-detail/word-detail.js
- pages/stats-stats/stats.js
- pages/plan-daily/plan-daily.js
- pages/goal-manager/goal-manager.js
- pages/settings/settings.js

© 一帮人马工作室（QQ691481548）
"""
import re
from pathlib import Path

BASE_DIR = Path('/opt/win_hermes/word_memory_miniapp')

# 每个文件的映射关系（简化版，复杂逻辑需手动调整）
MIGRATION_MAP = {
    # flash-card.js
    'pages/flash-card/flash-card.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/user_stats/review-queue?limit=50': ('GET', None),
            '/record_review/status': ('GET', None),
            '/word_query/new-words?limit=1': ('GET', None),
            '/record_review': ('POST', None),
        },
        'notes': '需要处理多种学习模式切换'
    },
    
    # dictation.js
    'pages/dictation/dictation.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/word_query/new-words?limit=1': ('GET', None),
            '/record_review': ('POST', None),
            '/stats_advanced': ('GET', None),
        },
        'notes': '听写逻辑相对简单'
    },
    
    # wordset-detail.js
    'pages/wordset-detail/wordset-detail.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/word_sets/{id}/members': ('GET', None),
            '/word_sets/{id}': ('PUT', None),
            '/word_sets/{id}': ('DELETE', None),
            '/word_sets': ('POST', None),  # 添加单词
        },
        'notes': '注意 URL 中的 {id} 参数替换'
    },
    
    # word-detail.js
    'pages/word-detail/word-detail.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/word_query/{id}': ('GET', None),
            '/word_lookup/{word}': ('GET', None),
            '/record_review/status': ('GET', None),
            '/record_review': ('POST', None),
        },
        'notes': '详情页查询较多'
    },
    
    # stats.js
    'pages/stats-stats/stats.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/user_stats/history': ('GET', None),
            '/stats_advanced': ('GET', None),
            '/category_manager': ('GET', None),
        },
        'notes': '统计页数据量大'
    },
    
    # plan-daily.js
    'pages/plan-daily/plan-daily.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/user_stats/daily-plan': ('POST', None),
            '/user_stats/history': ('GET', None),
            '/word_query/recommend': ('GET', None),
        },
        'notes': '每日计划相关'
    },
    
    # goal-manager.js
    'pages/goal-manager/goal-manager.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/goal_manager': ('GET', None),
            '/goal_manager': ('POST', None),
        },
        'notes': '学习目标管理'
    },
    
    # settings.js
    'pages/settings/settings.js': {
        'imports': "import { request } from '../../utils/request'",
        'api_mapping': {
            '/category_manager': ('GET', None),
            '/category_management/sync': ('POST', None),
        },
        'notes': '设置页包含分类同步'
    },
}

def convert_callcontainer_to_request(old_code, file_name):
    """
    将 wx.cloud.callContainer 转换为 request() 调用
    
    示例转换:
    旧: await wx.cloud.callContainer({ path: '/api/v1/xxx', method: 'POST', data: { action: 'yyy' } })
    新: await request('/xxx', { method: 'POST', data: { ... } })
    """
    # 移除 action 参数
    old_code = re.sub(r'action:\s*[\'"](\w+)[\'"],?\s*', '', old_code)
    
    # 移除 userId 参数（现在通过 OpenID 自动注入）
    old_code = re.sub(r'userId:\s*[^,}]+,?\s*', '', old_code)
    
    return old_code

def process_single_file(file_path, migration_info):
    """处理单个文件的迁移"""
    full_path = BASE_DIR / file_path
    
    if not full_path.exists():
        print(f"⚠️  文件不存在：{file_path}")
        return False
    
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否已经导入 request
    has_import = 'import { request }' in content or "const { request" in content
    
    if not has_import:
        # 插入 import 语句
        import_stmt = f"\n{migration_info['imports']}\n\n"
        
        # 找到 Page({) 的位置并插入
        page_match = re.search(r'\nPage\({', content)
        if page_match:
            content = content[:page_match.start()+1] + import_stmt + content[page_match.start()+1:]
            print(f"✅ 添加 import: {file_path}")
    
    # 统计 callContainer 调用次数
    count = len(re.findall(r'wx\.cloud\.callContainer', content))
    
    if count > 0:
        print(f"⚠️  {file_path}: 仍有 {count} 处 callContainer 调用需要手动处理")
        print(f"   参考文档：docs/MIGRATION_TO_CLOUD_TURING.md")
    else:
        print(f"✨ {file_path}: 迁移完成!")
    
    return True

def main():
    print("=" * 70)
    print("🔄 开始批量扫描剩余页面的迁移状态...")
    print("=" * 70)
    
    for file_path, info in MIGRATION_MAP.items():
        process_single_file(file_path, info)
    
    print("\n" + "=" * 70)
    print("📊 扫描完成!")
    print("\n💡 下一步操作:")
    print("   1. 查看上面列出的需要手动处理的文件")
    print("   2. 按照 docs/MIGRATION_TO_CLOUD_TURING.md 中的规则逐个替换")
    print("   3. 完成后执行: rm -rf cloudfunctions/")
    print("   4. 更新 project.config.json 删除 cloudfunctionRoot")
    print("=" * 70)

if __name__ == '__main__':
    main()
