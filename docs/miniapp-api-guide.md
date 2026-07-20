# 微信小程序端到微信云托管后端对接指南

**版本**: v2.0.0  
**更新时间**: 2026-07-17  
**作者**: 一帮人马工作室（QQ691481548）

---

## 📋 目录

1. [快速入门](#1-快速入门)
2. [环境配置](#2-环境配置)
3. [API 接口文档](#3-api-接口文档)
4. [认证机制](#4-认证机制)
5. [错误处理](#5-错误处理)
6. [迁移指南](#6-迁移指南)
7. [常见问题](#7-常见问题)
8. [附录：完整示例代码](#8-附录完整示例代码)

---

## 1. 快速入门

### 1.1 服务地址

| 环境 | 域名 | 有效期 | 说明 |
|------|------|--------|------|
| **测试环境** | `https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com` | 30 天默认 | 仅支持测试，到期续期 |
| **生产环境** | `xxx.sh.run.tcloudbase.com` | - | 上线后需绑定自定义域名 |

> ⚠️ **重要提示**：
> - 默认域名仅供测试，正式上线前需购买并绑定自定义域名
> - 默认域名浏览器访问有效期 30 天，其他调用方式无时间限制

### 1.2 初始化 API 工具类

在项目根目录创建 `utils/request.js`：

```javascript
/**
 * 统一请求封装
 * 基于微信云开发后端 HTTP 调用
 */

const BASE_URL = 'https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com'

// 全局配置
const CONFIG = {
  timeout: 10000, // 超时时间 10s
  debug: true     // 是否开启调试日志
}

/**
 * 获取用户 OpenID（微信云托管自动注入）
 * @returns {Promise<string>} 用户唯一标识
 */
async function getOpenId() {
  // 方案 A：云开发环境，自动注入 x-wx-openid 头
  const res = await wx.cloud.callFunction({
    name: 'auth',
    data: {}
  })
  return res.result.openid
}

/**
 * 发送 HTTP 请求（推荐方式）
 * @param {string} url - 请求路径（含 /api/v1/ 前缀）
 * @param {object} options - 请求选项
 * @param {string} options.method - GET/POST/PUT/DELETE
 * @param {object} options.data - 请求参数
 * @param {boolean} options.auth - 是否需要用户认证（默认 true）
 * @returns {Promise<object>} 响应结果
 */
async function request(url, options = {}) {
  const { method = 'GET', data = {}, auth = true } = options
  
  // 构建完整 URL
  const fullUrl = `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
  
  // 准备请求头
  const headers = {
    'Content-Type': 'application/json'
  }
  
  // 认证：云开发环境自动注入 x-wx-openid
  if (auth) {
    try {
      // 通过云函数获取 openid
      const res = await wx.cloud.callFunction({
        name: 'get_openid'
      })
      headers['x-wx-openid'] = res.result.openid
    } catch (err) {
      console.error('获取 OpenID 失败:', err)
      throw new Error('登录失效，请重新登录')
    }
  }
  
  // 发起网络请求
  try {
    const response = await wx.request({
      url: fullUrl,
      method: method.toUpperCase(),
      data: method === 'GET' ? data : undefined,
      header: headers,
      dataType: 'json',
      timeout: CONFIG.timeout
    })
    
    // 调试日志
    if (CONFIG.debug) {
      console.log(`🔹 ${method} ${fullUrl}`, {
        params: data,
        status: response.statusCode,
        data: response.data
      })
    }
    
    // 业务状态码判断
    if (response.statusCode === 200 && response.data.code !== 200) {
      throw new Error(response.data.message || '请求失败')
    }
    
    if (response.statusCode === 401) {
      throw new Error('未授权，请重新登录')
    }
    
    if (response.statusCode >= 500) {
      throw new Error('服务器繁忙，请稍后重试')
    }
    
    return response.data
    
  } catch (err) {
    console.error(`❌ 请求失败：${fullUrl}`, err)
    wx.showToast({
      title: err.message || '网络错误',
      icon: 'none',
      duration: 2000
    })
    throw err
  }
}

// 导出快捷方法
module.exports = {
  get: (url, data) => request(url, { method: 'GET', data }),
  post: (url, data) => request(url, { method: 'POST', data }),
  put: (url, data) => request(url, { method: 'PUT', data }),
  delete: (url) => request(url, { method: 'DELETE' })
}
```

### 1.3 使用示例

在页面中导入并使用：

```javascript
// pages/index/index.js
const request = require('../../utils/request.js')

Page({
  data: {
    words: [],
    loading: false
  },
  
  onLoad() {
    this.loadNewWords()
  },
  
  async loadNewWords() {
    this.setData({ loading: true })
    
    try {
      // 调用后端 API 获取新词
      const res = await request.get('/api/v1/word_query/new-words?limit=20')
      
      this.setData({
        words: res.data || []
      })
      
    } catch (err) {
      console.error('加载单词失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

---

## 2. 环境配置

### 2.1 必需依赖

确保项目已启用 **云开发**：

1. 打开微信开发者工具
2. 点击「详情」→ 「本地设置」
3. 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
4. 开通云开发服务（免费额度足够使用）

### 2.2 App ID 配置

在 `project.config.json` 中确认 AppID：

```json
{
  "appid": "wx66f2efd5915e7c94",  // 您的小程序 AppID
  "cloudfunctionRoot": "cloudfunctions/"
}
```

### 2.3 云函数结构

项目中已预置以下云函数用于 OpenID 获取和辅助调用：

```
cloudfunctions/
├── get_openid/          # 获取当前用户 OpenID
│   ├── index.js
│   └── package.json
├── auth/                # 身份验证辅助
│   ├── index.js
│   └── package.json
└── config.json          # 云开发权限配置
```

**部署命令**：

```bash
# 安装云开发 CLI（首次）
npm install -g @cloudbase/cli

# 登录云开发控制台
cloudbase login

# 部署所有云函数
cd cloudfunctions/get_openid && cloudbase deploy
cd ../auth && cloudbase deploy
```

---

## 3. API 接口文档

> 所有接口基础路径：`https://express-yoq0-283362-9-1453336058.sh.run.tcloudbase.com/api/v1/`

### 3.1 通用格式

#### 成功响应
```json
{
  "code": 200,
  "message": "操作成功",
  "data": { /* 具体数据 */ }
}
```

#### 失败响应
```json
{
  "code": 400,           // 错误码
  "message": "错误描述",  // 用户友好提示
  "data": null           // 或包含详细错误信息
}
```

#### 认证失败
```json
{
  "code": 401,
  "message": "缺少用户身份标识（OpenID）",
  "data": null
}
```

---

### 3.2 单词查询接口

#### `/api/v1/word_query/search` - 搜索单词

**请求示例**：
```javascript
request.get('/api/v1/word_query/search', {
  keyword: 'book',     // 必选：搜索关键词
  limit: 10            // 可选：返回数量（默认 10，最大 100）
})
```

**响应示例**：
```json
{
  "code": 200,
  "data": [
    {
      "id": 894,
      "word": "book",
      "phonetic": "/bʊk/",
      "meaning": "书",
      "part_of_speech": "n.",
      "example_en": "This is my book.",
      "example_cn": "这是我的书。",
      "grade": 7,
      "unit": "Unit 3",
      "book": "7A(初一)",
      "tags": "[]",
      "difficulty": 1,
      "audio_url": null,
      "is_active": 1
    }
  ]
}
```

**字段说明**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 单词 ID |
| word | string | 英文单词 |
| phonetic | string | 音标 |
| meaning | string | 中文释义 |
| part_of_speech | string | 词性 |
| example_en | string | 英文例句 |
| example_cn | string | 中文例句翻译 |
| grade | int | 适用年级 |
| unit | string | 单元 |
| book | string | 教材名称 |
| tags | json | 标签数组 |
| difficulty | int | 难度等级 1-5 |
| audio_url | string | 音频链接（预留） |

---

#### `/api/v1/word_query/new-words` - 获取待学习新词

**请求示例**：
```javascript
request.get('/api/v1/word_query/new-words', {
  limit: 30    // 每次最多获取 30 个新词
})
```

**响应示例**：
```json
{
  "code": 200,
  "data": [
    {
      "id": 701,
      "word": "abandon",
      "phonetic": "/əˈbæn.dən/",
      "meaning": "放弃；抛弃",
      "part_of_speech": "verb",
      "example_en": "He abandoned his plan.",
      "example_cn": "他放弃了他的计划。",
      "grade": 7,
      "tags": "[]",
      "difficulty": 3,
      "audio_url": null,
      "is_active": 1
    }
  ]
}
```

**注意**：返回的是该用户尚未学习的单词列表。

---

#### `/api/v1/word_query/review-queue` - 获取待复习单词

**请求示例**：
```javascript
request.get('/api/v1/word_query/review-queue', {
  limit: 50    // SM-2 算法计算的下次复习单词
})
```

**响应示例**：
```json
{
  "code": 200,
  "data": [
    {
      "id": 123,
      "word": "resilient",
      "sm2_state": {
        "id": 456,
        "interval": 3,
        "repetitions": 2,
        "effort": 0.85,
        "next_review": "2026-07-18T08:00:00.000Z"
      }
    }
  ]
}
```

**SM-2 状态说明**：
| 字段 | 说明 |
|------|------|
| interval | 间隔天数（下次复习日期） |
| repetitions | 连续成功次数 |
| effort | 记忆努力程度 0-1 |
| next_review | 下次复习时间戳 |

---

### 3.3 单词集 CRUD

#### `POST /api/v1/word_sets` - 创建词集

**请求示例**：
```javascript
request.post('/api/v1/word_sets', {
  name: '中考必考词汇',
  description: '初中三年核心词汇汇总',
  color: '#07c160',
  words: ['abandon', 'ability', 'able']  // 可选：初始添加的单词
})
```

**响应示例**：
```json
{
  "code": 201,
  "message": "创建成功",
  "data": {
    "id": 12,
    "name": "中考必考词汇",
    "description": "初中三年核心词汇汇总",
    "color": "#07c160",
    "created_at": "2026-07-17T07:30:00.000Z",
    "word_count": 3,
    "progress": 0
  }
}
```

---

#### `GET /api/v1/word_sets` - 获取我的词集

**请求示例**：
```javascript
request.get('/api/v1/word_sets', {
  category: 'all'  // optional: all / study / review
})
```

**响应示例**：
```json
{
  "code": 200,
  "message": "获取成功",
  "data": [
    {
      "id": 10,
      "name": "测试词集",
      "description": "自动化测试用",
      "color": "#667eea",
      "created_at": "2026-07-17T03:25:51.000Z",
      "word_count": 100,
      "progress": 45  // 百分比 0-100
    }
  ]
}
```

---

#### `PUT /api/v1/word_sets/{id}` - 更新词集

**请求示例**：
```javascript
request.put('/api/v1/word_sets/10', {
  name: '更新后的名称',
  description: '新的描述',
  color: '#ff6b6b'
})
```

---

#### `DELETE /api/v1/word_sets/{id}` - 删除词集

**请求示例**：
```javascript
request.delete('/api/v1/word_sets/10')
```

---

### 3.4 数据统计接口

#### `GET /api/v1/stats/overview` - 获取统计数据

**请求示例**：
```javascript
request.get('/api/v1/stats/overview')
```

**响应示例**：
```json
{
  "code": 200,
  "data": {
    "total_words_learned": 771,
    "total_reviews": 1523,
    "current_streak": 12,
    "accuracy_rate": 0.87,
    "daily_goal_progress": {
      "new_words": 5,
      "target_new_words": 10,
      "review_words": 20,
      "target_review_words": 30
    }
  }
}
```

---

### 3.5 错题回顾

#### `POST /api/v1/record_review` - 记录复习行为

**请求示例**：
```javascript
request.post('/api/v1/record_review', {
  word_id: 894,
  quality: 4,              // 质量评分 1-5
  response_time_ms: 1500,  // 反应时间（毫秒）
  review_type: 'flashcard' // flashcard | dictation
})
```

**用途**：SM-2 算法计算下次复习时间的基础数据。

---

## 4. 认证机制

### 4.1 认证流程

微信云托管会自动在请求头注入 `x-wx-openid` 字段，无需额外处理：

```
HTTP 请求头：
Host: express-yoq0-...sh.run.tcloudbase.com
User-Agent: WeixinDevTools/1.0.x
x-wx-openid: oXXXXXXXXXXXXX1234567890  ← 云托管自动注入
```

### 4.2 本地调试（非必须）

如需在本地模拟测试，可使用 `x-test-openid` 头：

```javascript
headers['x-test-openid'] = 'test_user_123'
```

后端会根据此字段模拟一个测试用户（数据隔离）。

### 4.3 错误处理

#### 401 未授权
当后端检测到缺失 `x-wx-openid` 头时，返回：

```json
{
  "code": 401,
  "message": "缺少用户身份标识（OpenID）",
  "data": null
}
```

**解决方案**：
1. 检查云函数是否正常工作
2. 确认用户在开发者工具中已授权
3. 重新进入小程序触发云函数调用

---

## 5. 错误处理

### 5.1 常见错误码

| 错误码 | 说明 | 用户提示 |
|--------|------|---------|
| 200 | 成功 | - |
| 201 | 创建成功 | 保存成功 |
| 400 | 参数错误 | 请检查输入内容 |
| 401 | 未认证 | 登录已过期，请重新登录 |
| 403 | 禁止访问 | 无权访问此资源 |
| 404 | 资源不存在 | 请求的资源不存在 |
| 500 | 服务器内部错误 | 系统繁忙，请稍后重试 |
| 502 | 网关错误 | 服务正在维护中 |
| 503 | 服务不可用 | 服务暂时不可用 |

### 5.2 异常处理建议

在 `utils/request.js` 中添加全局错误拦截：

```javascript
// 扩展的错误处理中间件
function handleApiError(err, context) {
  const messageMap = {
    '401': '登录已过期，请重新登录',
    '403': '权限不足',
    '404': '资源不存在',
    '500': '服务器错误',
    'network error': '网络连接失败'
  }
  
  const userMessage = messageMap[err.message] || '操作失败，请重试'
  
  // 记录错误日志
  console.error(`[${context}]`, err)
  
  // UI 反馈
  wx.showToast({
    title: userMessage,
    icon: 'none',
    duration: 3000
  })
  
  // 可选择是否上报日志
  // wx.cloud.callFunction({ name: 'report_error', data: { ... } })
  
  return Promise.reject(err)
}

// 在 request 中集成
try {
  const response = await wx.request({...})
  return response.data
} catch (err) {
  return handleApiError(err, context)
}
```

---

## 6. 迁移指南（从云数据库到 REST API）

### 6.1 当前架构对比

| 项目 | 旧方案（云数据库） | 新方案（REST API） |
|------|------------------|------------------|
| 数据存储 | 云开发 MongoDB | MySQL（微信云托管内网） |
| 访问方式 | `wx.cloud.database()` | `wx.request()` HTTP |
| 性能 | 较慢（跨网调用） | 快（内网直连） |
| 可扩展性 | 受限于云开发配额 | 独立弹性伸缩 |
| 成本 | 按用量计费 | 按容器规格计费 |

### 6.2 迁移步骤

#### Step 1：备份现有数据

```sql
-- 在腾讯云上导出 SQL
mysqldump -h sh-cynosdbmysql-grp-... \
  -u word_memory_app -p mytx-d7gw0vhq4414988b5 > backup.sql
```

已在上一轮完成（176KB，771 个单词，7 个分类）。

#### Step 2：替换 API 调用

找到 `utils/api.js`，将云数据库调用改为 REST API 调用：

**原代码**：
```javascript
// utils/api.js
async function searchWords(keyword, limit = 10) {
  const db = wx.cloud.database()
  const res = await db.collection('words').where({
    word: _.regex(keyword)
  }).limit(limit).get()
  return res.data
}
```

**修改为**：
```javascript
// utils/api.js
const request = require('./request.js')

async function searchWords(keyword, limit = 10) {
  const res = await request.get('/api/v1/word_query/search', {
    keyword,
    limit
  })
  return res.data || []
}
```

#### Step 3：移除云数据库依赖

在页面文件中，删除云数据库相关代码：

```javascript
// ❌ 删除这些
const db = wx.cloud.database()
const _ = db.command
```

改用 REST API 调用。

#### Step 4：测试验证

逐页测试：
- ✅ 搜索功能
- ✅ 新词获取
- ✅ 复习队列
- ✅ 统计图表
- ✅ 个人中心

---

### 6.3 回滚方案

如果 REST API 出现问题，可回退到云数据库：

```javascript
// utils/api.js
const USE_REST_API = false  // 切换为 true 启用 REST，false 用云数据库

if (USE_REST_API) {
  // REST API 实现
} else {
  // 云数据库实现
}
```

---

## 7. 常见问题

### Q1: 为什么调用 API 时报错 401？

**原因**：未获取到用户 OpenID

**解决**：
1. 确认云函数 `get_openid` 已部署
2. 在开发者工具中开启「授权用户信息」
3. 重新进入小程序触发登录

### Q2: 默认域名过期怎么办？

**方案 1：续期**
- 在微信云托管页面点击「点击续期」按钮

**方案 2：购买自定义域名**
```
1. 注册域名（约 ¥60-100/年）
2. 配置 DNS CNAME 指向
3. 上传 SSL 证书（免费 Let's Encrypt 也可）
4. 在云托管后台绑定自定义域名
```

### Q3: 如何查看后端日志？

**步骤**：
1. 打开微信云托管控制台
2. 进入「运行日志」Tab
3. 选择实时日志或历史日志
4. 过滤关键字搜索错误堆栈

### Q4: 数据同步问题？

**原因**：前后端缓存不一致

**解决**：
```javascript
// 强制刷新数据
function refreshData() {
  wx.showLoading({ title: '加载中...' })
  
  request.get('/api/v1/word_query/search', { keyword })
    .then(res => {
      this.setData({ words: res.data })
    })
    .finally(() => {
      wx.hideLoading()
    })
}
```

### Q5: 如何优化 API 调用性能？

**建议**：
1. 批量请求：一次性获取多个数据项
2. 防抖节流：搜索框输入防抖 300ms
3. 分页加载：`limit + offset` 避免单页过载
4. 本地缓存：用 `wx.setStorageSync` 缓存搜索结果

**示例**：
```javascript
// utils/debounce.js
function debounce(fn, delay) {
  let timer = null
  return function(...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 使用
const debouncedSearch = debounce((keyword) => {
  request.get('/api/v1/word_query/search', { keyword })
}, 300)
```

---

## 8. 附录：完整示例代码

### 8.1 搜索单词页面完整代码

```javascript
// pages/word-search/word-search.js
const request = require('../../utils/request.js')
const { debounce } = require('../../utils/debounce.js')

Page({
  data: {
    keyword: '',
    results: [],
    loading: false,
    hasMore: true
  },
  
  onLoad() {
    this.debouncedSearch = debounce(this.search, 300)
  },
  
  onInput(e) {
    const keyword = e.detail.value.trim()
    this.setData({ keyword, results: [], hasMore: true })
    
    if (keyword.length > 0) {
      this.debouncedSearch(keyword)
    }
  },
  
  async search(keyword) {
    if (!keyword || keyword.length < 2) return
    
    this.setData({ loading: true })
    
    try {
      const res = await request.get('/api/v1/word_query/search', {
        keyword,
        limit: 20
      })
      
      this.setData({
        results: res.data || [],
        hasMore: res.data?.length < 20
      })
      
    } catch (err) {
      console.error('搜索失败:', err)
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      })
      
    } finally {
      this.setData({ loading: false })
    }
  },
  
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.search(this.data.keyword)
    }
  },
  
  onWordTap(e) {
    const wordId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/word-detail/word-detail?id=${wordId}`
    })
  }
})
```

### 8.2 词集管理页面完整代码

```javascript
// pages/wordset-list/wordset-list.js
const request = require('../../utils/request.js')

Page({
  data: {
    wordsets: [],
    filter: 'all',
    showingCreateModal: false
  },
  
  onLoad() {
    this.loadWordSets()
  },
  
  async loadWordSets() {
    try {
      const res = await request.get('/api/v1/word_sets')
      this.setData({ wordsets: res.data || [] })
    } catch (err) {
      console.error('加载词集失败:', err)
    }
  },
  
  showCreateModal() {
    this.setData({ showingCreateModal: true })
  },
  
  onCreateWordSet(e) {
    const name = e.detail.value.name
    const description = e.detail.value.description || ''
    const color = e.detail.value.color || '#667eea'
    
    this.createWordSet(name, description, color)
  },
  
  async createWordSet(name, description, color) {
    try {
      const res = await request.post('/api/v1/word_sets', {
        name,
        description,
        color
      })
      
      this.setData({ 
        wordsets: [res.data, ...this.data.wordsets],
        showingCreateModal: false
      })
      
      wx.showToast({ title: '创建成功', icon: 'success' })
      
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    }
  },
  
  onDeleteWordSet(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个词集吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request.delete(`/api/v1/word_sets/${id}`)
            
            this.setData({
              wordsets: this.data.wordsets.filter(ws => ws.id !== id)
            })
            
            wx.showToast({ title: '删除成功', icon: 'success' })
            
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
```

### 8.3 复习卡片组件

```html
<!-- components/flash-card/flash-card.wxml -->
<view class="flash-card {{showingAnswer ? 'flipped' : ''}}">
  <view class="card-front">
    <text class="word">{{word.word}}</text>
    <text class="phonetic">{{word.phonetic}}</text>
    <button class="show-answer" bindtap="showAnswer">查看答案</button>
  </view>
  
  <view class="card-back">
    <text class="meaning">{{word.meaning}}</text>
    <text class="example">{{word.example_en}}</text>
    <text class="example-cn">{{word.example_cn}}</text>
    
    <view class="quality-buttons">
      <button bindtap="rateWord" data-quality="1">😫 困难</button>
      <button bindtap="rateWord" data-quality="2">😐 一般</button>
      <button bindtap="rateWord" data-quality="3">🙂 简单</button>
      <button bindtap="rateWord" data-quality="4">😊 很容易</button>
    </view>
  </view>
</view>
```

```javascript
// components/flash-card/flash-card.js
Component({
  properties: {
    word: {
      type: Object,
      value: null
    },
    showingAnswer: {
      type: Boolean,
      value: false
    }
  },
  
  data: {
    // 本地状态
  },
  
  methods: {
    showAnswer() {
      this.triggerEvent('flip', { showingAnswer: true })
    },
    
    rateWord(e) {
      const quality = parseInt(e.currentTarget.dataset.quality)
      
      this.triggerEvent('rate', {
        word: this.data.word,
        quality
      })
    }
  }
})
```

---

## 🎉 总结

现在小程序已经可以完全连接到微信云托管后端，享受更快更稳定的服务了！

### 下一步行动

1. ✅ **本周**：完成主要页面的 API 迁移
2. ✅ **下周**：测试全部功能，修复兼容性问题
3. ✅ **下下周**：购买自定义域名，提交应用审核
4. 📅 **持续优化**：性能监控、错误分析、用户体验改进

---

**技术支持**：如有疑问，请查阅微信云托管官方文档：
- https://cloud.tencent.com/product/cloud-tcs
- https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html

**版本记录**：
- v2.0.0 (2026-07-17): 新增 REST API 对接指南
- v1.0.0 (2026-07-13): 初始版云数据库方案

---

*本文档由一帮人马工作室（QQ691481548）编写和维护*
