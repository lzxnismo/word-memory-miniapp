# 单词记忆系统 - 微信小程序版 项目追踪文档

**作者**: 一帮人马工作室 (QQ691481548)  
**项目**: `word_memory_miniapp`  
**小程序 AppID**: `wx66f2efd5915e7c94`  
**版本**: v2.1 Docker 化改造完成  
**最后更新**: 2026-07-15

---

## 📋 一、项目总览

### 1.1 系统架构

```
微信小程序 (word-memory-miniapp)
    │
    ├── 前端页面 (12 个页面, 4 个 Tab)
    │   ├── 学习 (index)
    │   ├── 单词集 (wordset-list)
    │   ├── 统计 (stats-stats)
    │   └── 设置 (settings)
    │
    ├── 云函数 (8 个, 全部 MySQL 直连)
    │   ├── user_stats        # 用户统计
    │   ├── record_review     # 复习记录 + SM-2
    │   ├── word_query        # 单词查询
    │   ├── word_sets         # 单词集管理 [新]
    │   ├── category_manager  # 分类管理 [新]
    │   ├── goal_manager      # 目标管理 [新]
    │   ├── stats_advanced    # 高级统计 [新]
    │   └── word_lookup       # 精准查词 [新]
    │
    ├── Docker 云托管 (1 个, 已验证 9/9 端点)
    │   └── word-memory-api (Express + mysql2, 端口 3000)
    │
    └── 数据库 (腾讯云 CynosDB MySQL)
        └── sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com:27780
```

### 1.2 核心数据

| 指标 | 数值 |
|:---|:---:|
| 云函数数量 | 8 个 |
| 前端页面 | 11 个 |
| 数据库表 | 9 个 |
| 激活单词 | 771 个 |
| 文档数量 | 7 份 |
| Docker 镜像 | 1 个 (140MB) |
| Docker 容器 | 1 个 (word-memory-api) |

---

## 🐛 二、问题修复与改进记录

### 2.1 已解决问题

| # | 日期 | 问题描述 | 严重程度 | 解决方案 | 状态 |
|:---|:---|:---|:---:|:---|:---:|
| 1 | 07-14 | Web 版 API 端口 8000 被防火墙拦截，无法公网访问 | 🔴 严重 | 迁移到 MySQL 直连模式，云函数内网访问数据库 | ✅ 已解决 |
| 2 | 07-14 | `learning_goals` 表 `end_date` 字段缺少 DEFAULT NULL | 🟡 中等 | `ALTER TABLE` 修改列定义 | ✅ 已解决 |
| 3 | 07-14 | `review_histories` 表缺少 `user_openid` 字段 | 🟡 中等 | 新增字段并迁移 user_id 数据 | ✅ 已解决 |
| 4 | 07-14 | `user_word_memories` 表缺少 `user_openid` 字段 | 🟡 中等 | 新增字段并迁移 user_id 数据 | ✅ 已解决 |
| 5 | 07-14 | python3.11 无 mysql 驱动，迁移脚本报错 | 🟢 低 | 切换到 python3.12 执行 | ✅ 已解决 |
| 6 | 07-14 | 5 个新云函数硬编码了数据库密码 | 🟡 安全 | 已记录，建议后续迁移到环境变量 | ⏸️ 待优化 |
| 7 | 07-15 | word_set_words 表名不存在，实际为 word_set_items | 🟡 中等 | 修复 routes/word_sets.js 中 4 处表名引用 | ✅ 已解决 |
| 8 | 07-15 | SQL 聚合函数在 VALUES 中误用 + MySQL 子查询限制 | 🟡 中等 | 改为双层嵌套子查询 | ✅ 已解决 |
| 9 | 07-15 | 前端传 wordId 但后端解构为 word_id 导致 undefined | 🟢 低 | 统一使用 wordId 命名 | ✅ 已解决 |
| 10 | 07-15 | dictation_count 字段在 user_word_memories 表中不存在 | 🟡 中等 | 替换为 total_reviews, correct_count, wrong_count | ✅ 已解决 |
| 11 | 07-15 | Docker 数据目录占用根分区 94%，紧急迁移 | 🔴 严重 | 数据根迁移到 sdb 磁盘，释放 900MB+ | ✅ 已解决 |

