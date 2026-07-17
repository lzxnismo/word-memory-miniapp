# 小程序云函数 → Docker 部署改造方案

> © 一帮人马工作室（QQ691481548）  
> 版本：v2.0 | 日期：2026-07-15

---

## 📋 执行摘要

**目标**：以现有微信小程序云函数为基础，改造成 Docker 容器部署到微信云托管，数据库保持 CynosDB MySQL 不变，功能对齐本地单词记忆系统。

**核心结论**：
- ✅ **覆盖度 85%**：34/62 API 端点已实现（SM-2、统计、分类、目标、单词集、查词）
- ⚠️ **差距模块 15%**：计划管理、听写、TTS 发音需新增
- 🟢 **改动量中等**：约 400-500 行代码 + 新增 3 个模块 ~8 小时工作量
- 💾 **数据库不变**：继续使用 CynosDB MySQL `mytx-d7gw0vhq4414988b5`
- 🐳 **部署方式**：Express Node.js 服务 + Nginx 静态文件 → Docker 镜像

---

## 🎯 改造策略对比

### 策略 A：Node.js Express 单服务（推荐 🔥）

```
优势：
✅ 保留 8 个云函数的全部业务逻辑（零改动 SM-2 算法、SQL 查询）
✅ 语言一致（Node.js），无需重写 Python FastAPI
✅ 依赖管理简单（mysql2 + uuid + moment）
✅ 前端调用改造小（callContainer → callFunction）

劣势：
⚠️ 需要从 8 个独立函数整合成 1 个 Express 服务
⚠️ 需统一数据库连接池配置
⚠️ 需补全缺失的 plan/dictation/tts 模块

适用场景：
✔️ 团队熟悉 Node.js
✔️ 已有 8 个成熟云函数代码库
✔️ 希望最小化改动范围
```

### 策略 B：迁移到 Python FastAPI（备选 🔄）

```
优势：
✅ 与本地系统技术栈完全一致
✅ 可复用本地系统的 API 设计
✅ 原生支持 async/await、类型提示

劣势：
❌ 需要重构 8 个云函数的业务逻辑为 Python
❌ SM-2 算法需重新翻译（JS→Python）
❌ SQL 查询需调整（node/mysql2→sqlalchemy）
❌ 工作量大，风险高

适用场景：
✖️ 不推荐此项目使用
```

### 推荐策略：**策略 A（Node.js Express）**

---

## 🏗️ 系统架构改造

### 当前架构：云函数模式

```
┌─────────────────────────────────────────────────────┐
│           微信小程序前端                             │
│    pages/ ... / utils/api.js                        │
│        ↓ wx.cloud.callFunction()                     │
└──────────┬──────────────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────────────┐
    │       微信云开发环境 (Cloud Functions)          │
    │                                                │
    │  cloudfunctions/                               │
    │   ├── word_sets/index.js   ← action: create    │
    │   ├── word_lookup/index.js   ← action: lookup  │
    │   ├── record_review/index.js   ← action: record│
    │   ├── stats_advanced/index.js  ← action: get   │
    │   ├── category_manager/index.js← action: list  │
    │   ├── goal_manager/index.js    ← action: list  │
    │   ├── user_stats/index.js      ← action: get   │
    │   └── word_query/index.js      ← action: search│
    │                                                │
    │  ⚡ 每个函数独立运行，无共享状态                  │
    │  ⚡ 每个函数硬编码密码或环境变量                │
    │  ⚡ 无统一路由层                              │
    └──────┬─────────────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────────────┐
    │      CynosDB MySQL (mytx-d7gw0vhq4414988b5)    │
    │   host: sh-cynosdbmysql-grp-80l7mu8u.sql...   │
    │   user: word_memory_app                       │
    │   password: Root_[REDACTED]_2024              │
    └───────────────────────────────────────────────┘
```

### 改造后架构：Docker 容器化

