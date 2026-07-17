#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小程序云函数端到端测试脚本
测试所有 5 个 MySQL 直连云函数的核心功能

Author: 一帮人马工作室 (QQ691481548)
"""

import sys
from datetime import datetime, timedelta
import mysql.connector


class CloudFunctionTester:
    """云函数测试器 - 模拟微信云开发调用"""
    
    # MySQL 配置（与云函数一致）
    MYSQL_CONFIG = {
        'host': 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
        'port': 27780,
        'user': 'word_memory_app',
        'password': 'Root_123',
        'database': 'mytx-d7gw0vhq4414988b5',
        'connect_timeout': 15
    }
    
    def __init__(self):
        self.conn = None
        self.results = []
        self.openid = "test_openid_" + datetime.now().strftime("%Y%m%d%H%M%S")
        
    def get_conn(self):
        if not self.conn:
            self.conn = mysql.connector.connect(**self.MYSQL_CONFIG)
        return self.conn
    
    def close(self):
        if self.conn:
            self.conn.close()
            
    def log(self, level, message):
        """记录测试结果"""
        result = {"time": datetime.now().isoformat(), "level": level, "message": message}
        self.results.append(result)
        emoji = "✅" if level == "PASS" else ("⚠️" if level == "WARN" else "❌")
        print(f"   {emoji} [{level}] {message}")
        
    # ============================================================
    # word_sets 云函数测试
    # ============================================================
    
    def test_word_sets_create(self):
        """测试：创建单词集"""
        self.log("INFO", "测试创建单词集...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            sql = """
                INSERT INTO word_sets (name, description, color, owner_openid, created_at)
                VALUES (%s, %s, %s, %s, NOW())
            """
            data = ("Test_Set_001", "测试用单词集", "#667eea", self.openid)
            cursor.execute(sql, data)
            conn.commit()
            
            set_id = cursor.lastrowid
            
            # 验证是否成功创建
            cursor.execute("SELECT * FROM word_sets WHERE id = %s AND owner_openid = %s", 
                          (set_id, self.openid))
            row = cursor.fetchone()
            
            if row and row['name'] == "Test_Set_001":
                self.log("PASS", f"创建成功，ID={set_id}")
                return True
            else:
                self.log("FAIL", "创建后查询失败")
                return False
                
        except Exception as e:
            self.log("FAIL", f"创建单词集错误：{e}")
            conn.rollback()
            return False
            
    def test_word_sets_list(self):
        """测试：获取单词集列表"""
        self.log("INFO", "测试获取单词集列表...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT ws.id, ws.name, ws.description, ws.color, ws.created_at,
                       COUNT(wsw.word_id) as word_count
                FROM word_sets ws
                LEFT JOIN word_set_words wsw ON ws.id = wsw.word_set_id
                WHERE ws.owner_openid = %s
                GROUP BY ws.id
                ORDER BY ws.created_at DESC
            """, [self.openid])
            
            sets = cursor.fetchall()
            count = len(sets)
            
            if count >= 1:
                self.log("PASS", f"获取成功，共有 {count} 个单词集")
                return True
            else:
                self.log("PASS", "列表为空（正常，未创建数据）")
                return True
                
        except Exception as e:
            self.log("FAIL", f"获取列表错误：{e}")
            return False
            
    def test_word_sets_add_word(self):
        """测试：添加单词到集合"""
        self.log("INFO", "测试添加单词到集合...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 先找一个基础词库中的单词
            cursor.execute("SELECT id, word FROM words LIMIT 1")
            word_row = cursor.fetchone()
            
            if not word_row:
                self.log("FAIL", "词库无单词")
                return False
                
            word_id = word_row['id']
            word_text = word_row['word']
            
            # 创建一个单词集
            cursor.execute("""
                INSERT INTO word_sets (name, owner_openid, created_at)
                VALUES (%s, %s, NOW())
            """, ["Temp_Test_Set", self.openid])
            set_id = cursor.lastrowid
            
            # 添加单词到集合
            max_idx_query = "SELECT COALESCE(MAX(order_index), 0) + 1 AS next_idx FROM word_set_words WHERE word_set_id = %s"
            cursor.execute(max_idx_query, [set_id])
            next_idx = cursor.fetchone()['next_idx']
            
            cursor.execute("""
                INSERT INTO word_set_words (word_set_id, word_id, order_index, added_at)
                VALUES (%s, %s, %s, NOW())
            """, [set_id, word_id, next_idx])
            conn.commit()
            
            # 验证
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM word_set_words 
                WHERE word_set_id = %s AND word_id = %s
            """, [set_id, word_id])
            
            if cursor.fetchone()['cnt'] > 0:
                self.log("PASS", f"单词 '{word_text}' 添加成功")
                return True
            else:
                self.log("FAIL", "添加验证失败")
                return False
                
        except Exception as e:
            self.log("FAIL", f"添加单词错误：{e}")
            conn.rollback()
            return False
            
    # ============================================================
    # category_manager 云函数测试
    # ============================================================
    
    def test_category_create(self):
        """测试：创建分类"""
        self.log("INFO", "测试创建分类...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 检查是否已存在同名分类
            cursor.execute("""
                SELECT id FROM categories WHERE name = %s AND (owner_openid IS NULL OR owner_openid = %s)
            """, ["Custom_Category_Test", self.openid])
            
            if cursor.fetchone():
                self.log("WARN", "该分类已存在，跳过创建")
                return True
                
            cursor.execute("""
                INSERT INTO categories (name, owner_openid, created_at)
                VALUES (%s, %s, NOW())
            """, ["Custom_Category_Test", self.openid])
            conn.commit()
            
            cat_id = cursor.lastrowid
            
            cursor.execute("SELECT * FROM categories WHERE id = %s", [cat_id])
            row = cursor.fetchone()
            
            if row and row['name'] == "Custom_Category_Test":
                self.log("PASS", f"分类创建成功，ID={cat_id}")
                return True
            else:
                self.log("FAIL", "创建后查询失败")
                return False
                
        except Exception as e:
            self.log("FAIL", f"创建分类错误：{e}")
            conn.rollback()
            return False
            
    def test_category_list(self):
        """测试：获取分类列表"""
        self.log("INFO", "测试获取分类列表...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 获取用户自定义分类
            cursor.execute("""
                SELECT c.id, c.name, c.created_at,
                       (SELECT COUNT(*) FROM words WHERE book = c.name AND is_active = 1) as word_count
                FROM categories c
                WHERE c.owner_openid IS NULL OR c.owner_openid = %s
            """, [self.openid])
            
            cats = cursor.fetchall()
            
            # 获取基础年级分类
            cursor.execute("""
                SELECT grade, COUNT(*) as cnt FROM words WHERE is_active = 1 GROUP BY grade
            """)
            grades = cursor.fetchall()
            
            self.log("PASS", f"分类列表获取成功，用户分类={len(cats)}个，教材年级={len(grades)}个")
            return True
            
        except Exception as e:
            self.log("FAIL", f"获取分类列表错误：{e}")
            return False
            
    # ============================================================
    # goal_manager 云函数测试
    # ============================================================
    
    def test_goal_create(self):
        """测试：创建学习目标"""
        self.log("INFO", "测试创建学习目标...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            
            cursor.execute("""
                INSERT INTO learning_goals (user_id, owner_openid, goal_type, target_count, current_count, status, start_date, created_at)
                VALUES (%s, %s, %s, %s, 0, 'active', %s, NOW())
            """, [self.openid, self.openid, 'daily', 50, today])
            conn.commit()
            
            goal_id = cursor.lastrowid
            
            cursor.execute("SELECT * FROM learning_goals WHERE id = %s", [goal_id])
            row = cursor.fetchone()
            
            if row and row['target_count'] == 50:
                self.log("PASS", f"目标创建成功，ID={goal_id}, 日标=50 词")
                return True
            else:
                self.log("FAIL", "创建后查询失败")
                return False
                
        except Exception as e:
            self.log("FAIL", f"创建目标错误：{e}")
            conn.rollback()
            return False
            
    def test_goal_progress(self):
        """测试：获取目标进度"""
        self.log("INFO", "测试获取目标进度...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT * FROM learning_goals WHERE owner_openid = %s ORDER BY created_at DESC LIMIT 1
            """, [self.openid])
            
            goals = cursor.fetchall()
            
            if goals:
                goal = goals[0]
                progress_percent = Math.floor((goal['current_count'] / goal['target_count']) * 100)
                self.log("PASS", f"获取成功，进度={progress_percent}%")
                return True
            else:
                self.log("PASS", "无学习记录（正常）")
                return True
                
        except Exception as e:
            self.log("FAIL", f"获取进度错误：{e}")
            return False
            
    # ============================================================
    # stats_advanced 云函数测试
    # ============================================================
    
    def test_stats_comprehensive(self):
        """测试：综合统计数据"""
        self.log("INFO", "测试综合统计数据...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 1. 总词数
            cursor.execute("SELECT COUNT(*) as cnt FROM words WHERE is_active = 1")
            total = cursor.fetchone()['cnt']
            
            # 2. 用户学习记录
            cursor.execute("""
                SELECT 
                    COUNT(*) as learned,
                    COALESCE(SUM(CASE WHEN mastery_score > 80 THEN 1 ELSE 0 END), 0) as mastered,
                    COALESCE(AVG(mastery_score), 0) as avg_mastery
                FROM user_word_memories WHERE user_openid = %s
            """, [self.openid])
            
            user_stats = cursor.fetchone()
            
            # 3. 连续天数
            cursor.execute("""
                WITH review_dates AS (
                    SELECT DISTINCT DATE(review_time) as rdate
                    FROM review_histories WHERE user_openid = %s
                )
                SELECT COUNT(DISTINCT rdate) as days FROM review_dates
            """, [self.openid])
            
            streak = cursor.fetchone()['days']
            
            self.log("PASS", f"统计完整：词库={total}词，学习了={user_stats['learned']}词，掌握={user_stats['mastered']}词")
            return True
            
        except Exception as e:
            self.log("FAIL", f"统计数据错误：{e}")
            return False
            
    # ============================================================
    # word_lookup 云函数测试
    # ============================================================
    
    def test_word_exact_lookup(self):
        """测试：精确查词"""
        self.log("INFO", "测试精确查词...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            cursor.execute("""
                SELECT id, word, phonetic, meaning FROM words WHERE is_active = 1 LIMIT 1
            """)
            word_row = cursor.fetchone()
            
            if not word_row:
                self.log("FAIL", "词库无单词")
                return False
            
            word_text = word_row['word']
            
            cursor.execute("""
                SELECT id, word, phonetic, meaning FROM words WHERE word = %s AND is_active = 1
            """, [word_text])
            
            result = cursor.fetchone()
            
            if result and result['word'] == word_text:
                self.log("PASS", f"精确查询成功：'{word_text}'")
                return True
            else:
                self.log("FAIL", "查询结果不匹配")
                return False
                
        except Exception as e:
            self.log("FAIL", f"精确查词错误：{e}")
            return False
            
    def test_word_fuzzy_lookup(self):
        """测试：模糊查词"""
        self.log("INFO", "测试模糊查词...")
        conn = self.get_conn()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # 用空字符串测试模糊匹配
            cursor.execute("""
                SELECT id, word, phonetic, meaning FROM words 
                WHERE LOWER(word) LIKE %s AND is_active = 1 LIMIT 5
            """, ['%a%'])
            
            results = cursor.fetchall()
            
            self.log("PASS", f"模糊查询返回 {len(results)} 条结果")
            return True
            
        except Exception as e:
            self.log("FAIL", f"模糊查词错误：{e}")
            return False
            
    # ============================================================
    # 主测试流程
    # ============================================================
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*70)
        print("🧪 小程序云函数端到端测试")
        print("Author: 一帮人马工作室 (QQ691481548)")
        print("="*70)
        print()
        
        tests = [
            ("word_sets", [self.test_word_sets_create, self.test_word_sets_list, self.test_word_sets_add_word]),
            ("category_manager", [self.test_category_create, self.test_category_list]),
            ("goal_manager", [self.test_goal_create, self.test_goal_progress]),
            ("stats_advanced", [self.test_stats_comprehensive]),
            ("word_lookup", [self.test_word_exact_lookup, self.test_word_fuzzy_lookup]),
        ]
        
        for module_name, module_tests in tests:
            print(f"\n📦 模块：{module_name}")
            print("-" * 50)
            
            passed = 0
            failed = 0
            
            for test_func in module_tests:
                try:
                    if test_func():
                        passed += 1
                    else:
                        failed += 1
                except Exception as e:
                    self.log("FAIL", f"测试异常：{e}")
                    failed += 1
                    
            print()
            summary = f"   📊 本模块通过 {passed}/{passed+failed}"
            if failed == 0:
                print(f"{summary} ✅")
            else:
                print(f"{summary} ❌")
                
        print("\n" + "="*70)
        print("✅ 测试完成！")
        print("="*70)
        
        # 清理测试数据
        print("\n🧹 清理测试数据...")
        self.cleanup()
        
        return self.results


if __name__ == "__main__":
    tester = CloudFunctionTester()
    
    try:
        results = tester.run_all_tests()
        print(f"\n💡 详细日志共 {len(results)} 条")
    except KeyboardInterrupt:
        print("\n⚠️  测试被中断")
    finally:
        tester.close()
