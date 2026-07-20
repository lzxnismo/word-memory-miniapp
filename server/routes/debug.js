/**
 * routes/debug.js — 调试路由（仅开发环境使用）
 * 
 * ⚠️ 警告：这些接口仅用于开发调试，生产环境应禁用
 * 
 * GET /debug/tables        -> 列出所有表
 * GET /debug/schema/:table -> 查看表结构
 * 
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')

// 只在开发环境启用
if (process.env.NODE_ENV !== 'production') {
  router.use((req, res, next) => {
    // 可选：添加简单的身份验证
    const token = req.headers['x-debug-token']
    if (token !== process.env.DEBUG_TOKEN && token !== 'dev_debug_token_2026') {
      return res.status(403).json({ code: 403, msg: '禁止访问调试接口' })
    }
    next()
  })

  // GET /debug/tables - 列出所有表
  router.get('/tables', async (req, res) => {
    try {
      const db = getPool()
      const [rows] = await db.execute('SHOW TABLES')
      const tables = rows.map(row => Object.values(row)[0])
      
      res.json({
        code: 200,
        message: '获取成功',
        data: {
          database: process.env.DATABASE_NAME || 'word_memory_db',
          tables
        }
      })
    } catch (error) {
      res.status(500).json({
        code: 500,
        message: '查询失败',
        error: error.message
      })
    }
  })

  // GET /debug/schema/:table - 查看表结构
  router.get('/schema/:table', async (req, res) => {
    try {
      const tableName = req.params.table
      const db = getPool()
      
      // 检查表是否存在
      const [checkResult] = await db.execute(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DATABASE_NAME || 'word_memory_db', tableName]
      )
      
      if (checkResult[0].count === 0) {
        return res.status(404).json({
          code: 404,
          message: `表 '${tableName}' 不存在`
        })
      }
      
      // 获取表结构
      const [columns] = await db.execute(`SHOW FULL COLUMNS FROM \`${tableName}\``)
      
      // 获取索引信息
      const [indexes] = await db.execute(`SHOW INDEXES FROM \`${tableName}\``)
      
      // 获取示例数据（最多 5 条）
      const [samples] = await db.execute(`SELECT * FROM \`${tableName}\` LIMIT 5`)
      
      res.json({
        code: 200,
        message: '获取成功',
        data: {
          table: tableName,
          columns: columns.map(col => ({
            Field: col.Field,
            Type: col.Type,
            Null: col.Null,
            Key: col.Key,
            Default: col.Default,
            Extra: col.Extra,
            Comment: col.Comment
          })),
          indexes: indexes.reduce((acc, idx) => {
            const indexName = idx.Key_name
            if (!acc[indexName]) {
              acc[indexName] = {
                name: indexName,
                unique: idx.Non_unique === 0,
                columns: []
              }
            }
            acc[indexName].columns.push({
              ordinal: idx.Seq_in_index,
              name: idx.Column_name
            })
            return acc
          }, {}),
          sample_count: samples.length,
          samples
        }
      })
    } catch (error) {
      res.status(500).json({
        code: 500,
        message: '查询失败',
        error: error.message
      })
    }
  })
}

module.exports = router
