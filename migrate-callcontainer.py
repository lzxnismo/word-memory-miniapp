#!/usr/bin/env python3
"""
前端云函数调用迁移工具 - v2.0
将 wx.cloud.callFunction 转换为 wx.cloud.callContainer
"""

import os
import re
from pathlib import Path

# 云函数名 → API 路径映射表
ROUTE_MAP = {
    'word_sets': '/api/v1/word_sets',
    'word_query': '/api/v1/word_query', 
    'record_review': '/api/v1/record_review',
    'user_stats': '/api/v1/user_stats',
    'word_lookup': '/api/v1/word_lookup',
    'category_manager': '/api/v1/category_manager',
    'goal_manager': '/api/v1/goal_manager',
    'stats_advanced': '/api/v1/stats_advanced',
}

def migrate_file(file_path):
    """迁移单个文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    replacements = []
    
    # 查找所有 callFunction 调用（支持多行）
    pattern = r'(wx\.cloud\.callFunction\(\{)([\s\S]*?)(name:\s*[\'"](\w+)[\'"])((?:\s*,[\s\S]*?)?\s*\}\))'
    
    def replacer(match):
        prefix = match.group(1)
        before_name = match.group(2)
        name_part = match.group(3)
        after_name = match.group(4)
        suffix = "})" if match.group(5).strip() == "})" else match.group(5)
        
        func_name = match.group(4)
        route = ROUTE_MAP.get(func_name)
        
        if not route:
            print(f"⚠️ 未找到路由映射：{func_name}")
            return match.group(0)
        
        # 提取 action（如果有）
        action_match = re.search(r'action:\s*[\'"](\w+)[\'"]', after_name)
        action = f", action: '{action_match.group(1)}'" if action_match else ""
        
        # 构建新的调用
        new_call = f"""wx.cloud.callContainer({{
      path: '{route}'{action},
      method: 'POST',
      header: {{ 'content-type': 'application/json' }}"""
        
        # 保留原有的数据部分
        data_match = re.search(r'data:\s*({[^}]+})', after_name)
        if data_match and action:
            # 已经有 action，不需要额外添加
            new_call += f",\n      data: {data_match.group(1)}"
        elif data_match:
            new_call += f",\n      data: {data_match.group(1)}"
        elif action:
            new_call += f",\n      data: {{}}"
        
        # 移除原有的 name 参数
        modified_after = re.sub(r'\s*,\s*name:\s*[\'"][\w]+[\'"]', '', after_name)
        modified_before = re.sub(r'\s*,\s*method:\s*[\'"]post[\'"]', '', before_name)
        
        result = f"{prefix}{modified_before.strip()}"
        if data_match or action:
            result += f"\n{new_call}"
        else:
            result += f"\n{new_call}"
        
        # 添加回调处理
        callback_match = re.search(r'success:\s*\(([\w]+)\)', match.group(5) if len(match.groups()) > 5 else "")
        if callback_match:
            result += f"\n    }})"
        else:
            result += f"\n    }}"
        
        replacements.append(route)
        return result
    
    # 执行替换
    new_content = re.sub(pattern, replacer, content, flags=re.DOTALL)
    
    if replacements:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"✅ {file_path}: {len(replacements)} 处替换")
        for r in replacements:
            print(f"   → {r}")
        return True
    
    return False


def main():
    base_dir = Path('/opt/win_hermes/word_memory_miniapp/pages')
    
    files_to_migrate = [
        'dictation/dictation.js',
        'flash-card/flash-card.js',
        'goal-manager/goal-manager.js',
        'index/index.js',
        'plan-daily/plan-daily.js',
        'settings/settings.js',
        'stats-stats/stats.js',
        'word-detail/word-detail.js',
        'words-list/words-list.js',
        'wordset-detail/wordset-detail.js',
        'wordset-list/wordset-list.js',
    ]
    
    print("🚀 开始迁移前端云函数调用...\n")
    total_count = 0
    
    for file_rel_path in files_to_migrate:
        file_path = base_dir / file_rel_path
        
        if file_path.exists():
            if migrate_file(str(file_path)):
                total_count += 1
            else:
                print(f"ℹ️  {file_rel_path}: 无需修改")
        else:
            print(f"❌ 文件不存在：{file_path}")
    
    print(f"\n{'='*50}")
    print(f"🎉 完成！已修改 {total_count} 个文件")
    print("="*50)


if __name__ == '__main__':
    main()
