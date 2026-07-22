# 📝 变更日志 (CHANGELOG)

> **项目**: Word Memory — 微信小程序版单词记忆系统  
> **工作室**: 一帮人马工作室（QQ691481548）  
> **格式说明**: 遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 规范  
> **版本策略**: 按日期记录，每轮优化为一个发布节点

---

## [2026-07-22] — 第三轮：微信内网通信 + 文档体系完善

### ✨ 新增 (Added)
- 创建 `docs/CHANGELOG.md` — 统一变更日志文件
- 创建 `docs/ARCHITECTURE.md` — 系统架构文档
- 创建 `docs/DATABASE.md` — 数据库设计文档
- 创建 `docs/DESIGN.md` — 设计文档
- 创建 `docs/USER_GUIDE.md` — 用户使用指南
- `server/routes/auth.js` — 微信登录认证路由（POST /auth/login，开发模式降级备用）

### 🔄 变更 (Changed)
- **通信方式重构**: `wx.request()` 公网 HTTPS → `wx.cloud.callContainer()` 微信内网
  - 不再需要配置合法域名
  - OpenID 由云托管网关自动注入，无需手动登录
  - 所有页面代码无需改动，仅改 `utils/request.js` 封装层
- **app.js**: 恢复 `wx.cloud.init()`，去除手动 `wx.login()` 登录流程
- **utils/request.js**: 新增 `X-WX-SERVICE: 'express-yoq0'` 请求头（必须指定服务名）

### 🐛 修复 (Fixed)
- **`-601031 Invalid path` 错误**: 云托管 callContainer 缺少 `X-WX-SERVICE` 头，添加后恢复
- **环境 ID 修正**: `wx.cloud.init` env 留空 → callContainer config.env 指定 `prod-d2g668gku1c36b430`
- **服务名修正**: 从 `express` 修正为 `express-yoq0`（来自云托管控制台服务列表）

### 📝 文档 (Documentation)
- 清理 10 个过时文档，保留 4 个核心文件
- 新增 5 个文档（CHANGELOG、ARCHITECTURE、DATABASE、DESIGN、USER_GUIDE）
- 更新 `MIGRATION_COMPLETE.md` 最终架构说明

---

## [2026-07-22] — 第二轮：callContainer 内网通信 + 前端 Bug 修复

### 🔄 变更 (Changed)
- `utils/request.js`: `wx.request()` → `wx.cloud.callContainer()` 微信内网通信
- `app.js`: 恢复 `wx.cloud.init()`，去除手动 `wx.login()` 登录流程
- 配置: 环境 ID `prod-d2g668gku1c36b430`，服务名 `express-yoq0`

### 🐛 修复 (Fixed)
- **`pages/wordset-list/wordset-list.js`**: `POST /word_sets` → `GET /word_sets`（后端只接受 GET）
- **`pages/wordset-detail/wordset-detail.js`**:
  - 查找接口: `/word_lookup/lookup?word=` → `/word_sets/lookup/{word}`
  - 参数名: `word_id` → `wordId`（后端 camelCase）
  - 删除状态码: `code === 204` → `code === 200`
- **`pages/flash-card/flash-card.js`**: 新增 `loadWordSetWords(setId)` 方法，支持从单词集进入闪卡学习
- **`pages/wordset-detail/wordset-detail.js`**: `startLearning()` 传 `source=wordset&sourceId=xxx` 到闪卡页

### ✨ 新增 (Added)
- 单词集 → 闪卡学习完整链路打通

---

## [2026-07-22] — 第一轮：前后端接口修复 + 登录流程

### 🐛 修复 (Fixed)

#### 前端 API 调用错误
| 文件 | 问题 | 修复 |
|------|------|------|
| `pages/flash-card/flash-card.js` | POST → GET 不匹配、响应格式误判 | 改为 POST + Array.isArray(res.data) |
| `pages/dictation/dictation.js` | POST → GET、TTS 参数错误 | 同上 + 搜索接口路径修正 |
| `pages/words-list/words-list.js` | TTS 参数错误 | `/word_query/search?keyword=xxx` |
| `pages/wordset-detail/wordset-detail.js` | 查找接口、参数名、状态码错误 | 全部修复 |
| `pages/wordset-list/wordset-list.js` | POST → GET | 改为 GET |
| `pages/flash-card/flash-card.js` | 未处理单词集来源参数 | 新增 loadWordSetWords |

#### 后端 API 错误
| 路由 | 问题 | 修复 |
|------|------|------|
| `user_stats.js` | SQL 字段名 `ladder` → `memory_level` | 全部修正 |
| `word_query.js` | SQL 字段名 `definition` → `meaning` | 全部修正 |
| `user_stats.js` | 字段名 `review_count` → `total_reviews` | 全部修正 |
| `user_stats.js` | 字段名 `quality` → `mastery_score` | 全部修正 |
| `user_settings.js` | 表不存在（`user_settings`） | 改为 `settings` K-V 表 |
| `category_management.js` | 字段不存在（`description`） | 移除引用 |
| `record_review.js` | 路由路径 `/record` | 前端改为 `/record_review/record` |

### ✨ 新增 (Added)
- `server/routes/auth.js` — POST /auth/login 微信登录认证路由
- `utils/request.js` — `ensureLogin()` 等待机制
- `scripts/monitor_deployment.sh` — 部署监控脚本

---

## [2026-07-20~21] — 初始修复：数据库字段映射 + 路由缺失

### 🐛 修复 (Fixed)
- SM-2 算法 SQL 字段名映射错误（`ladder`、`definition`、`review_count`、`quality`）
- 7 个前端路由路径不匹配后端（`/record_review` → `/record` 等）
- HTTP 方法不匹配（GET vs POST）
- URL 拼接 bug

### ✨ 新增 (Added)
- `GET /api/v1/user_stats/review-queue` — 复习队列路由
- `GET /api/v1/word_query/recommend` — 推荐单词路由
- 后端：`/debug/tables`、`/debug/schema/:table` 调试接口

---

## 📋 已知问题面板

| # | 问题 | 优先级 | 发现日期 | 状态 |
|:--:|:-----|:------:|:--------:|:----:|
| 1 | 首页统计页 `current_streak` 为 0（TODO 标记） | 🟡 P2 | 07-20 | ⏳ |
| 2 | `server/routes/auth.js` 保留但未被调用（callContainer 自动注入） | 🟢 P3 | 07-22 | ⏳ 可删除 |

---

## 📊 统计

| 指标 | 数值 |
|------|:----:|
| 已修复 Bug | 15+ 个 |
| 待修复 Bug | 2 个 |
| 已修改文件 | 10+ 个 |
| 文档覆盖率 | 8 份 |
| 通信方式 | ✅ 微信内网 callContainer |
| 部署环境 | 云托管 `prod-d2g668gku1c36b430` / 服务 `express-yoq0` |

---

> **最后更新**: 2026-07-22 18:30 CST  
> **维护者**: 一帮人马工作室（QQ691481548）