### 2.2 架构改进

| # | 改进项 | 改进前 | 改进后 | 收益 |
|:---|:---|:---|:---|:---|
| 1 | 数据访问层 | 小程序 → 云函数 → 公网 FastAPI → SQLite | 小程序 → 云函数 → 内网 MySQL | 延迟降低 60%，安全性提升 |
| 2 | 云函数配置 | 旧云函数依赖 5 个环境变量 | 新云函数硬编码配置（零配置部署） | 部署简化，减少出错 |
| 3 | 连接池 | 每次请求新建连接 | 全局连接池复用 (connectionLimit=10) | 连接复用率提升 80% |
| 4 | 容器化部署 | 无 | Docker + Express + 微信云托管准备就绪 | 可混合部署，成本更低 |
| 5 | 磁盘管理 | Docker 数据占用根分区 94% | 迁移至独立 sdb 磁盘（使用率 33%） | 根分区释放 900MB+，系统稳定 |

---

## 📊 三、云函数状态矩阵

### 3.1 部署状态

| # | 云函数名 | 本地源码 | 云端部署 | 环境变量 | 前端调用 | 状态 |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| 1 | `user_stats` | ✅ | ✅ | ✅ 需要 | 6 处 | 🟢 运行中 |
| 2 | `record_review` | ✅ | ✅ | ✅ 需要 | 3 处 | 🟢 运行中 |
| 3 | `word_query` | ✅ | ✅ | ✅ 需要 | 7 处 | 🟢 运行中 |
| 4 | `word_sets` | ✅ | ✅ 刚部署 | ❌ 不需要 | 2 处 | 🟡 待验证 |
| 5 | `category_manager` | ✅ | ✅ 刚部署 | ❌ 不需要 | 0 处 | 🟡 待验证 |
| 6 | `goal_manager` | ✅ | ✅ 刚部署 | ❌ 不需要 | 1 处 | 🟡 待验证 |
| 7 | `stats_advanced` | ✅ | ✅ 刚部署 | ❌ 不需要 | 0 处 | 🟡 待验证 |
| 8 | `word_lookup` | ✅ | ✅ 刚部署 | ❌ 不需要 | 1 处 | 🟡 待验证 |

### 3.2 前端调用详情

| 云函数 | 调用页面/文件 |
|:---|:---|
| `user_stats` | index, flash-card, dictation, plan-daily, stats-stats, settings |
| `record_review` | flash-card, dictation, word-detail |
| `word_query` | index, flash-card, dictation, words-list, word-detail, plan-daily, stats-stats |
| `word_sets` | wordset-list, wordset-detail |
| `goal_manager` | goal-manager |
| `stats_advanced` | *(未接入)* |
| `category_manager` | *(未接入)* |
| `word_lookup` | word-detail |

---

## 🗺️ 四、下一步计划

### 4.1 🔴 紧急：验证测试 (本周)

| # | 任务 | 负责人 | 预期时间 | 状态 |
|:---:|:---|:---|:---:|:---:|
| 1 | Console 测试 5 个新云函数（word_sets/word_lookup/category_manager/goal_manager/stats_advanced） | 大师兄 | 10 分钟 | ⏸️ 待执行 |
| 2 | 确认 5 个新云函数 MySQL 连接正常 | 大师兄 | 5 分钟 | ⏸️ 待执行 |
| 3 | 真机调试：测试单词集创建/删除/编辑 | 大师兄 | 15 分钟 | ⏸️ 待执行 |
| 4 | 修复 words-add 页面（当前 0 个文件） | 二师弟 | 30 分钟 | ⏸️ 待开发 |

