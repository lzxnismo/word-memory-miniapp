#!/usr/bin/env python3
"""
查看 SQLite 数据库结构 - 为小程序迁移做准备
"""
import sqlite3

db_path = '/root/.hermes/project/word_memory_system/backend/data/word_memory.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 获取所有表名
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]

print("=" * 60)
print(f"数据库共有 {len(tables)} 张表")
print("=" * 60)

for table in tables:
    print(f"\n📋 表名：{table}")
    
    # 获取字段信息
    cursor.execute(f"PRAGMA table_info({table});")
    columns = cursor.fetchall()
    print(f"   字段数量：{len(columns)}")
    
    for col in columns:
        cid, name, ptype, notnull, default_value, pk = col
        pk_str = " PRIMARY KEY" if pk else ""
        nn_str = " NOT NULL" if notnull else ""
        df_str = f" DEFAULT {default_value}" if default_value else ""
        print(f"   - {name:25} | {ptype:10} | {pk_str}{nn_str}{df_str}")
        
    # 获取样例数据（前 2 条）
    cursor.execute(f"SELECT * FROM {table} LIMIT 2;")
    sample = cursor.fetchall()
    if sample:
        print(f"   样例数据行数：{len(sample)}")
        
conn.close()
