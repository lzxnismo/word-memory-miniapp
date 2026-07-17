# Word Memory MiniApp - 微信小程序架构规划

## 🎯 项目概述

将现有 SQLite 本地存储的单词记忆系统移植到微信小程序 + 微信云开发，实现云端数据同步和多设备访问。

---

## 🏗️ 技术架构

### 当前系统（对比）
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Vue 3 Web   │     │   Nginx      │     │  FastAPI     │
│  Frontend    │────→│ (:8080)      │────→│ (:8000)      │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                                         ┌──────┴───────┐
                                         │   SQLite     │
                                         │  Local DB    │
                                         └──────────────┘
```

### 目标架构（微信云开发）
```
┌─────────────────────────────────────────────────────────────┐
│                    WeChat MiniProgram                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Flash Card  │  │ Dictation   │  │ Stats & Charts      │ │
│  │ (WXML/WXSS) │  │ (WXS Logic) │  │ (ECharts/Canvas)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│           ↓                ↓                  ↓            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │          Cloud Database (MongoDB - Document Based)    │ │
│  │         自动鉴权 | 安全规则 | 事务支持                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                              ↑                               │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Cloud Storage                            │ │
│  │       TTS Audio Files / User Images / Assets          │ │
│  └───────────────────────────────────────────────────────┘ │
│                              ↑                               │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                Cloud Functions                        │ │
│  │        Node.js Serverless Code (业务逻辑封装)          │ │
│  │   - TTS Proxy (有道 API)                              │ │
│  │   - Advanced Analytics                              │ │
│  │   - Data Migration (SQLite → MongoDB)               │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 核心组件映射表

| 原有模块 | 新实现方式 | 说明 |
|---------|-----------|------|
| **FastAPI Backend** | ❌ 完全移除 | 云开发免后端架构 |
| **SQLite Database** | ✅ 云数据库 (MongoDB 格式) | 9 张表转为 9 个集合 (Collection) |
| **Vue 3 CDN Frontend** | ✅ WXML/WXS 重写 | 保留业务逻辑，重写视图层 |
| **Local SQLite → Cloud** | ✅ 手动数据迁移脚本 | 一次性迁移历史数据 |
| **TTS (本地/外部)** | ✅ 云存储 + 云函数代理 | 有道 TTS → 云函数缓存加速 |
| **ECharts 统计** | ✅ Canvas 或 Chart-Weixin | 替换为小程序原生图表库 |

---

## 🔄 数据模型转换（重点！）

### 9 张 SQLite 表 → 9 个 MongoDB 集合

#### 1️⃣ `words` → Collection: `words`
```javascript
// SQLite 结构
{
  id INTEGER PRIMARY KEY,
  english TEXT,
  chinese TEXT,
  phonetic TEXT,
  example TEXT,
  tags JSON,
  created_at TIMESTAMP
}

// MongoDB 转换后
{
  _id: ObjectId("..."),
  english: "apple",
  chinese: "苹果",
  phonetic: "/ˈæp.l/",
  example: "I eat an apple every day.",
  tags: ["fruit", "daily"],  // 保持数组格式
  createdAt: ISODate("2026-07-13T00:00:00Z"),
  updatedAt: ISODate("2026-07-13T00:00:00Z")
}
```

#### 2️⃣ `users` → Collection: `users`
```javascript
{
  _id: ObjectId("..."),
  openid: String,  // 新增，微信唯一标识
  nickname: String,
  avatarUrl: String,
  settings: {
    dailyLimit: 50,
    soundEnabled: true,
    vibrationEnabled: true
  },
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

#### 3️⃣ `user_words` → Collection: `user_word_relations`
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),  // 关联 users._id
  wordId: ObjectId("..."),  // 关联 words._id
  
  // SM-2 算法字段
  sm2Phase: 2,  // 0 新词，1 初学，2 短期，3 长期，4 牢固
  repetitionCount: 5,
  consecutiveSuccesses: 3,
  efFactor: 2.5,
  interval: 7,
  
  // 学习进度
  nextReviewAt: ISODate(...),  // 下次复习时间
  lastReviewedAt: ISODate(...),
  
  // 来源追踪
  importSource: "manual"|"import"|..."
}
```

#### 4️⃣ `word_sets` → Collection: `word_sets`
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  name: "四级词汇",
  description: "CET-4 核心词汇",
  color: "#4CAF50",
  wordCount: 1200,
  isDefault: false,
  createdAt: ISODate(...),
  updatedAt: ISODate(...)
}
```

#### 5️⃣ `set_word_relations` → Collection: `set_word_relations`
```javascript
{
  _id: ObjectId("..."),
  setId: ObjectId("..."),
  wordId: ObjectId("..."),
  addedAt: ISODate(...)
}
```

#### 6️⃣ `study_plans` → Collection: `study_plans`
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  setName: ObjectId("..."),  // 引用 word_sets
  startDate: Date("2026-07-13"),
  endDate: Date("2026-07-20"),
  dailyTarget: 50,
  status: "active"|"completed"|"paused",
  createdAt: ISODate(...)
}
```

