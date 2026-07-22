# 🗄️ 数据库设计文档

> **项目**: Word Memory — 微信小程序版单词记忆系统  
> **数据库**: MySQL on 微信云托管  
> **内网地址**: 10.40.109.26:3306  
> **数据库名**: word_memory_db  
> **工作室**: 一帮人马工作室（QQ691481548）  
> **最后更新**: 2026-07-22

---

## 1. ER 关系总览

```
words (1) ──────< word_set_items (N) >────── (1) word_sets
  │
  ├──< user_word_memories (N)  ← 用户 × 单词的记忆状态
  ├──< review_histories (N)    ← 复习记录
  │
categories (1) ──< words (N)  (通过 grade/book 关联)
  │
daily_plans (1)    ← 用户每日学习计划
learning_goals (1) ← 用户学习目标
settings (1)       ← K-V 键值对存储用户设置
```

## 2. 表结构

### 2.1 words — 单词主表

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| word | VARCHAR(100) | 单词 | NOT NULL, INDEX |
| phonetic | VARCHAR(200) | 音标 | NULLABLE |
| meaning | TEXT | 中文释义 | NOT NULL |
| part_of_speech | VARCHAR(100) | 词性 | NULLABLE |
| example_en | TEXT | 英文例句 | NULLABLE |
| example_cn | TEXT | 中文例句 | NULLABLE |
| grade | INT(11) | 年级（7=初中/10=高中） | NOT NULL, INDEX, DEFAULT 7 |
| unit | VARCHAR(50) | 单元 | NULLABLE |
| book | VARCHAR(10) | 教材版本 | NULLABLE, INDEX |
| tags | VARCHAR(500) | 标签（JSON 数组） | DEFAULT '[]' |
| difficulty | INT(11) | 难度等级 | DEFAULT 1 |
| audio_url | VARCHAR(500) | 音频 URL | NULLABLE |
| is_active | TINYINT(3) | 是否启用 | NOT NULL, INDEX, DEFAULT 1 |
| source | VARCHAR(50) | 来源 | NULLABLE |
| dictation_count | INT(11) | 听写次数 | DEFAULT 0 |
| dictation_correct | INT(11) | 听写正确次数 | DEFAULT 0 |
| created_at | DATETIME | 创建时间 | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | ON UPDATE CURRENT_TIMESTAMP |

### 2.2 user_word_memories — 用户单词记忆状态（SM-2 核心表）

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| user_id | VARCHAR(50) | 用户 OpenID | NOT NULL, INDEX |
| user_openid | VARCHAR(64) | 备用 OpenID | NULLABLE |
| word_id | INT(11) | 单词 ID | NOT NULL, INDEX |
| memory_level | INT(11) | 记忆等级 | DEFAULT 0 |
| ease_factor | FLOAT | SM-2 易度因子 | DEFAULT 2.5 |
| interval | INT(11) | 复习间隔（天） | DEFAULT 0 |
| repetitions | INT(11) | 连续正确次数 | DEFAULT 0 |
| next_review | DATETIME | 下次复习时间 | NULLABLE |
| last_review | DATETIME | 上次复习时间 | NULLABLE |
| total_reviews | INT(11) | 总复习次数 | DEFAULT 0 |
| correct_count | INT(11) | 正确次数 | DEFAULT 0 |
| wrong_count | INT(11) | 错误次数 | DEFAULT 0 |
| streak | INT(11) | 连续正确次数 | DEFAULT 0 |
| mastery_score | FLOAT | 掌握度分数 | DEFAULT 0 |
| review_status | VARCHAR(20) | 状态: active/paused/mastered | DEFAULT 'active' |
| created_at | DATETIME | 创建时间 | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | ON UPDATE |

### 2.3 review_histories — 复习历史记录

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| user_id | VARCHAR(50) | 用户 OpenID | NOT NULL, INDEX |
| user_openid | VARCHAR(64) | 备用 OpenID | NULLABLE |
| word_id | INT(11) | 单词 ID | NOT NULL, INDEX |
| review_time | DATETIME | 复习时间 | DEFAULT CURRENT_TIMESTAMP |
| quality | INT(11) | SM-2 质量评分 (0-5) | NOT NULL |
| response_time_ms | INT(11) | 响应时间（毫秒） | NULLABLE |
| review_type | VARCHAR(20) | 类型: review/dictation | NULLABLE |

