#!/usr/bin/env python3
"""
前端云函数调用迁移工具
将 wx.cloud.callFunction({ name: 'xxx', data: ... }) 
转换为 wx.cloud.callContainer({ path: '/api/v1/xxx', method: 'POST', data: ... })
"""

import os
import re
from pathlib import Path

# 映射表：云函数名 → API 路径
FUNCTION_TO_ROUTE = {
    'word_sets': '/api/v1/word_sets',
    'word_query': '/api/v1/word_query',
    'record_review': '/api/v1/record_review',
    'user_stats': '/api/v1/user_stats',
    'word_lookup': '/api/v1/word_lookup',
    'category_manager': '/api/v1/category_manager',
    'goal_manager': '/api/v1/goal_manager',
    'stats_advanced': '/api/v1/stats_advanced',
}

def replace_call_function(content, filepath):
    """替换单个文件中的 callFunction 调用"""
    lines = content.split('\n')
    new_lines = []
    replacements = 0
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # 检测是否包含 callFunction
        if 'wx.cloud.callFunction' in line:
            # 尝试提取函数名和数据
            match = re.search(r'name:\s*[\'"](\w+)[\'"]', line)
            if match:
                func_name = match.group(1)
                
                # 检查是否在同一行有完整调用（单行模式）
                if 'data:' in line and 'success' in line:
                    route_path = FUNCTION_TO_ROUTE.get(func_name)
                    if route_path:
                        # 替换为 callContainer
                        old_pattern = rf"name:\s*['\"]{func_name}['\"]"
                        new_code = f"path: '{route_path}', method: 'POST'"
                        new_line = line.replace(f"name: '{func_name}'", f"path: '{route_path}'").replace(f'name: "{func_name}"', f"path: '{route_path}'")
                        new_line = re.sub(r"method:\s*['\"]post['\"]", f"method: 'POST'", new_line)
                        
                        # 添加 method
                        if "method:" not in new_line:
                            new_line = new_line.replace("path:", "method: 'POST',\n      path:")
                        
                        new_lines.append(new_line)
                        replacements += 1
                        print(f"✅ {filepath}:{i+1}: {func_name} → {route_path}")
                    else:
                        new_lines.append(line)
                        print(f"⚠️ {filepath}:{i+1}: 未找到路由映射 {func_name}")
                else:
                    # 多行模式 - 需要收集更多行
                    start_i = i
                    block_content = [line]
                    
                    # 收集整个 callFunction 块
                    open_count = line.count('(') - line.count(')')
                    j = i + 1
                    while j < len(lines) and open_count > 0:
                        block_content.append(lines[j])
                        open_count += lines[j].count('(') - lines[j].count(')')
                        j += 1
                    
                    block_text = '\n'.join(block_content)
                    
                    # 提取函数名和数据
                    name_match = re.search(r"name:\s*['\"](\w+)['\"]", block_text)
                    data_match = re.search(r"data:\s*({[^}]+})", block_text, re.DOTALL)
                    
                    if name_match:
                        func_name = name_match.group(1)
                        route_path = FUNCTION_TO_ROUTE.get(func_name)
                        
                        if route_path:
                            # 构建新的 callContainer 调用
                            data_part = data_match.group(1) if data_match else "{}"
                            
                            # 尝试保留原有代码结构
                            success_idx = next((k for k, l in enumerate(block_content) if 'success:' in l), None)
                            fail_idx = next((k for k, l in enumerate(block_content) if 'fail:' in l or 'catch' in l), None)
                            
                            if success_idx is not None:
                                # 重构为 callContainer
                                new_block = [
                                    f"    wx.cloud.callContainer({{",
                                    f"      path: '{route_path}',",
                                    f"      method: 'POST',",
                                    f"      data: {data_part}",
                                ]
                                
                                # 找回调部分并添加到新块
                                callback_started = False
                                indent = "    "
                                for k in range(success_idx, len(block_content)):
                                    if 'success:' in block_content[k]:
                                        callback_started = True
                                        new_block.append(f"{block_content[k].replace('success:', 'success:')}")
                                    elif 'fail:' in block_content[k] or 'complete:' in block_content[k]:
                                        new_block.append(f"{block_content[k]}")
                                    elif callback_started:
                                        new_block.append(f"{block_content[k]}")
                                    elif block_content[k].strip() == '},' or block_content[k].strip() == '})':
                                        continue
                                
                                new_block.append("    });")
                                
                                new_lines.extend(new_block)
                                replacements += 1
                                print(f"✅ {filepath}:{start_i+1}: {func_name} → {route_path} (multiline)")
                                i = j - 1
                            else:
                                new_lines.append(line)
                        else:
                            new_lines.append(line)
                            print(f"⚠️ {filepath}:{i+1}: 未找到路由映射 {func_name}")
                    else:
                        new_lines.append(line)
                i += 1
            else:
                new_lines.append(line)
                i += 1
        else:
            new_lines.append(line)
            i += 1
    
    return '\n'.join(new_lines), replacements


def main():
    base_dir = Path('/opt/win_hermes/word_memory_miniapp')
    pages_dir = base_dir / 'pages'
    
    total_replacements = 0
    modified_files = []
    
    # 遍历所有 JS 文件
    for js_file in pages_dir.rglob('*.js'):
        rel_path = js_file.relative_to(base_dir)
        
        try:
            content = js_file.read_text(encoding='utf-8')
            
            if 'wx.cloud.callFunction' not in content:
                continue
            
            new_content, count = replace_call_function(content, rel_path)
            
            if count > 0:
                js_file.write_text(new_content, encoding='utf-8')
                total_replacements += count
                modified_files.append(str(rel_path))
                print(f"\n📝 已更新：{rel_path}")
        
        except Exception as e:
            print(f"❌ 处理 {rel_path} 失败：{e}")
    
    print("\n" + "="*50)
    print(f"🎉 完成！共替换 {total_replacements} 处调用")
    print(f"   修改了 {len(modified_files)} 个文件")
    print("\n📋 修改文件列表:")
    for f in modified_files:
        print(f"   • {f}")


if __name__ == '__main__':
    main()