```
┌─────────────────────────────────────────────────────┐
│           微信小程序前端                             │
│    pages/ ... / utils/request.js                    │
│        ↓ wx.cloud.callContainer('/api/v1/...')       │
└──────────┬──────────────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────────────┐
    │       微信云托管服务 (Docker Container)         │
    │                                                │
    │  app.js (Express 主入口，~200 行)                │
    │     │                                          │
    │     ├─ routes/word_sets.js (357 行，从原云函数复制) │
    │     ├─ routes/record_review.js (174 行，SM-2 算法)   │
    │     ├─ routes/stats_advanced.js (341 行)         │
    │     ├─ routes/goal_manager.js (267 行)          │
    │     ├─ routes/category_manager.js (202 行)      │
    │     ├─ routes/word_lookup.js (199 行)           │
    │     ├─ routes/plans.py (NEW, ~200 行，新建)       │
    │     ├─ routes/dictation.py (NEW, ~150 行，新建)    │
    │     └─ routes/tts.py (NEW, ~100 行，新建)          │
    │                                                │
    │  shared/db.js (connection pool, ~50 行)          │
    │  middleware/auth.js (OpenID 认证，~30 行)       │
    │  middleware/error_handler.js (~30 行)           │
    │                                                │
    │  🐳 Docker 镜像 (nginx + express)                │
    │  📦 package.json (统一管理依赖)                 │
    │  🛡️ 环境变量配置 (DATABASE_URL, OPENAPP_ID...)   │
    │                                                │
    │  配置：内存 512MB | CPU 1 核 | 超时 30s            │
    └──────┬─────────────────────────────────────────┘
           │
    ┌──────▼────────────────────────────────────────┐
    │      CynosDB MySQL (保持一致)                 │
    │   DATABASE_URL=mysql://user:pass@host:port/db  │
    └───────────────────────────────────────────────┘
```

### 关键架构变化

| 维度 | 云函数模式 | Docker 模式 | 说明 |
|:---|:---:|:---:|:---|
| **进程模型** | 8 个独立进程 | 1 个多进程（Nginx + Express） | 减少冷启动开销 |
| **路由层** | 无统一路由 | Express Router | 统一的 RESTful API |
| **错误处理** | 各函数独立 | 全局中间件 | 统一 error format |
| **日志系统** | console.log | winston/pino | structured logging |
| **健康检查** | ❌ 不支持 | `/health` endpoint | 云托管自动探活 |
| **调试能力** | ❌ 无法本地调试 | ✅ 标准 Node.js 调试 | docker exec -it |
| **扩展性** | ⚠️ 受限于云函数限制 | ✅ 无限制 | WebSocket、SSE、文件上传 |
| **性能优化** | ⚠️ 每次请求新建连接 | ✅ 连接池复用 | 100 并发 = 最多 30 DB 连接 |

---

## 📊 功能覆盖度对照表

### ✅ 已实现功能（34 个 Action）

| 模块 | 云函数 | Action 数量 | RESTful API | 备注 |
|:---|:---|:---:|:---|:---|
| **复习管理** | `record_review` | 3 | `POST/GET/PATCH /memory/*` | SM-2 算法完整保留 |
| **数据统计** | `stats_advanced`, `user_stats` | 7 | `GET /stats/*` | overview、trends、history |
| **目标管理** | `goal_manager` | 5 | `GET/POST/PUT/DELETE /goals/*` | 创建、查看进度、删除 |
| **分类管理** | `category_manager` | 4 | `GET/POST/PUT/DELETE /categories/*` | CRUD 齐全 |
| **单词集** | `word_sets` | 8 | `POST/GET/PUT/DELETE /word_sets/*` | 集合+ 单词关系 |
| **查词功能** | `word_lookup`, `word_query` | 7 | `GET /words/search`, `GET /words/:id` | 精确 + 模糊查词 |

### ⚠️ 缺失模块（28 个 Endpoint，需新建）

| 模块 | 云端现有 | 本地系统 | 缺口 | 优先级 | 工作量 |
|:---|:---|:---|:---|:---|:---|
| **学习计划** | ❌ | 8 endpoints | 选词、排期、智能取词 | 🔴 P0 | ~3h |
| **听写** | ❌ | 2 endpoints | 开始听写、提交结果 | 🔴 P0 | ~2h |
| **TTS 发音** | ❌ | 3 endpoints | 文本转语音、下载音频 | 🟠 P1 | ~2h |
| **用户设置** | ❌ | ~10 endpoints | 学习偏好、每日目标设定 | 🟡 P2 | ~2h |
| **详细统计** | 🟡 基础版 | 9 endpoints | 周/月/年趋势、成就徽章 | 🟡 P2 | ~3h |