### 2.4 word_sets — 单词集

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| name | VARCHAR(100) | 单词集名称 | NOT NULL |
| description | TEXT | 描述 | NULLABLE |
| color | VARCHAR(20) | 颜色标记 | NULLABLE |
| owner_openid | VARCHAR(64) | 创建者 OpenID | NULLABLE |
| word_count | INT(11) | 单词数量 | NOT NULL, DEFAULT 0 |
| created_at | DATETIME | 创建时间 | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | ON UPDATE |

### 2.5 word_set_items — 单词集与单词关联

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| word_set_id | INT(11) | 单词集 ID | NOT NULL, INDEX |
| word_id | INT(11) | 单词 ID | NOT NULL, INDEX |
| notes | TEXT | 备注 | NULLABLE |
| sort_order | INT(11) | 排序 | NOT NULL, DEFAULT 0 |
| added_at | DATETIME | 添加时间 | DEFAULT CURRENT_TIMESTAMP |

### 2.6 categories — 分类

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| name | VARCHAR(50) | 分类名称 | NOT NULL, INDEX |
| owner_openid | VARCHAR(64) | 创建者 OpenID | NULLABLE |
| created_at | DATETIME | 创建时间 | DEFAULT CURRENT_TIMESTAMP |

### 2.7 daily_plans — 每日学习计划

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| user_id | VARCHAR(50) | 用户 OpenID | NOT NULL, INDEX |
| plan_date | DATE | 计划日期 | NOT NULL, INDEX |
| new_words_count | INT(11) | 计划新词数 | DEFAULT 0 |
| review_words_count | INT(11) | 计划复习数 | DEFAULT 0 |
| completed_new | INT(11) | 已完成新词数 | DEFAULT 0 |
| completed_review | INT(11) | 已完成复习数 | DEFAULT 0 |
| correct_rate | FLOAT | 正确率 | NULLABLE |
| study_duration_min | INT(11) | 学习时长(分钟) | DEFAULT 0 |
| created_at | DATETIME | 创建时间 | DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | ON UPDATE |

### 2.8 learning_goals — 学习目标

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| user_id | VARCHAR(50) | 用户 OpenID | NOT NULL, INDEX |
| owner_openid | VARCHAR(64) | 备用 OpenID | NULLABLE |
| goal_type | VARCHAR(20) | 目标类型 | NOT NULL |
| target_count | INT(11) | 目标数量 | NOT NULL |
| current_count | INT(11) | 当前进度 | DEFAULT 0 |
| start_date | DATE | 开始日期 | NOT NULL |
| end_date | DATE | 结束日期 | NULLABLE |
| status | VARCHAR(20) | 状态: active/completed | DEFAULT 'active' |
| word_scope | TEXT | 单词范围/条件 | NULLABLE |
| created_at | DATETIME | 创建时间 | DEFAULT CURRENT_TIMESTAMP |

### 2.9 settings — 用户设置(K-V)

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | INT(11) | 主键 | PK, AUTO_INCREMENT |
| user_id | VARCHAR(50) | 用户 OpenID | NOT NULL, INDEX |
| setting_key | VARCHAR(50) | 设置键名 | NOT NULL |
| setting_value | VARCHAR(200) | 设置值 | NOT NULL |
| updated_at | DATETIME | 更新时间 | ON UPDATE |

## 3. SM-2 算法核心字段

| 表 | 字段 | SM-2 角色 |
|----|------|-----------|
| user_word_memories | `memory_level` | 当前记忆等级（0-5+） |
| user_word_memories | `ease_factor` | 易度因子（初始 2.5，根据质量调整） |
| user_word_memories | `interval` | 复习间隔（天，SM-2 公式计算） |
| user_word_memories | `repetitions` | 连续正确次数 |
| user_word_memories | `next_review` | 下次复习时间 |
| user_word_memories | `mastery_score` | 掌握度 0-100 |
| user_word_memories | `review_status` | active/paused/mastered |

## 4. 数据隔离

所有用户数据通过 `user_id`（云托管自动注入的 OpenID）进行隔离：

```sql
-- 示例：查询某个用户的待复习单词
SELECT * FROM user_word_memories 
WHERE user_id = ? AND review_status = 'active' AND next_review <= NOW()
```

---

> **更新**: 2026-07-22 | **维护者**: 一帮人马工作室（QQ691481548）