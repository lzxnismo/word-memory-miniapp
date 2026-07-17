#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词库迁移工具 - Word Memory System
从 Web 版 SQLite 数据库迁移到微信小程序 MySQL 云开发数据库

使用场景:
  - 帮助已有用户在 Web 版积累大量词汇，平滑过渡到小程序
  - 不迁移用户学习记录，仅迁移基础单词库
  - 每次迁移都会覆盖目标数据库的单词表（幂等操作）

作者：一帮人马工作室（QQ691481548）
"""

import sqlite3
import mysql.connector
from mysql.connector import Error
from typing import List, Dict, Tuple
import sys
from datetime import datetime


class WordMigrationTool:
    """单词库迁移工具"""
    
    def __init__(self, 
                 sqlite_path: str,
                 mysql_config: dict):
        self.sqlite_path = sqlite_path
        self.mysql_config = mysql_config
        
    def connect_sqlite(self) -> sqlite3.Connection:
        """连接 SQLite 数据库"""
        try:
            conn = sqlite3.connect(self.sqlite_path)
            print(f"✅ 成功连接 SQLite: {self.sqlite_path}")
            return conn
        except Exception as e:
            print(f"❌ SQLite 连接失败: {e}")
            raise
            
    def connect_mysql(self) -> mysql.connector.MySQLConnection:
        """连接 MySQL 数据库"""
        try:
            conn = mysql.connector.connect(**self.mysql_config)
            print(f"✅ 成功连接 MySQL: {self.mysql_config['database']}@{self.mysql_config['host']}")
            return conn
        except Error as e:
            print(f"❌ MySQL 连接失败: {e}")
            raise
    
    def get_word_count_info(self, cursor) -> Dict[str, any]:
        """获取单词统计信息"""
        cursor.execute("SELECT COUNT(*) FROM words WHERE is_active = 1")
        active_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT grade, COUNT(*) FROM words GROUP BY grade")
        grade_stats = dict(cursor.fetchall())
        
        cursor.execute("SELECT book, COUNT(*) FROM words GROUP BY book")
        book_stats = dict(cursor.fetchall())
        
        return {
            'active': active_count,
            'by_grade': grade_stats,
            'by_book': book_stats
        }
    
    def migrate_words(self, verbose: bool = True) -> Dict[str, int]:
        """
        执行单词库迁移
        返回: {'total': 总数，'success': 成功数，'failed': 失败数}
        """
        print("\n🚀 开始迁移单词库...")
        
        sqlite_conn = None
        mysql_conn = None
        
        try:
            # 连接数据库
            sqlite_conn = self.connect_sqlite()
            mysql_conn = self.connect_mysql()
            
            sqlite_cursor = sqlite_conn.cursor()
            mysql_cursor = mysql_conn.cursor()
            
            # 显示源数据统计
            stats = self.get_word_count_info(sqlite_cursor)
            print(f"\n📊 源数据库统计:")
            print(f"   激活单词数: {stats['active']}")
            print(f"   年级分布: {stats['by_grade']}")
            print(f"   教材分布: {stats['by_book']}")
            
            # 准备目标数据库 (清空并重建)
            if verbose:
                print("\n🔧 准备目标数据库...")
            
            # 删除旧数据
            mysql_cursor.execute("TRUNCATE TABLE words")
            mysql_conn.commit()
            print(f"✅ 已清空目标数据库单词表")
            
            # 批量插入新数据
            batch_size = 100
            total = stats['active']
            success = 0
            failed = 0
            
            sqlite_cursor.execute("""
                SELECT id, word, phonetic, meaning, part_of_speech, 
                       example_en, example_cn, grade, unit, book, tags, 
                       difficulty, audio_url, source, dictation_count,
                       dictation_correct, is_active
                FROM words 
                WHERE is_active = 1
            """)
            
            rows = sqlite_cursor.fetchall()
            total = len(rows)
            
            if verbose:
                print(f"\n📥 正在导入 {total:,} 个单词...")
            
            for i in range(0, total, batch_size):
                batch = rows[i:i+batch_size]
                
                insert_sql = """
                    INSERT INTO words (
                        word, phonetic, meaning, part_of_speech,
                        example_en, example_cn, grade, unit, book,
                        tags, difficulty, audio_url, source,
                        dictation_count, dictation_correct, is_active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                values_list = []
                for row in batch:
                    values_list.append((
                        row[1], row[2], row[3], row[4],  # word, phonetic, meaning, pos
                        row[5], row[6],                  # example_en, example_cn
                        row[7],                          # grade (INT)
                        row[8],                          # unit
                        row[9],                          # book
                        row[10] or "[]",                 # tags (JSON)
                        row[11] or 3,                    # difficulty
                        row[12] or None,                 # audio_url
                        row[13] or 'textbook',           # source
                        row[14] or 0,                    # dictation_count
                        row[15] or 0,                    # dictation_correct
                        row[16] or 1                     # is_active
                    ))
                
                try:
                    mysql_cursor.executemany(insert_sql, values_list)
                    mysql_conn.commit()
                    success += len(batch)
                    
                    if verbose and (i + batch_size) % 500 == 0:
                        print(f"   ✓ 已导入 {(i + batch_size):,}/{total:,} 单词 ({(i + batch_size) / total * 100:.1f}%)")
                        
                except Error as e:
                    mysql_conn.rollback()
                    failed += len(batch)
                    print(f"❌ 批次导入失败 (行 {i}): {e}")
            
            # 验证结果
            mysql_cursor.execute("SELECT COUNT(*) FROM words")
            migrated_count = mysql_cursor.fetchone()[0]
            
            print(f"\n🎉 迁移完成!")
            print(f"   ✅ 成功: {success:,} 个")
            print(f"   ❌ 失败: {failed:,} 个")
            print(f"   📊 数据库中实际单词数: {migrated_count:,}")
            
            return {
                'total': total,
                'success': success,
                'failed': failed,
                'migrated': migrated_count
            }
            
        except Exception as e:
            print(f"\n❌ 迁移过程出错: {e}")
            raise
            
        finally:
            if sqlite_conn:
                sqlite_conn.close()
            if mysql_conn:
                mysql_conn.close()


def main():
    """主函数"""
    print("=" * 60)
    print("📖 单词记忆系统 - 词库迁移工具 v1.0")
    print("Author: 一帮人马工作室（QQ691481548）")
    print("=" * 60)
    
    # 配置项
    SQLITE_PATH = "/root/.hermes/project/word_memory_system/backend/data/word_memory.db"
    
    MYSQL_CONFIG = {
        'host': 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
        'port': 27780,
        'user': 'word_memory_app',
        'password': 'Root_123',
        'database': 'mytx-d7gw0vhq4414988b5',
        'autocommit': False
    }
    
    try:
        # 创建迁移工具实例
        tool = WordMigrationTool(SQLITE_PATH, MYSQL_CONFIG)
        
        # 执行迁移
        result = tool.migrate_words(verbose=True)
        
        print("\n" + "=" * 60)
        print("✅ 迁移任务完成！")
        print(f"   源数据: {result['total']} 个激活单词")
        print(f"   导入成功：{result['success']} 个")
        print(f"   导入失败：{result['failed']} 个")
        print("=" * 60)
        
        # 返回状态码
        sys.exit(0 if result['failed'] == 0 else 1)
        
    except KeyboardInterrupt:
        print("\n⚠️  用户中断迁移")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 严重错误：{e}")
        sys.exit(2)


if __name__ == "__main__":
    main()