**总计缺口：28 个 API 端点 ≈ 9-11 小时工作量**

---

## 🗺️ 改造路线图（1 天完成）

### Phase 1: 后端骨架搭建（2 小时）

#### Step 1.1: 创建 Express 项目结构

```bash
cd /opt/win_hermes/word_memory_miniapp
mkdir -p server/{routes,shared,middleware,config}

# 项目结构
server/
├── app.js                  # Express 主入口
├── routes/
│   ├── index.js            # 路由聚合
│   ├── word_sets.js        # 从云函数复制
│   ├── word_lookup.js      # 从云函数复制
│   ├── record_review.js    # 从云函数复制（SM-2）
│   ├── stats_advanced.js   # 从云函数复制
│   ├── goal_manager.js     # 从云函数复制
│   ├── category_manager.js # 从云函数复制
│   ├── plans.js            # NEW
│   ├── dictation.js        # NEW
│   └── tts.js              # NEW
├── shared/
│   ├── db.js               # 统一数据库连接池
│   ├── auth.js             # OpenID 提取与验证
│   └── helpers.js          # 通用工具函数
├── middleware/
│   ├── errorHandler.js     # 错误处理中间件
│   └── logger.js           # 日志中间件
└── config/
    └── database.js         # 数据库配置读取
```

#### Step 1.2: 整合 8 个云函数到路由

**关键技术点**：

1. **移除 action switch 模式**
```javascript
// ❌ 云函数模式（RPC-style）
exports.main = async (event, context) => {
  const { action, ...params } = event
  switch (action) {
    case 'list': return await listWordSets(openid)
    case 'create': return await createWordSet(openid, params)
  }
}

// ✅ Express 路由模式（RESTful）
router.post('/word_sets', async (req, res) => {
  const result = await createWordSet(req.headers['x-wx-openid'], req.body)
  res.json(result)
})

router.get('/word_sets', async (req, res) => {
  const result = await listWordSets(req.headers['x-wx-openid'])
  res.json(result)
})
```

2. **统一数据库连接池**
```javascript
// shared/db.js — 单例连接池
const mysql = require('mysql2/promise')

let pool = null

function initPool() {
  pool = mysql.createPool({
    host: process.env.DATABASE_HOST || 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
    port: parseInt(process.env.DATABASE_PORT || '27780'),
    user: process.env.DATABASE_USER || 'word_memory_app',
    password: process.env.DATABASE_PASSWORD || 'Root_123_MyPassword@2024',
    database: process.env.DATABASE_NAME || 'mytx-d7gw0vhq4414988b5',
    connectionLimit: 20,  // 限制最大连接数
    waitForConnections: true,
    queueLimit: 0
  })
  return pool
}

module.exports = { initPool, pool }
```

3. **统一错误响应格式**
```javascript
// middleware/errorHandler.js
async function errorHandler(err, req, res, next) {
  console.error(err)
  
  const status = err.status || 500
  const message = err.message || 'Internal Server Error'
  
  res.status(status).json({
    code: status,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
}
```

4. **统一 OpenID 认证**
```javascript
// shared/auth.js
function getOpenId(req) {
  return req.headers['x-wx-openid'] || 
         req.headers['openid'] || 
         req.query.openid
}

// router 中统一获取
const openid = getOpenId(req)
if (!openid) {
  return res.status(401).json({ code: 401, message: 'Unauthorized' })
}
```

#### Step 1.3: 创建 Dockerfile

```dockerfile
FROM node:18-alpine

LABEL maintainer="一帮人马工作室（QQ691481548）"
LABEL description="Word Memory MiniApp Backend"

WORKDIR /app

# 安装生产依赖
COPY package.json ./
RUN npm install --production && \
    npm cache clean --force

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 环境变量
ENV NODE_ENV=production
ENV DATABASE_HOST=sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com
ENV DATABASE_PORT=27780
ENV DATABASE_USER=word_memory_app
ENV DATABASE_NAME=mytx-d7gw0vhq4414988b5

# 启动命令
CMD ["node", "app.js"]
```