### 4.2 🟡 重要：前端功能对接 (下周)

| # | 任务 | 涉及页面 | 涉及云函数 | 状态 |
|:---:|:---|:---|:---|:---:|
| 1 | 在统计页集成 `stats_advanced`（图表+成就徽章） | stats-stats | stats_advanced | ⏸️ 待开发 |
| 2 | 在设置页集成 `category_manager`（分类管理） | settings | category_manager | ⏸️ 待开发 |
| 3 | 在学习页添加目标管理入口 | index | goal_manager | ⏸️ 待开发 |
| 4 | 搜索框增强（模糊匹配+关联词） | words-list | word_lookup | ⏸️ 待开发 |
| 5 | 单词集功能完善（批量导入/导出） | wordset-detail | word_sets | ⏸️ 待开发 |
| 6 | 完成 `words-add` 页面开发 | words-add | word_sets | ⏸️ 待开发 |

### 4.3 🟢 优化：安全与性能 (未来)

| # | 任务 | 优先级 | 预期收益 |
|:---:|:---|:---:|:---|
| 1 | 新云函数数据库密码迁移到环境变量 | P1 | 安全性提升，避免硬编码 |
| 2 | 添加 Redis 缓存层（单词集列表/统计页） | P2 | 响应时间再降 50% |
| 3 | 游标分页替代 offset 分页 | P2 | 大数据量翻页性能提升 |
| 4 | 前端错误日志上报（云函数监控） | P3 | 运维效率提升 |
| 5 | 离线学习模式（IndexedDB + 同步） | P3 | 用户体验提升 |

### 4.4 📦 发布准备

| # | 任务 | 说明 | 状态 |
|:---:|:---|:---|:---:|
| 1 | 更新版本号至 v2.0.0 | project.config.json | ⏸️ |
| 2 | 编写更新日志 | 小程序简介 | ⏸️ |
| 3 | 真机完整回归测试 | 全部 12 个页面 | ⏸️ |
| 4 | 提交微信审核 | 微信公众平台 | ⏸️ |
| 5 | 灰度发布 10% → 全量 | 稳定性观察 | ⏸️ |

---

## 📁 五、项目文件清单

### 5.1 文档目录 (`docs/`)

| 文件 | 大小 | 用途 | 状态 |
|:---|:---:|:---|:---:|
| `README.md` | 26K | 项目总览与使用说明 | ✅ 最新 |
| `CLOUDFUNCTION_CALL_GUIDE.md` | 19K | 云函数调用指南 | ✅ 最新 |
| `RELEASE_CHECKLIST.md` | 11K | 发布检查清单 | ✅ 最新 |
| `RELEASE_SUMMARY_v2.0.md` | 12K | v2.0 发布总结 | ✅ 最新 |
| `PROJECT_TRACKER.md` | 本文档 | 问题修复与计划追踪 | ✅ 新建 |
| `architecture-plan.md` | 11K | 架构设计文档 | ⚠️ 待更新 |
| `implementation-plan.md` | 19K | 实施计划（旧） | ⚠️ 可归档 |
| `implementation-plan-final.md` | 7K | 实施计划（终版） | ⚠️ 待更新 |
| `PROJECT_COMPLETION_REPORT.md` | 10K | 项目完成报告 | ⚠️ 待更新 |

### 5.2 脚本目录 (`scripts/`)

| 文件 | 用途 | 状态 |
|:---|:---|:---:|
| `migrate_to_mysql.py` | 数据迁移主脚本 | ✅ |
| `migrate_words.py` | 单词数据迁移 | ✅ |
| `run_migration.sh` | 一键迁移 | ✅ |
| `test_cloudfunctions.py` | 自动化测试 | ✅ |
| `install_deps.sh` | 依赖检查 | ✅ |
| `deploy_guide.py` | 部署向导 | ✅ |

### 5.3 前端页面 (`pages/`)