#### 7️⃣ `dictations` → Collection: `dictations`
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  planId: ObjectId("..."),
  totalWords: 50,
  wordsCorrect: 42,
  accuracyRate: 0.84,
  durationSeconds: 300,
  startedAt: ISODate(...),
  completedAt: ISODate(...),
  status: "active"|"completed"|"aborted"
}
```

#### 8️⃣ `review_logs` → Collection: `review_logs`
```javascript
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  wordId: ObjectId("..."),
  userWordId: ObjectId("..."),  // 关联用户 - 单词关系
  qualityScore: 3,  // 1-5 分
  correct: true,  // 是否答对
  reviewedAt: ISODate(...),
  sm2Adjustment: {
    previousPhase: 1,
    newPhase: 2,
    newInterval: 7
  }
}
```

#### 9️⃣ `tts_cache` → Collection: `tts_cache` (新增)
```javascript
{
  word: "apple",
  audioFileId: "cloud://xxx-xxx.mp3",
  createdAt: ISODate(...),
  expiresAt: ISODate(...)
}
```

---

## 🔐 安全规则配置

### 云数据库权限示例

**用户只能读写自己的数据：**
```json
{
  "read": true,
  "write": "auth.openid == doc._openid"
}
```

**所有用户可以读单词，但只能创建自己的记录：**
```json
{
  "read": true,
  "write": "auth.openid == doc._openid"
}
```

---

## 💰 成本估算

### 免费额度（个人主体）

| 服务 | 免费额度 | 实际使用情况预估 |
|------|---------|----------------|
| **云数据库** | 2GB 存储空间 | ~50MB (10000 单词 × 1KB) |
| **云存储** | 5GB 空间，10GB/月流量 | ~500MB (TTS 音频文件) |
| **云函数** | 100 万次调用 | ~10 万调用/月 (保守估计) |
| **云调用次数** | 免费 | - |

**结论：初期完全在免费额度内！**

---

## 🚀 实施步骤

### Phase 1: 环境准备（1 天）
1. 注册微信小程序账号
2. 开通云开发环境（获取 Env ID）
3. 创建 9 个空集合（Collections）
4. 配置安全规则
5. 初始化 `project.config.json`

### Phase 2: 数据迁移脚本（1 天）
```bash
python3 migrate_sqlite_to_cloud.py
```
- 读取 SQLite 数据库
- 转换为 JSON Lines 格式
- 通过 HTTP API 批量导入云数据库
- 验证数据完整性

### Phase 3: 前端页面重构（3-5 天）
- **index.wxml/js**: 首页（学习入口）
- **flash-card.wxml/js**: 闪卡学习页
- **dictation.wxml/js**: 听写测试页
- **words.wxml/js**: 单词本管理
- **plan.wxml/js**: 学习计划
- **stats.wxml/js**: 数据统计

### Phase 4: 云函数开发（2 天）
- `tts-proxy`: 有道 TTS API 代理 + 缓存
- `analytics-helper`: 高级统计计算
- `data-migrate-helper`: 数据迁移辅助

### Phase 5: 集成测试（1-2 天）
- 真机调试
- 性能优化
- Bug 修复

### Phase 6: 备案与发布（7-10 天）
- 小程序备案（必须！）
- 提交审核
- 正式发布

---

## ⚠️ 关键技术难点与解决方案

### 1. 从结构化 SQL 到非结构化 NoSQL

**问题**：SQLite 是关系型数据库，使用 JOIN；MongoDB 是文档型，嵌套数据更优

**解决方案**：
- 将 `user_words` 中的 SM-2 数据直接嵌入用户查询结果
- 减少跨集合查询，提升性能
- 使用 `$lookup` 进行必要的关联查询

### 2. TTS 音频文件存储

**问题**：无法依赖本地音频，需要云端托管

**解决方案**：
- 有道 TTS API → 云函数缓存 → 云存储持久化
- 首次调用下载并保存到云存储
- 后续请求返回云存储 URL
- 设置 30 天过期时间

### 3. 离线可用性

**问题**：云开发默认无离线功能

**解决方案**：
- 利用 `wx.setStorage` 缓存最近学习的单词
- 用户可离线查看已缓存内容
- 网络恢复后自动同步状态

---

## 📝 下一步行动计划

请在以下选项中选择：

1. **我确认上述架构方案** → 开始创建环境并编写迁移脚本
2. **需要调整某些部分** → 详细说明修改需求
3. **先查看具体代码示例** → 我提供关键功能的实现代码（如 Flash 卡片重构）

大师兄，您看是否需要先调整架构设计？特别是数据模型部分，或者有其他疑问？🤔

---

## 📚 参考资料

- [微信云开发官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/basis/getting-started.html)
- [云数据库 CRUD 示例](https://developer.aliyun.com/article/1715007)
- [云函数快速开始](https://docs.cloudbase.net/cloud-function/quick-start)
- [数据导入导出指南](https://developers.weixin.qq.com/minigame/dev/wxcloud/guide/database/import.html)

**设计者**: 一帮人马工作室（QQ691481548）
**版本**: 1.0.0
**最后更新**: 2026-07-13