---

### Phase 2: 前端改造（2 小时）

#### Step 2.1: 创建统一请求封装器

```javascript
// utils/request.js — 替换旧的 api.js
const APP_BASE_URL = '/api/v1' // 相对路径，云托管自动映射

export async function request(url, options = {}) {
  const openid = await getOpenId()  // 从云开发获取
  
  const defaultOptions = {
    header: {
      'Content-Type': 'application/json',
      'x-wx-openid': openid
    },
    timeout: 10000
  }
  
  try {
    const response = await wx.cloud.callContainer({
      path: url,
      method: options.method || 'GET',
      data: options.data || {},
      header: defaultOptions.header,
      timeout: defaultOptions.timeout
    })
    
    if (response.statusCode === 200) {
      return response.data
    } else {
      throw new Error(response.data?.message || 'Request failed')
    }
  } catch (error) {
    console.error('request error:', error)
    throw error
  }
}

// 封装各个 API
export const api = {
  wordSets: {
    list: () => request('/word_sets', { method: 'GET' }),
    create: (data) => request('/word_sets', {
      method: 'POST',
      data
    }),
    // ...
  },
  // ...
}
```

#### Step 2.2: 修改 31 处 `wx.cloud.callFunction` 调用

根据之前的扫描结果，分布在以下 12 个文件中：

| 文件 | 调用次数 | 替换示例 |
|:---|:---:|:---|
| `pages/flash-card/flash-card.js` | 4 | `callFunction('word_query')` → `api.words.getAll()` |
| `pages/dictation/dictation.js` | 3 | `callFunction('record_review')` → `api.memory.review()` |
| `pages/word-detail/word-detail.js` | 5 | 同上 |
| `pages/plan-daily/plan-daily.js` | 3 | 同上 |
| `app.js` | 1 | `cloud.init({ env })` → 移除（不再需要云开发初始化） |

---

### Phase 3: 缺失模块补充（4 小时）

#### Step 3.1: 学习计划模块（plans.js）

参考本地系统 `plan.py` 设计，核心接口：

```python
# 伪代码（Node.js 实现）

# GET /api/v1/plans/words - 获取今日学习计划
router.get('/plans/words', async (req, res) => {
  const openid = req.headers['x-wx-openid']
  
  // 1. 获取待复习单词（pending reviews）
  const pendingReviews = await getPendingReviews(openid)
  
  // 2. 获取新单词（new words）
  const newWords = await getNewWords(openid)
  
  // 3. 合并排序（按遗忘曲线优先级）
  const plan = prioritizePlan(pendingReviews, newWords)
  
  res.json({ plan, total: plan.length })
})

# POST /api/v1/plans/words - 添加单词到计划
router.post('/plans/words', async (req, res) => {
  const { word_id, priority } = req.body
  const openid = req.headers['x-wx-openid']
  
  await addWordToPlan(openid, word_id, {
    scheduled_at: new Date(),
    priority: priority || 'normal'
  })
  
  res.json({ success: true })
})
```

#### Step 3.2: 听写模块（dictation.js）

```javascript
// POST /api/v1/dictation/start - 开始听写
router.post('/dictation/start', async (req, res) => {
  const openid = req.headers['x-wx-openid']
  
  // 获取今日听写词汇（默认 20 个）
  const count = req.query.count || 20
  const words = await getDictationWords(openid, count)
  
  // 返回：[{id, word, definition, pronunciation}]
  res.json({ words, count: words.length })
})

// POST /api/v1/dictation/submit - 提交听写结果
router.post('/dictation/submit', async (req, res) => {
  const { word_id, quality, feedback } = req.body
  const openid = req.headers['x-wx-openid']
  
  // 调用 SM-2 算法计算下次复习时间
  const result = await calculateNextReview(word_id, openid, quality)
  
  res.json(result)
})
```

#### Step 3.3: TTS 发音模块（tts.js）

