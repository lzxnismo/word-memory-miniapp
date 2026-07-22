# Word Memory 微信小程序开发指南

**项目名称**: Word Memory (单词记忆助手)  
**技术栈**: 微信小程序 + 腾讯云 Cloudbase MySQL + SM-2 算法  
**版本**: v1.0.0  
**设计者**: 一帮人马工作室（QQ691481548）  
**创建时间**: 2026-07-13  

---

## 📚 目录

1. [项目概述](#项目概述)
2. [架构设计](#架构设计)
3. [环境准备](#环境准备)
4. [数据库设计](#数据库设计)
5. [云函数开发](#云函数开发)
6. [前端页面开发](#前端页面开发)
7. [SM-2 记忆算法实现](#sm-2记忆算法实现)
8. [部署与发布](#部署与发布)
9. [常见问题排查](#常见问题排查)
10. [附录](#附录)

---

## 项目概述

### 项目目标

开发一款基于**间隔重复记忆法**（SM-2 算法）的微信小程序，帮助用户高效记忆英语单词。

### 核心功能

| 功能模块 | 功能描述 | 技术要点 |
|---------|---------|---------|
| **Flash 卡片学习** | 正反面翻转、评分反馈 | 动画过渡、SM-2 算法调度 |
| **听写测试** | 倒计时拼写、首字母提示 | 音频播放、实时校验 |
| **单词本管理** | 分类筛选、搜索查询 | 分页加载、状态过滤 |
| **每日计划** | 学习目标设定、任务追踪 | 进度计算、周统计 |
| **数据统计** | 连击记录、趋势分析、成就徽章 | 图表渲染、数据聚合 |
| **用户设置** | 偏好配置、数据重置 | 本地缓存、云端同步 |

### 技术架构图

```
┌─────────────────────────────────────────────────────────┐
│                    微信小程序前端                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 首页     │  │ 卡片页   │  │ 听写页   │  ...         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                      │
│       └─────────────┴─────────────┘                      │
│                    ↓ wx.cloud.callFunction               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              微信云函数（Node.js）                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ word_query│  │user_stats│  │record_   │              │
│  │          │  │          │  │review    │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                      │
│       └─────────────┴─────────────┘                      │
│                   ↓ mysql2                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           腾讯云 Cloudbase MySQL (8.0)                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ words                     (600+ 条单词库)         │  │
│  │ user_word_memories        (SM-2 记忆状态)          │  │
│  │ review_histories          (复习历史日志)          │  │
│  │ daily_plans               (每日学习计划)          │  │
│  │ settings                  (用户配置键值对)        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────┐
│  表现层（View Layer）                    │
│  - WXML 模板                            │
│  - WXSS 样式                            │
│  - JS 交互逻辑                           │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  服务层（Service Layer）                 │
│  - utils/api.js（云函数调用封装）        │
│  - SM-2 算法核心                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  数据访问层（DAL）                       │
│  - cloudfunctions/word_query/index.js   │
│  - cloudfunctions/user_stats/index.js   │
│  - cloudfunctions/record_review/index.js│
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  持久层（Database）                      │
│  - MySQL 表格存储                       │
└─────────────────────────────────────────┘
```

### 关键设计决策

1. **为什么选择微信云开发？**
   - 免运维：无需搭建服务器
   - 集成度高：数据库、云函数、存储一体化
   - 免费额度够用：个人项目完全免费

2. **为什么选择 MySQL 而不是 NoSQL？**
   - 关系型数据结构清晰（用户-单词 - 记忆）
   - 支持复杂查询（多条件筛选、分页）
   - 事务一致性保障

3. **为什么使用 SM-2 算法？**
   - 经典间隔重复算法（Anki 同款）
   - 科学优化记忆曲线
   - 参数可调（难度系数、间隔因子）

---

## 环境准备

### 工具清单

| 工具 | 版本 | 用途 |
|------|------|------|
| 微信开发者工具 | ≥ 1.03.2309290 | 小程序 IDE |
| Node.js | ≥ 14.x | 云函数依赖运行环境 |
| Python 3.11+ | 3.11.11 | 数据迁移脚本 |
| MySQL 客户端 | 任意 | 数据库管理（可选） |

### 项目初始化步骤

#### Step 1: 克隆项目

```bash
cd /opt/win_hermes/
git clone <repository-url> word_memory_miniapp
cd word_memory_miniapp
```

#### Step 2: 配置 AppID

打开 `project.config.json`，填入你的小程序 AppID：

```json
{
  "appid": "wx66f2efd5915e7c94",  // 替换为你的 AppID
  "projectname": "word-memory-miniapp",
  "cloudfunctionRoot": "cloudfunctions/",
  "miniprogramRoot": "./"
}
```

#### Step 3: 开通云开发环境

1. 打开微信开发者工具 → 点击「云开发」按钮
2. 创建环境 → 选择「MySQL」（SQL 型）
3. 等待 5-10 分钟创建完成
4. 记录环境 ID：`mytx-d7gw0vhq4414988b5`

#### Step 4: 安装依赖（本地开发不需要）

```bash
# 仅用于本地测试（不推荐，生产环境直接云端安装）
npm install --save-dev wx-server-sdk
```

---

## 数据库设计

### ER 图

```
┌──────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│    words     │◄─────│ user_word_memories   │─────►│ review_histories │
│ (单词主表)    │      │  (记忆状态)           │      │  (复习日志)       │
└──────────────┘      └──────────────────────┘      └──────────────────┘
       │                        │
       │                        │
       ▼                        ▼
┌──────────────┐      ┌──────────────────────┐
│   word_sets  │      │     daily_plans      │
│ (词集管理)    │      │  (每日计划)           │
└──────────────┘      └──────────────────────┘
```

### 核心表结构

#### 1. words (单词主表)

```sql
CREATE TABLE words (
  id INT AUTO_INCREMENT PRIMARY KEY,
  word VARCHAR(100) NOT NULL COMMENT '英文单词',
  phonetic VARCHAR(200) COMMENT '音标',
  meaning TEXT NOT NULL COMMENT '中文释义',
  part_of_speech VARCHAR(100) COMMENT '词性',
  example_en TEXT COMMENT '英文例句',
  example_cn TEXT COMMENT '中文翻译',
  grade INT DEFAULT 7 COMMENT '年级',
  unit VARCHAR(50) COMMENT '单元',
  book VARCHAR(10) COMMENT '教材版本',
  tags JSON DEFAULT '[]' COMMENT '标签数组',
  difficulty INT DEFAULT 1 COMMENT '难度 1-5',
  audio_url VARCHAR(500) COMMENT 'TTS 音频 URL',
  is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_word (word),
  INDEX idx_grade (grade),
  INDEX idx_book (book)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='单词主表';
```

**字段说明**:
- `word`: 唯一索引，避免重复导入
- `tags`: JSON 格式存储多个标签（如 `["高中", "高考高频"]`）
- `difficulty`: 手动标注难度或 AI 预测（1=简单，5=困难）

#### 2. user_word_memories (SM-2 记忆状态)

```sql
CREATE TABLE user_word_memories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL COMMENT '用户 OpenID',
  word_id INT NOT NULL COMMENT '单词 ID',
  
  -- SM-2 算法核心参数
  memory_level TINYINT DEFAULT 1 COMMENT '记忆等级 1-5',
  ease_factor DECIMAL(3,2) DEFAULT 2.50 COMMENT '难度系数',
  interval INT DEFAULT 0 COMMENT '当前间隔天数',
  repetitions INT DEFAULT 0 COMMENT '连续正确次数',
  
  -- 复习调度
  next_review DATETIME NOT NULL COMMENT '下次复习时间',
  last_review DATETIME COMMENT '上次复习时间',
  
  -- 统计数据
  review_status ENUM('new','learning','mastered') DEFAULT 'new',
  total_reviews INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  wrong_count INT DEFAULT 0,
  streak INT DEFAULT 0 COMMENT '当前连胜次数',
  mastery_score INT DEFAULT 0 COMMENT '掌握度 0-100',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_user_word (user_id, word_id),
  INDEX idx_user_id (user_id),
  INDEX idx_next_review (next_review),
  INDEX idx_review_status (review_status),
  
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户单词记忆状态';
```

**SM-2 算法映射**:
| 参数 | 作用 | 计算公式 |
|------|------|---------|
| `ease_factor` | 难度系数 | `EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))` |
| `interval` | 复习间隔 | `IF q≥3 THEN I'=I*R ELSE I'=1` |
| `repetitions` | 连续正确 | `IF q≥3 THEN R'=R+1 ELSE R'=0` |
| `mastery_score` | 掌握度 | `min(100, (correct/(correct+wrong)) * 100)` |

#### 3. review_histories (复习日志)

```sql
CREATE TABLE review_histories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  word_id INT NOT NULL,
  quality TINYINT NOT NULL COMMENT '评分 0-5',
  review_type ENUM('flash','dictation') DEFAULT 'flash',
  review_duration INT COMMENT '耗时（秒）',
  reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_time (user_id, reviewed_at),
  INDEX idx_word (word_id),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='复习历史记录';
```

---

## 云函数开发

### 云函数目录结构

```
cloudfunctions/
├── word_query/              # 单词查询服务
│   ├── index.js            # 主入口
│   ├── package.json        # 依赖声明
│   └── config.json         # 超时配置
├── user_stats/             # 用户统计服务
│   ├── index.js
│   ├── package.json
│   └── config.json
├── record_review/          # 复习记录服务
│   ├── index.js
│   ├── package.json
│   └── config.json
└── tts_proxy/              # TTS 代理服务（待实现）
```

### word_query 云函数详解

**文件路径**: `cloudfunctions/word_query/index.js`

**支持的操作**:

```javascript
// 1. 获取单词列表（分页 + 筛选）
{ action: 'getAll', userId: 'xxx', limit: 50, offset: 0 }

// 2. 搜索单词
{ action: 'search', keyword: 'hello', limit: 10 }

// 3. 获取单词详情
{ action: 'getById', wordId: 123 }

// 4. 获取待复习队列
{ action: 'getReviewQueue', userId: 'xxx', limit: 20 }

// 5. 获取新词
{ action: 'getNewWords', userId: 'xxx', limit: 30 }
```

**核心代码片段**:

```javascript
async function handleGetAll(db, event) {
  const { limit = 50, offset = 0, grade, book, userId } = event
  
  // 基础查询
  let sql = `SELECT w.* FROM words w WHERE w.is_active = 1`
  if (grade) sql += ` AND w.grade = ?`
  if (book) sql += ` AND w.book = ?`
  sql += ` ORDER BY w.id ASC LIMIT ? OFFSET ?`
  
  const [rows] = await db.execute(sql, params)
  
  // 附加用户记忆状态
  if (userId) {
    const placeholders = rows.map(() => '?').join(',')
    const [memories] = await db.execute(
      `SELECT word_id, mastery_score FROM user_word_memories 
       WHERE user_id = ? AND word_id IN (${placeholders})`,
      [userId, ...rows.map(r => r.id)]
    )
    
    // 合并状态到返回数据
    rows.forEach(word => {
      const mem = memories.find(m => m.word_id === word.id)
      word.userStatus = mem ? (mem.mastery_score >= 80 ? 'mastered' : 'learning') : 'new'
    })
  }
  
  return { code: 200, data: rows }
}
```

### record_review 云函数（SM-2 核心）

**算法实现**:

```javascript
function calculateSM2(nextInterval, prevState, quality) {
  const { easeFactor, interval, repetitions } = prevState
  
  let newEaseFactor = easeFactor
  let newInterval = interval
  let newRepetitions = repetitions
  
  if (quality >= 3) {
    // 回答正确：更新 EF、I、R
    newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if (newEaseFactor < 1.3) newEaseFactor = 1.3
    
    if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval * easeFactor)
    }
    
    newRepetitions = repetitions + 1
  } else {
    // 回答错误：重置
    newInterval = 1
    newRepetitions = 0
  }
  
  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview: addDays(newInterval)
  }
}
```

---

## 前端页面开发

### 页面路由配置

**文件**: `app.json`

```json
{
  "pages": [
    "pages/index/index",                // 首页
    "pages/flash-card/flash-card",     // Flash 卡片
    "pages/dictation/dictation",       // 听写测试
    "pages/words-list/words-list",     // 单词列表
    "pages/word-detail/word-detail",   // 单词详情
    "pages/plan-daily/plan-daily",     // 每日计划
    "pages/stats-stats/stats",         // 统计页
    "pages/settings/settings"          // 设置页
  ],
  
  "window": {
    "navigationBarBackgroundColor": "#667eea",
    "navigationBarTitleText": "记忆单词助手",
    "navigationBarTextStyle": "white"
  },
  
  "tabBar": {
    "color": "#999",
    "selectedColor": "#667eea",
    "list": [
      { "pagePath": "pages/index/index", "text": "学习" },
      { "pagePath": "pages/stats-stats/stats", "text": "统计" },
      { "pagePath": "pages/settings/settings", "text": "设置" }
    ]
  }
}
```

### Flash 卡片页面核心逻辑

**文件**: `pages/flash-card/flash-card.js`

```javascript
Page({
  data: {
    currentCard: null,
    isFlipped: false,
    queue: [],
    currentIndex: 0,
    learningComplete: false
  },
  
  onLoad() {
    this.loadReviewQueue()
  },
  
  async loadReviewQueue() {
    const app = getApp()
    const openId = app.globalData.openId || 'mock_'
    
    const res = await wx.cloud.callFunction({
      name: 'word_query',
      data: { action: 'getReviewQueue', userId: openId, limit: 20 }
    })
    
    this.setData({
      queue: res.result.data,
      currentIndex: 0,
      currentCard: res.result.data[0] || null
    })
  },
  
  flipCard() {
    this.setData({ isFlipped: !this.data.isFlipped })
    wx.vibrateShort({ type: 'light' })
  },
  
  rateQuality(quality) {
    const { currentCard } = this.data
    
    wx.showLoading({ title: '提交中...' })
    
    wx.cloud.callFunction({
      name: 'record_review',
      data: {
        action: 'record',
        wordId: currentCard.id,
        userId: this.data.userId,
        quality: quality
      }
    }).then(res => {
      wx.hideLoading()
      
      if (res.result.code === 200) {
        this.nextCard()
        wx.vibrateShort({ type: 'heavy' })
      }
    })
  },
  
  nextCard() {
    const newIndex = this.data.currentIndex + 1
    
    if (newIndex >= this.data.queue.length) {
      this.setData({ learningComplete: true })
    } else {
      this.setData({
        currentIndex: newIndex,
        currentCard: this.data.queue[newIndex],
        isFlipped: false
      })
    }
  }
})
```

### UI/UX设计规范

1. **配色方案**
   - 主色：`#667eea` (紫蓝渐变起点)
   - 辅色：`#764ba2` (紫蓝渐变终点)
   - 背景：`#F5F7FA` (浅灰)
   - 文字：`#333` (深灰)、`#999` (浅灰)

2. **间距规范**
   - 内边距：30rpx (卡片内部)
   - 外边距：40rpx (元素之间)
   - 圆角：16rpx (统一圆角)

3. **动效规范**
   - 翻转动画：0.3s ease-in-out
   - 点击缩放：scale(0.95) → scale(1)
   - 微振动：成功 light，失败 heavy

---

## SM-2 记忆算法实现

### 算法原理

SM-2（SuperMemo 2）是波兰学者 Piotr Woźniak 于 1985 年提出的间隔重复算法，核心思想：

> **在即将遗忘的时刻进行复习，最大化记忆效率**

### 参数定义

| 参数 | 含义 | 初始值 |
|------|------|--------|
| `Q` (Quality) | 回忆质量评分 | 0-5 (用户输入) |
| `EF` (Ease Factor) | 难度系数 | 2.5 |
| `I` (Interval) | 复习间隔（天） | 0 |
| `R` (Repetitions) | 连续正确次数 | 0 |

### 计算公式

```python
def sm2_update(ease_factor, interval, repetitions, quality):
    """
    根据用户评分计算新的记忆参数
    
    Args:
        ease_factor: 当前难度系数
        interval: 当前间隔天数
        repetitions: 连续正确次数
        quality: 用户评分 0-5
        
    Returns:
        dict: {new_ef, new_interval, new_repetitions}
    """
    if quality >= 3:
        # 更新难度系数
        new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ef = max(1.3, new_ef)  # 下限 1.3
        
        # 更新间隔
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval * new_ef)
        
        new_repetitions = repetitions + 1
    else:
        # 回答错误：重置
        new_ef = ease_factor
        new_interval = 1
        new_repetitions = 0
    
    return {
        'ease_factor': new_ef,
        'interval': new_interval,
        'repetitions': new_repetitions
    }
```

### 实际应用场景

| 用户场景 | 操作 | SM-2 反应 |
|---------|------|----------|
| **第一次看到** | 点击"完全不认识"(0) | `I=1`, `R=0`, 明天复习 |
| **有点印象** | 点击"模糊"(2) | `I=1`, `R=0`, 今天再学 |
| **记住了** | 点击"正确"(4) | `I=1→6→14...`, 间隔拉长 |
| **轻松记住** | 点击"太简单"(5) | `EF` 增加，下次更快跳过 |

---

## 部署与发布

### 步骤 1: 上传云函数

```bash
# 在微信开发者工具中
右键 cloudfunctions/word_query → 上传并部署：云端安装依赖
右键 cloudfunctions/user_stats → 上传并部署：云端安装依赖
右键 cloudfunctions/record_review → 上传并部署：云端安装依赖
```

### 步骤 2: 初始化数据库

执行 `scripts/migrate_to_mysql.py` 迁移数据：

```bash
cd /opt/win_hermes/word_memory_miniapp/scripts
python3 migrate_to_mysql.py
```

输出示例：

```
🚀 开始迁移 SQLite → MySQL
✓ 创建表 words (600 条)
✓ 创建表 user_word_memories (0 条，新用户无记录)
✓ 创建表 review_histories (0 条)
✅ 迁移完成！总耗时 2.3 秒
```

### 步骤 3: 编译预览

在微信开发者工具中按 `Ctrl+B` (Windows) / `Cmd+B` (Mac) 编译。

### 步骤 4: 真机测试

1. 点击顶部工具栏「预览」
2. 扫码在手机上查看
3. 验证以下功能：
   - ✅ 单词列表能加载
   - ✅ Flash 卡片可翻页
   - ✅ 评分按钮有响应
   - ✅ 数据同步到云端

### 步骤 5: 提交审核

1. 填写小程序类目：**教育 → 语言学习**
2. 上传功能截图（首页、学习页、统计页）
3. 提交备案（身份证照片）
4. 等待 1-3 个工作日审核

---

## 常见问题排查

### Q1: 云函数调用超时（FUNCTIONS_TIME_LIMIT_EXCEEDED）

**原因**: MySQL 连接慢或 SQL 查询过久

**解决方案**:
1. 检查 `config.json` 中的 `timeout` 设置（建议 15 秒）
2. 优化 SQL：添加索引、减少 JOIN
3. 检查 MySQL 外网地址是否正确

### Q2: 单词列表显示为 0 条

**排查步骤**:
```bash
# 1. 确认 MySQL 中有数据
mysql -h <host> -P <port> -u <user> -p -e "SELECT COUNT(*) FROM words;"

# 2. 检查云函数日志
# 微信开发者工具 → 云开发 → 云函数 → 查看日志

# 3. 验证 OPENID 传递
console.log('OpenID:', app.globalData.openId)
```

### Q3: TTS 发音失败

**可能原因**:
- 未配置腾讯云语音合成 API Key
- 网络请求被微信拦截

**临时方案**: 使用浏览器内置发音（Web Speech API）

```javascript
const utterance = new SpeechSynthesisUtterance(word)
utterance.lang = 'en-US'
speechSynthesis.speak(utterance)
```

### Q4: 小程序真机无法调用云函数

**原因**: 未在微信公众平台配置服务器域名

**解决**:
1. 登录 mp.weixin.qq.com
2. 开发 → 开发管理 → 开发设置 → 服务器域名
3. 添加 `wxs://<你的云环境 ID>.tcb-api.wxclouddev.com`

---

## 📚 文档索引

| 文档 | 说明 |
|------|------|
| `docs/CHANGELOG.md` | 变更日志 — 每次更新和 Bug 修复记录 |
| `docs/ARCHITECTURE.md` | 系统架构 — 前后端架构图、通信方式、部署架构 |
| `docs/DATABASE.md` | 数据库设计 — 9 张表结构、字段说明、SM-2 核心字段 |
| `docs/DESIGN.md` | 设计文档 — SM-2 算法公式、学习模式设计、统计设计 |
| `docs/USER_GUIDE.md` | 用户指南 — 功能说明、学习流程、常见问题 |
| `docs/miniapp-api-guide.md` | API 对接指南 — 所有接口文档 |
| `docs/RELEASE_CHECKLIST.md` | 发布检查清单 — 上线前逐项确认 |
| `docs/MIGRATION_COMPLETE.md` | 迁移报告 — 从云函数到云托管的迁移总结 |

---

## 附录

### A. 完整 API 接口文档

| 云函数 | Action | 参数 | 返回值 |
|-------|--------|------|--------|
| `word_query` | getAll | `{userId, limit, offset}` | `{code, data[], total}` |
| `word_query` | search | `{keyword, limit}` | `{code, data[]}` |
| `word_query` | getById | `{wordId}` | `{code, data}` |
| `word_query` | getReviewQueue | `{userId, limit}` | `{code, data[]}` |
| `record_review` | record | `{wordId, userId, quality}` | `{code, newState}` |
| `record_review` | getMemory | `{wordId, userId}` | `{code, memoryState}` |
| `user_stats` | overview | `{userId}` | `{code, stats}` |

### B. 项目文件清单

```
/opt/win_hermes/word_memory_miniapp/
├── app.js                      # 全局启动逻辑
├── app.json                    # 页面路由配置
├── app.wxss                    # 全局样式
├── project.config.json         # 项目配置
├── sitemap.json                # SEO 配置
│
├── utils/
│   └── api.js                  # 云函数调用封装
│
├── pages/
│   ├── index/                  # 首页
│   │   ├── index.wxml
│   │   ├── index.js
│   │   ├── index.json
│   │   └── index.wxss
│   ├── flash-card/             # Flash 卡片
│   ├── dictation/              # 听写测试
│   ├── words-list/             # 单词列表
│   ├── word-detail/            # 单词详情
│   ├── plan-daily/             # 每日计划
│   ├── stats-stats/            # 统计
│   └── settings/               # 设置
│
├── cloudfunctions/
│   ├── word_query/             # 单词查询
│   ├── user_stats/             # 用户统计
│   └── record_review/          # 复习记录
│
├── docs/
│   ├── README.md               # 本文档
│   ├── PROJECT_COMPLETION_REPORT.md
│   └── schema.sql              # 数据库建表脚本
│
└── scripts/
    ├── migrate_to_mysql.py     # 数据迁移
    └── view_db_schema.py       # 查看 Schema
```

### C. 依赖版本锁定

**Node.js (云函数)**:
```json
{
  "dependencies": {
    "wx-server-sdk": "~2.6.3",
    "mysql2": "^3.6.0"
  }
}
```

**Python (迁移脚本)**:
```txt
pymysql==1.1.0
pandas==2.1.4
openpyxl==3.1.2
```

### D. 参考资料

1. [微信云开发官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/getting-started.html)
2. [SM-2 算法论文](https://www.supermemo.com/en/archives1990-2015/articles/algorithm)
3. [腾讯云 MySQL 最佳实践](https://cloud.tencent.com/document/product/584/27781)
4. [微信小程序性能优化指南](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/)

---

**文档版本**: v1.0.0  
**最后更新**: 2026-07-13  
**维护团队**: 一帮人马工作室（QQ691481548）
