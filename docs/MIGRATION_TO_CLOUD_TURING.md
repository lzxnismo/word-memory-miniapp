# 微信云托管迁移指南

## ✅ 已完成的工作

### 1. 后端修复
- ✅ 修改 `server/shared/db.js` 数据库连接配置
  - 从腾讯云 CynosDB (`sh-cynosdbmysql-grp...:27780`) 
  - 改为微信云 MySQL (`10.40.109.26:3306`)
  - 数据库名: `word_memory_db`

### 2. 前端改造（核心文件）
- ✅ 创建 `utils/request.js` - 统一 HTTP 请求封装
- ✅ 修改 `app.js` - 移除云开发初始化
- ✅ 修改 `pages/index/index.js` - 首页调用
- ✅ 修改 `pages/wordset-list/wordset-list.js` - 单词集列表

## 🔄 待完成页面迁移

以下页面需要按相同模式替换（共约 9 个页面）：

| 文件 | 主要 API | 替换方法 |
|------|--------|---------|
| `pages/wordset-detail/wordset-detail.js` | word_sets CRUD | 参考 `wordset-list.js` |
| `pages/words-list/words-list.js` | word_query | 参考 `index.js` |
| `pages/word-detail/word-detail.js` | word_query/:id | 参考 `index.js` |
| `pages/flash-card/flash-card.js` | record_review, word_query | 需组合多个 API |
| `pages/dictation/dictation.js` | word_query, record_review | 需组合多个 API |
| `pages/stats-stats/stats.js` | stats_advanced | 单独处理 |
| `pages/plan-daily/plan-daily.js` | user_stats/daily-plan | 单独处理 |
| `pages/goal-manager/goal-manager.js` | goal_manager | 单独处理 |
| `pages/settings/settings.js` | category_manager | 单独处理 |

## 🔧 替换规则速查

### 1. 添加 import（在文件顶部）

```javascript
import { request } from '../../utils/request'
```

### 2. GET 请求替换示例

**旧代码：**
```javascript
const res = await wx.cloud.callContainer({
  path: '/api/v1/word_sets',
  method: 'POST',
  header: { 'content-type': 'application/json' },
  data: { action: 'list' }
})

if (res.statusCode === 200 && res.data.code === 200) {
  const sets = res.data.data
}
```

**新代码：**
```javascript
const res = await request('/word_sets')

if (res && res.data) {
  const sets = res.data
}
```

### 3. POST 请求替换示例

**旧代码：**
```javascript
const res = await wx.cloud.callContainer({
  path: '/api/v1/word_sets',
  method: 'POST',
  header: { 'content-type': 'application/json' },
  data: {
    action: 'create',
    name: newName.trim(),
    description: newDesc.trim()
  }
})

if (res.statusCode === 200 && res.data.code === 201) {
  // 成功
}
```

**新代码：**
```javascript
const res = await request('/word_sets', {
  method: 'POST',
  data: {
    name: newName.trim(),
    description: newDesc.trim()
  }
})

if (res && res.code === 201) {
  // 成功
}
```

### 4. URL 映射表

| 旧路径 (callContainer) | 新路径 (request) |
|-----------------------|------------------|
| `/api/v1/user_stats?action=getReviewQueue` | `/user_stats/review-queue` |
| `/api/v1/user_stats?action=getDailyPlan` | `/user_stats/daily-plan` |
| `/api/v1/user_stats?action=getLearningHistory` | `/user_stats/history` |
| `/api/v1/word_sets?action=list` | `/word_sets` |
| `/api/v1/word_sets?action=create` | `/word_sets` (POST) |
| `/api/v1/word_sets?action=update` | `/word_sets` (PUT) |
| `/api/v1/word_sets?action=delete` | `/word_sets` (DELETE) |
| `/api/v1/word_query?action=search` | `/word_query/search` |
| `/api/v1/word_query?action=getById` | `/word_query/:id` |
| `/api/v1/word_query?action=getAll` | `/word_query` |
| `/api/v1/word_query?action=getNewWords` | `/word_query/new-words` |
| `/api/v1/record_review?action=create` | `/record_review` (POST) |
| `/api/v1/goal_manager?action=getGoals` | `/goal_manager` |
| `/api/v1/category_manager?action=list` | `/category_manager` |

## ⚠️ 注意事项

1. **响应格式变化**
   - 旧：`res.statusCode === 200 && res.data.code === 200`
   - 新：直接判断 `res && res.code === 200`

2. **错误处理**
   - request.js 内部已经处理了大部分错误并显示 toast
   - 外层无需再 catch，或 catch 后做额外处理

3. **认证机制**
   - request.js 自动注入 OpenID
   - 如果 OpenID 不存在会返回 "登录失效" 提示

4. **GET 参数**
   - 可以直接拼在 URL 后面：`'/word_query?limit=5&offset=0'`

## 🎯 验证步骤

完成每个页面后，在开发者工具中测试：

1. 打开对应页面
2. 查看 Console 日志是否有报错
3. 检查网络面板（Network）的请求是否成功
4. 确认数据是否正确显示

## 📊 进度追踪

- ✅ 后端数据库迁移完成
- ✅ utils/request.js 创建完成
- ✅ app.js 改造完成
- ✅ index.js 改造完成
- ✅ wordset-list.js 改造完成
- ⏳ 其他页面等待手动迁移

© 一帮人马工作室（QQ691481548）