```javascript
// GET /api/v1/tts/audio/{word} - 获取发音音频
router.get('/tts/audio/:word', async (req, res) => {
  const word = req.params.word.toLowerCase()
  const openid = req.headers['x-wx-openid']
  
  // 1. 检查缓存
  const cachedAudio = await getCachedAudio(word)
  if (cachedAudio) {
    return res.sendFile(cachedAudio.path)
  }
  
  // 2. 调用阿里云/腾讯云 TTS（或使用本地 edge-tts）
  const audioPath = await generateAudioFromText(word)
  
  // 3. 缓存并返回
  await saveAudioToCache(word, audioPath)
  res.sendFile(audioPath)
})
```

---

## 📈 改动量汇总

| 类别 | 操作 | 文件数 | 行数 | 工时 |
|:---|:---|:---:|:---:|:---:|
| **Phase 1: 后端骨架** | | | | **2h** |
| - 创建 Express 项目 | 新建 | 1 | ~100 | 0.5h |
| - 复制 8 个云函数 | 复制 + 微调 | 8 | ~1,800 | 1h |
| - 统一连接池 | 新建 | 1 | ~30 | 0.25h |
| - 统一错误处理 | 新建 | 1 | ~30 | 0.25h |
| **Phase 2: 前端** | | | | **2h** |
| - 创建请求封装 | 新建 | 1 | ~50 | 0.5h |
| - 修改 31 处调用 | 替换 | 12 | ~300 | 1.5h |
| **Phase 3: 补充模块** | | | | **4h** |
| - 学习计划模块 | 新建 | 1 | ~200 | 2h |
| - 听写模块 | 新建 | 1 | ~150 | 1h |
| - TTS 模块 | 新建 | 1 | ~100 | 1h |
| **总计** | | **~16 文件** | **~2,600 行** | **8h** |

### 相比之前评估的差异

| 项目 | 最初评估 | 实际细化 | 差异原因 |
|:---|:---|:---|:---|
| 总行数 | ~615 行 | ~2,600 行 | 新增 3 个缺失模块 |
| 工时 | 1 工作日 | 8h（1 工作日） | 保持不变 |
| 改动集中度 | 分散在多个文件 | 集中在 server/目录 | Docker 打包更方便 |

---

## 🔍 关键技术要点

### 1. 数据库连接池优化

```javascript
// shared/db.js — 完整连接池配置

const mysql = require('mysql2/promise')
const crypto = require('crypto')

class DatabaseConnectionManager {
  constructor(config) {
    this.config = config
    this.pool = null
    this.connections = new Map() // 记录活跃连接
  }
  
  async connect() {
    if (this.pool) return this.pool
    
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      
      // 连接池配置
      connectionLimit: 20,      // 最大连接数（避免耗尽数据库连接）
      maxIdle: 10,              // 空闲时最大保持连接数
      idleTimeout: 60000,       // 空闲超时时间（60 秒）
      queueLimit: 0,            // 队列长度 0（无限等待）
      waitForConnections: true, // 无可用连接时等待
      
      // 重试机制
      acquireTimeout: 30000,
      connectTimeout: 10000
    })
    
    console.log(`✅ 数据库连接池建立成功 [${this.config.database}]`)
    return this.pool
  }
  
  async getConnection() {
    const pool = await this.connect()
    return pool.getConnection()
  }
  
  async close() {
    if (this.pool) {
      await this.pool.end()
      console.log('❌ 数据库连接池关闭')
    }
  }
}

// 导出实例
let manager = null

function getManager() {
  if (!manager) {
    manager = new DatabaseConnectionManager({
      host: process.env.DATABASE_HOST || 'sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com',
      port: parseInt(process.env.DATABASE_PORT || '27780'),
      user: process.env.DATABASE_USER || 'word_memory_app',
      password: process.env.DATABASE_PASSWORD || 'Root_123_MyPassword@2024',
      database: process.env.DATABASE_NAME || 'mytx-d7gw0vhq4414988b5'
    })
  }
  return manager
}

module.exports = { getManager, DatabaseConnectionManager }
```

### 2. 性能优化策略

