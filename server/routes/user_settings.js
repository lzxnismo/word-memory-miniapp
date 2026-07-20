/**
 * routes/user_settings.js — 用户设置路由
 *
 * 从云函数 user_settings 迁移，提供 RESTful 接口
 * GET  /user_settings   -> 获取用户设置和统计
 * PUT  /user_settings   -> 更新用户设置
 *
 * © 一帮人马工作室（QQ691481548）
 */

const express = require('express')
const router = express.Router()
const { getPool } = require('../shared/db')
const { authMiddleware } = require('../shared/auth')

router.use(authMiddleware)

// ==================== GET /user_settings ====================
// 获取用户设置和基础统计（从 settings K-V 表）
router.get('/', async (req, res) => {
  try {
    const openid = req.openid
    const db = getPool()

    // 1. 查询用户设置（从 settings 表，K-V 结构）
    let [settingsRows] = await db.execute(
      'SELECT setting_key, setting_value FROM settings WHERE user_id = ?',
      [openid]
    )

    // 2. 解析 K-V 为对象
    const settingsMap = {}
    if (settingsRows && settingsRows.length > 0) {
      settingsRows.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value
      })
    }

    // 3. 如果没有设置记录，使用默认值
    let dailyLimit = parseInt(settingsMap.daily_limit) || 20
    let newWordRatio = parseFloat(settingsMap.new_word_ratio) || 0.3

    // 4. 如果没有记录，创建默认设置
    if (settingsRows.length === 0) {
      try {
        await db.execute(
          'INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?, ?, ?)',
          [openid, 'daily_limit', String(dailyLimit)]
        )
        await db.execute(
          'INSERT INTO settings (user_id, setting_key, setting_value) VALUES (?, ?, ?)',
          [openid, 'new_word_ratio', String(newWordRatio)]
        )
      } catch (err) {
        console.warn('创建默认设置失败:', err.message)
      }
    }

    // 3. 获取统计数据
    const [statsRows] = await db.execute(`
      SELECT 
        COUNT(*) as total_learned_new,
        SUM(CASE WHEN memory_level >= 5 THEN 1 ELSE 0 END) as total_mastered,
        ROUND(AVG(CASE WHEN total_reviews > 0 THEN mastery_score ELSE NULL END), 1) as accuracy
      FROM user_word_memories
      WHERE user_id = ?
    `, [openid])

    const stats = statsRows[0] || {}

    res.json({
      code: 200,
      data: {
        daily_limit: parseInt(dailyLimit),
        new_word_ratio: parseFloat(newWordRatio),
        total_learned_new: stats.total_learned_new || 0,
        total_mastered: stats.total_mastered || 0,
        accuracy: parseFloat(stats.accuracy) || 0
      }
    })
  } catch (err) {
    console.error('❌ GET /user_settings error:', err)
    res.status(500).json({
      code: 500,
      message: '获取用户设置失败',
      error: err.message
    })
  }
})

// ==================== PUT /user_settings ====================
// 更新用户设置（写入 settings K-V 表）
router.put('/', async (req, res) => {
  try {
    const openid = req.openid
    const { daily_limit, new_word_ratio } = req.body

    // 参数验证
    const safeDailyLimit = Math.max(5, Math.min(100, parseInt(daily_limit) || 20))
    const safeNewWordRatio = Math.max(0, Math.min(1, parseFloat(new_word_ratio) || 0.3))

    const db = getPool()

    // 更新或插入设置（K-V 模式）
    const insertUpdateSettings = async (key, value) => {
      const [result] = await db.execute(`
        INSERT INTO settings (user_id, setting_key, setting_value)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          setting_value = ?
      `, [openid, key, String(value), String(value)])
      return result
    }

    await Promise.all([
      insertUpdateSettings('daily_limit', safeDailyLimit),
      insertUpdateSettings('new_word_ratio', safeNewWordRatio)
    ])

    res.json({
      code: 200,
      message: '设置已保存',
      data: {
        daily_limit: safeDailyLimit,
        new_word_ratio: safeNewWordRatio
      }
    })
  } catch (err) {
    console.error('❌ PUT /user_settings error:', err)
    res.status(500).json({
      code: 500,
      message: '保存用户设置失败',
      error: err.message
    })
  }
})

module.exports = router