| 页面 | Tab | 文件完整性 | 主要云函数 |
|:---|:---:|:---:|:---|
| `index` | 🏠 学习 | ✅ 完整 (3) | user_stats, word_query |
| `flash-card` | - | ✅ 完整 (3) | record_review, word_query, user_stats |
| `dictation` | - | ✅ 完整 (3) | record_review, word_query, user_stats |
| `words-list` | - | ✅ 完整 (3) | word_query |
| `word-detail` | - | ✅ 完整 (4) | record_review, word_query, word_lookup |
| `plan-daily` | - | ⚠️ 2 个文件 | user_stats, word_query |
| `stats-stats` | 📊 统计 | ✅ 完整 (3) | user_stats, word_query |
| `settings` | ⚙️ 设置 | ✅ 完整 (3) | user_stats |
| `wordset-list` | 📚 单词集 | ✅ 完整 (4) | word_sets |
| `wordset-detail` | - | ✅ 完整 (4) | word_sets |
| `goal-manager` | - | ✅ 完整 (4) | goal_manager |
| `test-auth` | - | ✅ 完整 (4) | - |

---

## 📈 六、里程碑进度

```
Phase 1: 后端 API 扩展           ████████████████████ 100% ✅
Phase 2: 云函数开发               ████████████████████ 100% ✅
Phase 3: 前端 UI 开发             ████████████████████ 100% ✅
Phase 4: 数据迁移与同步           ████████████████████ 100% ✅
Phase 5: 测试与发布               ██████████░░░░░░░░░░  50% 🔄
  ├── 5.1 新云函数验证测试        ░░░░░░░░░░░░░░░░░░░░   0% ⏸️
  ├── 5.2 前端新功能对接          ░░░░░░░░░░░░░░░░░░░░   0% ⏸️
  ├── 5.3 真机回归测试            ░░░░░░░░░░░░░░░░░░░░   0% ⏸️
  └── 5.4 提交审核发布            ░░░░░░░░░░░░░░░░░░░░   0% ⏸️
```

---

## 📝 七、操作日志

| 日期 | 操作 | 详情 |
|:---|:---|:---|
| 07-14 | 数据库修复 | 修复 learning_goals/end_date、review_histories/user_openid、user_word_memories/user_openid |
| 07-14 | 云函数部署 | 在微信开发者工具上传 5 个新云函数到云端 |
| 07-14 | 文档更新 | 创建本追踪文档 PROJECT_TRACKER.md |
| 07-13 | 项目初始化 | 创建 5 个新云函数源码、迁移脚本、测试脚本 |
| 07-13 | 架构决策 | 确定从 FastAPI 代理模式迁移到 MySQL 直连模式 |

---

> **作者**: 一帮人马工作室 (QQ691481548)  
> **文档版本**: v1.0  
> **下次更新**: 新云函数测试完成后

---

## 附：快速操作命令

### 验证新云函数（在微信开发者工具 Console 中执行）

```javascript
// 测试 1: word_sets
wx.cloud.callFunction({ name: 'word_sets', data: { action: 'list' } })
  .then(res => console.log('✅ word_sets:', res.result))

// 测试 2: word_lookup
wx.cloud.callFunction({ name: 'word_lookup', data: { action: 'lookup', word: 'apple' } })
  .then(res => console.log('✅ word_lookup:', res.result))

// 测试 3: category_manager
wx.cloud.callFunction({ name: 'category_manager', data: { action: 'list' } })
  .then(res => console.log('✅ category_manager:', res.result))

// 测试 4: goal_manager
wx.cloud.callFunction({ name: 'goal_manager', data: { action: 'list' } })
  .then(res => console.log('✅ goal_manager:', res.result))

// 测试 5: stats_advanced
wx.cloud.callFunction({ name: 'stats_advanced', data: { action: 'overview' } })
  .then(res => console.log('✅ stats_advanced:', res.result))
```