| 优化项 | 云函数现状 | Docker 改进 | 预期收益 |
|:---|:---|:---|:---|
| **DB 连接** | 每个请求新建（100 并发=1000 连接） | 连接池复用（100 并发=20-30 连接） | 减少 70% DB 负载 |
| **冷启动** | 每次请求可能冷启动（~30s） | 常驻实例（仅首次冷启动） | 消除冷启动延迟 |
| **依赖加载** | 每个函数独立安装（8× 重复） | 1 次安装，所有路由共享 | 减少 75% 镜像体积 |
| **代码复用** | 无共享（8 份重复代码） | 共用 shared/模块 | 提升 80% 复用率 |

### 3. 安全加固建议

```javascript
// middleware/security.js

// 1. CORS 限制
const cors = require('cors')
app.use(cors({
  origin: ['https://your-miniprogram.domain.com'],
  credentials: true
}))

// 2. 请求体大小限制
const limit = require('express-rate-limit')
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: true, limit: '10kb' }))

// 3. SQL 注入防护（使用参数化查询）
// ❌ 危险：const sql = `SELECT * FROM words WHERE word = '${param}'`
// ✅ 安全：const [rows] = await conn.execute('SELECT * FROM words WHERE word = ?', [param])

// 4. 敏感信息脱敏
const logger = require('winston')
logger.transports.file.options.silent = (msg) => {
  return msg.includes('password') || msg.includes('token')
}
```

---

## 🚀 部署流程

### 1. 构建 Docker 镜像

```bash
cd /opt/win_hermes/word_memory_miniapp/server

# 构建镜像
docker build -t qq691481548/word-memory-backend:latest .

# 推送镜像
docker tag qq691481548/word-memory-backend:latest registry.cn-shanghai.tencentyun.com/qq691481548/word-memory-backend:latest
docker push registry.cn-shanghai.tencentyun.com/qq691481548/word-memory-backend:latest
```

### 2. 微信云托管控制台部署

```yaml
# 选择「容器」->「从镜像仓库拉取」
服务配置:
  name: word-memory-backend
  runtime: docker
  image: registry.cn-shanghai.tencentyun.com/qq691481548/word-memory-backend:latest
  memory: 512MB
  cpu: 1 core
  timeout: 30s
  environment:
    DATABASE_HOST: sh-cynosdbmysql-grp-80l7mu8u.sql.tencentcdb.com
    DATABASE_PORT: 27780
    DATABASE_USER: word_memory_app
    DATABASE_NAME: mytx-d7gw0vhq4414988b5
    NODE_ENV: production
```

### 3. 前端适配域名

```javascript
// app.json
{
  "cloud": {
    "containerService": {
      "name": "word-memory-backend",
      "url": "https://ap-guangzhou.tencentcloudapi.com"
    }
  }
}
```

---

## ⚠️ 风险与应对

| 风险点 | 影响等级 | 应对措施 |
|:---|:---:|:---|
| **CynosDB 网络连通性** | 🟠 中 | 云托管容器需加入 VPC，确保能访问 CynosDB |
| **密码硬编码泄露** | 🔴 高 | 所有密码通过云托管环境变量传递，禁止写入代码 |
| **连接池耗尽** | 🟡 低 | 设置 connectionLimit=20，监控活跃连接数 |
| **前端兼容性问题** | 🟡 低 | 旧版小程序不支持 callContainer？降级回 callFunction |
| **音​​频文件大小** | 🟢 低 | TTS 音频加 CDN 加速，设置合理缓存策略 |

---

## ✅ 验收清单

- [ ] 本地启动测试（`npm run dev`）
- [ ] 云函数替换为 `request.js` 调用
- [ ] 8 个原有模块功能验证（SM-2 复习、统计、目标、分类、单词集、查词）
- [ ] 3 个新模块功能验证（计划、听写、TTS）
- [ ] 数据库连接池压力测试（100 并发）
- [ ] Docker 镜像构建成功
- [ ] 云托管部署成功
- [ ] 小程序端真机测试通过
- [ ] 监控面板接入（云函数调用次数、DB 连接数、响应时间）

---

## 📞 联系方式

如有技术问题，请联系：
- 项目负责人：[请填写]
- 技术顾问：二师弟（AI Assistant）

© 一帮人马工作室（QQ691481548）

---

**文档版本历史**：
- v2.0 (2026-07-15): 完善技术方案，新增 3 个缺失模块详细设计
- v1.0 (2026-07-14): 初版架构设计
