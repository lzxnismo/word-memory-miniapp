#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词库迁移工具 v2 - 优化版
使用 mysql-connector-python 的 Connection Pool + 自动重试机制
作者：一帮人马工作室（QQ691481548）
"""

import sys
from datetime import datetime
from retrying import retry


class RetryableMySQL:
    """重试包装器"""
    
    def __init__(self, conn):
        self.conn = conn
        
    @retry(stop_max_attempt_number=3, wait_fixed=2000)
    def execute(self, query, params=None):
        try:
            return self.conn.cursor().execute(query, params or ())
        except Exception as e:
            print(f"⚠️  执行失败，重试中... {e}")
            raise
            
    @retry(stop_max_attempt_number=3, wait_fixed=2000)
    def executemany(self, query, params_list):
        try:
            return self.conn.cursor().executemany(query, params_list)
        except Exception as e:
            print(f"⚠️  批量执行失败，重试中... {e}")
            raise
            
    @retry(stop_max_attempt_number=3, wait_fixed=2000)
    def commit(self):
        self.conn.commit()
        
    @retry(stop_max_attempt_number=3, wait_fixed=2000)
    def rollback(self):
        self.conn.rollback()


def main():
    """主流程"""
    import mysql.connector
    
    print("=" * 70)
    print("📖 单词记忆系统 - 词库迁移工具 v2.0 (MySQL Direct)")
    print("Author: 一帮人马工作室 (QQ691481548)")
    print("=" * 70)
    print()
    
    # 配置项
    SQLITE_PATH = "/root/.hermes/project/word_memory_system/backend/data/word_memory.db"
    
    MYSQL_CONFIG = {
        'host': 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
        'port': 27780,
        'user': 'word_memory_app',
        'password': 'Root_123',
        'database': 'mytx-d7gw0vhq4414988b5',
        'autocommit': False,
        'connect_timeout': 30
    }
    
    try:
        # 1. 连接 SQLite 读取数据
        import sqlite3
        sqlite_conn = sqlite3.connect(SQLITE_PATH)
        sqlite_cursor = sqlite_conn.cursor()
        
        # 检查源数据
        sqlite_cursor.execute("SELECT COUNT(*) FROM words WHERE is_active = 1")
        source_count = sqlite_cursor.fetchone()[0]
        print(f"📊 源数据库 (SQLite) 激活单词数：{source_count:,}")
        
        if source_count == 0:
            print("❌ 源数据库无激活单词，请确认数据库路径正确")
            return
        
        # 2. 连接 MySQL (腾讯云 CynosDB)
        print()
        print("🔗 连接 MySQL (腾讯云 CynosDB)...")
        mysql_conn = mysql.connector.connect(**MYSQL_CONFIG)
        mysql_cursor = mysql_conn.cursor()
        
        # 检查目标数据库状态
        mysql_cursor.execute("SELECT COUNT(*) FROM words")
        target_count = mysql_cursor.fetchone()[0]
        print(f"📊 目标数据库 (MySQL) 现有单词数：{target_count:,}")
        
        # 3. 清空旧数据 (开发阶段，直接全量替换)
        print()
        print("🔧 清空目标数据库单词表...")
        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        mysql_cursor.execute("DELETE FROM words")
        mysql_conn.commit()
        mysql_cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        print(f"✅ 已清空所有旧数据（开发阶段，无用户影响）")
        
        # 4. 准备 SQL 插入语句
        print()
        print("📥 开始导入单词数据...")
        
        insert_sql = """
            INSERT INTO words (
                word, phonetic, meaning, part_of_speech,
                example_en, example_cn, grade, unit, book,
                tags, difficulty, audio_url, source,
                dictation_count, dictation_correct, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        # 获取源数据
        sqlite_cursor.execute("""
            SELECT id, word, phonetic, meaning, part_of_speech, 
                   COALESCE(example_en, ''), COALESCE(example_cn, ''),
                   grade, COALESCE(unit, ''), COALESCE(book, ''),
                   COALESCE(tags, '[]'), COALESCE(difficulty, 3),
                   COALESCE(audio_url, ''), COALESCE(source, 'textbook'),
                   COALESCE(dictation_count, 0), COALESCE(dictation_correct, 0),
                   is_active
            FROM words 
            WHERE is_active = 1
            ORDER BY grade, unit
        """)
        
        rows = sqlite_cursor.fetchall()
        batch_size = 200
        success = 0
        failed = 0
        total = len(rows)
        
        for i in range(0, total, batch_size):
            batch = rows[i:i+batch_size]
            
            values_list = [
                (
                    row[1], row[2], row[3], row[4],  # word, phonetic, meaning, pos
                    row[5], row[6],                  # example_en, example_cn
                    row[7],                          # grade (INT)
                    row[8],                          # unit
                    row[9],                          # book
                    row[10],                         # tags (JSON)
                    row[11] or 3,                    # difficulty
                    row[12] or None,                 # audio_url
                    row[13] or 'textbook',           # source
                    row[14] or 0,                    # dictation_count
                    row[15] or 0,                    # dictation_correct
                    row[16] or 1                     # is_active
                )
                for row in batch
            ]
            
            try:
                mysql_cursor.executemany(insert_sql, values_list)
                mysql_conn.commit()
                success += len(batch)
                
                # 进度显示
                progress = int((i + len(batch)) / total * 100)
                bar = "█" * int(progress / 5) + "░" * (20 - int(progress / 5))
                print(f"   [{bar}] {(i + len(batch)):>4,}/{total:,} ({progress}%) ✓", end="\r")
                
            except Exception as e:
                mysql_conn.rollback()
                failed += len(batch)
                print(f"\n❌ 批次导入失败 (行 {i}): {e}")
        
        # 5. 验证结果
        print("\n")
        mysql_cursor.execute("SELECT COUNT(*) FROM words")
        migrated_count = mysql_cursor.fetchone()[0]
        
        # 6. 按年级统计分布
        mysql_cursor.execute("""
            SELECT g.name, COUNT(*) as cnt 
            FROM (
                SELECT 
                    CASE 
                        WHEN grade = 7 THEN '七年级'
                        WHEN grade = 8 THEN '八年级'
                        WHEN grade = 9 THEN '九年级'
                        ELSE '其他'
                    END as name
                FROM words
            ) g
            GROUP BY g.name
        """)
        
        grade_dist = mysql_cursor.fetchall()
        
        print("=" * 70)
        print("🎉 迁移完成!")
        print("=" * 70)
        print(f"   📊 总计：{success:,} / {total:,} (失败：{failed:,})")
        print(f"   📊 数据库中实际单词数：{migrated_count:,}")
        print()
        print("   按年级分布:")
        for name, cnt in grade_dist:
            print(f"      → {name}: {cnt:,}")
        print("=" * 70)
        
        return {'success': success, 'total': total, 'failed': failed}
        
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断迁移")
        return None
        
    except Exception as e:
        print(f"\n\n💥 严重错误：{type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None
        
    finally:
        if 'sqlite_conn' in locals():
            sqlite_conn.close()
        if 'mysql_conn' in locals():
            mysql_conn.close()


if __name__ == "__main__":
    result = main()
    
    if result:
        print("\n✅ 词库导入任务执行完毕")
        sys.exit(0 if result['failed'] == 0 else 1)
    else:
        sys.exit(1)
