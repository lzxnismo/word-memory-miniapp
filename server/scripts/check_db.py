#!/usr/bin/env python3
"""快速检查数据库表结构"""
import mysql.connector
import sys

con = mysql.connector.connect(
    host='sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
    port=27780,
    user='word_memory_app',
    password='Root_123',
    database='mytx-d7gw0vhq4414988b5'
)
cur = con.cursor()

print("📋 现有表列表:")
cur.execute('SHOW TABLES')
tables = cur.fetchall()
for t in tables:
    print(f"  • {t[0]}")

# 查看每个表的字段
print("\n🔍 详细表结构:")
for table in [t[0] for t in tables]:
    cur.execute(f'DESCRIBE {table}')
    columns = cur.fetchall()
    print(f"\n{table}:")
    for col in columns:
        print(f"  {col[0]} ({col[1]}, {col[2]})")

cur.close()
con.close()
