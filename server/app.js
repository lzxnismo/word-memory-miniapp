/**
 * app.js — Express 应用入口
 * 
 * 微信云托管 Docker 容器主入口
 * 将 8 个云函数整合为统一 Express 服务
 * 
 * 启动方式: node app.js
 * 端口: 3000（云托管默认端口）
 * 
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const app = express()

// ==================== 全局中间件 ====================

// 请求体解析
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 请求日志（开发环境）
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-wx-openid, x-test-openid')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

// ==================== 健康检查 ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    app: 'Word Memory System',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用单词记忆系统 API',
    docs: '/health',
    version: '2.0.0'
  })
})

// ==================== 路由注册 ====================

// Phase 1: word_sets 已验证（RESTful 改造完成 ✅）
const wordSetsRouter = require('./routes/word_sets')
app.use('/api/v1/word_sets', wordSetsRouter)

// Phase 2: 云函数迁移（8 个云函数 → Express 路由）
const wordQueryRouter = require('./routes/word_query')
app.use('/api/v1/word_query', wordQueryRouter)

const recordReviewRouter = require('./routes/record_review')
app.use('/api/v1/record_review', recordReviewRouter)

const userStatsRouter = require('./routes/user_stats')
app.use('/api/v1/user_stats', userStatsRouter)

const wordLookupRouter = require('./routes/word_lookup')
app.use('/api/v1/word_lookup', wordLookupRouter)

const categoryManagerRouter = require('./routes/category_manager')
app.use('/api/v1/category_manager', categoryManagerRouter)

const goalManagerRouter = require('./routes/goal_manager')
app.use('/api/v1/goal_manager', goalManagerRouter)

const statsAdvancedRouter = require('./routes/stats_advanced')
app.use('/api/v1/stats_advanced', statsAdvancedRouter)

const categoryManagementRouter = require('./routes/category_management')
app.use('/api/v1/category_management', categoryManagementRouter)

const userSettingsRouter = require('./routes/user_settings')
app.use('/api/v1/user_settings', userSettingsRouter)

// Debug routes (development only)
const debugRouter = require('./routes/debug')
app.use('/api/v1/debug', debugRouter)

// ==================== 错误处理 ====================

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler')
app.use(notFoundHandler)
app.use(errorHandler)

// ==================== 启动服务 ====================

const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Word Memory System API 服务已启动`)
  console.log(`📡 端口: ${PORT}`)
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`)
  console.log(``)
  console.log(`✅ Phase 1 - RESTful 核心:`)
  console.log(`   /api/v1/word_sets/*        — 单词集管理（CRUD）`)
  console.log(``)
  console.log(`✅ Phase 2 - 云函数迁移:`)
  console.log(`   /api/v1/word_query/*       — 单词查询、搜索、复习队列`)
  console.log(`   /api/v1/record_review/*    — SM-2 复习记录与记忆状态`)
  console.log(`   /api/v1/user_stats/*       — 用户统计、计划、历史`)
  console.log(`   /api/v1/word_lookup/*      — 查词、详情、年级列表`)
  console.log(`   /api/v1/category_manager/* — 分类 CRUD`)
  console.log(`   /api/v1/goal_manager/*     — 学习目标管理`)
  console.log(`   /api/v1/stats_advanced/*   — 高级统计、趋势、成就`)
  console.log(`   /api/v1/category_management/* — 分类同步、批量操作`)
})

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('📴 收到 SIGTERM 信号，正在关闭服务...')
  const { closePool } = require('./shared/db')
  await closePool()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('📴 收到 SIGINT 信号，正在关闭服务...')
  const { closePool } = require('./shared/db')
  await closePool()
  process.exit(0)
})

module.exports = app